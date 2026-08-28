import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function metricKey(name: string, section?: string | null) {
  return `${section || "geral"}::${name}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Usuário não autenticado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) throw new Error("OPENAI_API_KEY não configurada na Edge Function");

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("Usuário não autenticado");

    const body = await req.json();
    const submissionId = String(body.submission_id || "");
    if (!submissionId) throw new Error("submission_id obrigatório");

    const { data: submission, error: submissionError } = await supabase
      .from("indicator_submissions")
      .select("id,platform_id,reference_date")
      .eq("id", submissionId)
      .single();
    if (submissionError || !submission) throw new Error("Envio não encontrado");

    const [{ data: platform }, { data: images }, { data: existingMetrics }] = await Promise.all([
      supabase.from("platforms").select("id,name").eq("id", submission.platform_id).single(),
      supabase
        .from("indicator_submission_images")
        .select("id,image_url,display_order")
        .eq("submission_id", submissionId)
        .order("display_order"),
      supabase
        .from("indicator_definitions")
        .select("id,name,unit,metric_key,source_section,display_order")
        .eq("platform_id", submission.platform_id)
        .eq("active", true)
        .order("display_order"),
    ]);

    if (!images?.length) throw new Error("Nenhuma imagem anexada ao envio");

    await supabase.from("indicator_submissions").update({ status: "extracting" }).eq("id", submissionId);

    const known = (existingMetrics || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      unit: m.unit,
      section: m.source_section,
      key: m.metric_key,
    }));

    const content: any[] = [
      {
        type: "input_text",
        text: `Você está lendo prints reais da plataforma ${platform?.name || ""}. Descubra TODOS os indicadores de desempenho visíveis que façam parte dos cards/tabelas principais usados para acompanhamento operacional.\n\nIndicadores já conhecidos desta plataforma (use o mesmo nome sempre que for claramente o mesmo indicador):\n${JSON.stringify(known)}\n\nRegras:\n- Extraia os indicadores e seus valores atuais/principais.\n- Não extraia datas, horários, contadores de navegação, IDs, metas soltas, valores históricos de gráficos ou textos decorativos como se fossem indicadores.\n- Se houver uma seção clara, informe section (ex.: Atendimento, Reputação, Logística, Qualidade).\n- name deve ser curto e estável, por exemplo: Reclamações, Mediações, Cancelamentos, Entrega no prazo.\n- unit deve ser %, R$, nota, dias, pontos ou number.\n- value deve ser numérico. Ex.: 0,42% => 0.42; 4,83/5 => 4.83; R$ 1.234,56 => 1234.56.\n- raw_text deve trazer um trecho curto do print para conferência.\n- confidence de 0 a 1.\n- Não invente dados ausentes.\n- Se o mesmo indicador aparecer mais de uma vez, prefira o valor atual/principal.`,
      },
      ...images.map((image: any) => ({ type: "input_image", image_url: image.image_url, detail: "high" })),
    ];

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("INDICATOR_VISION_MODEL") || "gpt-4.1-mini",
        input: [{ role: "user", content }],
        text: {
          format: {
            type: "json_schema",
            name: "indicator_extraction",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                metrics: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      name: { type: "string" },
                      section: { anyOf: [{ type: "string" }, { type: "null" }] },
                      unit: { type: "string", enum: ["%", "R$", "nota", "dias", "pontos", "number"] },
                      value: { type: "number" },
                      confidence: { type: "number" },
                      raw_text: { type: "string" }
                    },
                    required: ["name", "section", "unit", "value", "confidence", "raw_text"]
                  }
                },
                warnings: { type: "array", items: { type: "string" } }
              },
              required: ["metrics", "warnings"]
            }
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Falha no modelo de visão: ${errorText}`);
    }

    const ai = await response.json();
    const rawOutput = ai.output_text || ai.output?.flatMap((o: any) => o.content || []).find((c: any) => c.type === "output_text")?.text;
    if (!rawOutput) throw new Error("O modelo não retornou dados estruturados");

    const parsed = JSON.parse(rawOutput);
    const discovered: any[] = [];

    for (let index = 0; index < (parsed.metrics || []).length; index++) {
      const item = parsed.metrics[index];
      const key = metricKey(item.name, item.section);

      let definition = (existingMetrics || []).find((m: any) => m.metric_key === key);

      if (!definition) {
        const { data: created, error: createError } = await supabase
          .from("indicator_definitions")
          .insert({
            platform_id: submission.platform_id,
            name: item.name.trim(),
            unit: item.unit,
            direction: "neutral",
            weekly_aggregation: "last",
            display_order: (existingMetrics?.length || 0) + index + 1,
            metric_key: key,
            source_section: item.section || null,
            auto_discovered: true,
            created_by: userData.user.id,
            active: true
          })
          .select("id,name,unit,metric_key,source_section,display_order")
          .single();
        if (createError) throw createError;
        definition = created;
      }

      discovered.push({
        indicator_id: definition.id,
        name: definition.name,
        section: definition.source_section,
        unit: definition.unit,
        found: true,
        value: item.value,
        confidence: item.confidence,
        raw_text: item.raw_text
      });
    }

    for (const image of images) {
      await supabase.from("indicator_submission_images").update({ extraction_status: "processed" }).eq("id", image.id);
    }

    await supabase
      .from("indicator_submissions")
      .update({
        status: "extracted",
        extracted_at: new Date().toISOString(),
        extraction_warnings: parsed.warnings || []
      })
      .eq("id", submissionId);

    return new Response(JSON.stringify({ metrics: discovered, warnings: parsed.warnings || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
