import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type MetricDefinition = {
  id: string;
  name: string;
  unit: string;
  aliases?: string[];
  extraction_hint?: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const [{ data: platform }, { data: metrics }, { data: images }] = await Promise.all([
      supabase.from("platforms").select("id,name").eq("id", submission.platform_id).single(),
      supabase
        .from("indicator_definitions")
        .select("id,name,unit,aliases,extraction_hint")
        .eq("platform_id", submission.platform_id)
        .eq("active", true)
        .order("display_order"),
      supabase
        .from("indicator_submission_images")
        .select("id,image_url,display_order")
        .eq("submission_id", submissionId)
        .order("display_order"),
    ]);

    const definitions = (metrics || []) as MetricDefinition[];
    if (!definitions.length) throw new Error("Nenhuma métrica configurada para esta plataforma");
    if (!images?.length) throw new Error("Nenhuma imagem anexada ao envio");

    await supabase.from("indicator_submissions").update({ status: "extracting" }).eq("id", submissionId);

    const metricDictionary = definitions.map((m) => ({
      id: m.id,
      name: m.name,
      unit: m.unit,
      aliases: m.aliases || [],
      hint: m.extraction_hint || "",
    }));

    const content: any[] = [
      {
        type: "input_text",
        text: `Você está lendo prints reais de indicadores da plataforma ${platform?.name || ""}. Extraia SOMENTE as métricas cadastradas no dicionário abaixo.\n\nDICIONÁRIO:\n${JSON.stringify(metricDictionary)}\n\nRegras:\n- Não invente valores.\n- Se uma métrica não estiver visível, retorne found=false e value=null.\n- Converta porcentagens para o número exibido, por exemplo 0,42% => 0.42.\n- Converta vírgula decimal para ponto no JSON.\n- Nota 4,83/5 deve retornar 4.83.\n- Para cada métrica, inclua um trecho curto em raw_text que ajude o usuário a conferir a leitura.\n- confidence deve ficar entre 0 e 1.\n- Se houver mais de uma ocorrência da mesma métrica, escolha o valor de desempenho atual/principal, não metas ou valores históricos.\n- Não interprete setas de variação como o valor principal.`,
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
                      indicator_id: { type: "string" },
                      found: { type: "boolean" },
                      value: { anyOf: [{ type: "number" }, { type: "null" }] },
                      confidence: { type: "number" },
                      raw_text: { type: "string" },
                    },
                    required: ["indicator_id", "found", "value", "confidence", "raw_text"],
                  },
                },
                warnings: { type: "array", items: { type: "string" } },
              },
              required: ["metrics", "warnings"],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Falha no modelo de visão: ${errorText}`);
    }

    const ai = await response.json();
    const rawOutput = ai.output_text || ai.output?.flatMap((o: any) => o.content || []).find((c: any) => c.type === "output_text")?.text;
    if (!rawOutput) throw new Error("O modelo não retornou dados estruturados");

    const parsed = JSON.parse(rawOutput);
    const allowedIds = new Set(definitions.map((m) => m.id));
    const extracted = (parsed.metrics || []).filter((m: any) => allowedIds.has(m.indicator_id));

    for (const image of images) {
      await supabase.from("indicator_submission_images").update({ extraction_status: "processed" }).eq("id", image.id);
    }

    await supabase
      .from("indicator_submissions")
      .update({
        status: "extracted",
        extracted_at: new Date().toISOString(),
        extraction_warnings: parsed.warnings || [],
      })
      .eq("id", submissionId);

    return new Response(JSON.stringify({ metrics: extracted, warnings: parsed.warnings || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
