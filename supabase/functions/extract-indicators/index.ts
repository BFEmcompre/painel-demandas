import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function metricKey(name: string, section?: string | null) {
  return `${section || "geral"}::${name}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

async function getImagePart(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Falha ao carregar print (${response.status})`);
  const mimeType = (response.headers.get("content-type") || "image/jpeg").split(";")[0];
  if (!mimeType.startsWith("image/")) throw new Error(`Print retornou tipo inválido (${mimeType})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { inlineData: { mimeType, data: toBase64(bytes) } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Usuário não autenticado");

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) throw new Error("GEMINI_API_KEY não configurada");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) throw new Error(`Usuário não autenticado${userError?.message ? `: ${userError.message}` : ""}`);

    const body = await req.json();
    const submissionId = String(body.submission_id || "");
    if (!submissionId) throw new Error("submission_id obrigatório");

    const { data: submission, error: submissionError } = await supabase
      .from("indicator_submissions")
      .select("id,platform_id,reference_date")
      .eq("id", submissionId)
      .single();
    if (submissionError || !submission) throw new Error(`Envio não encontrado${submissionError?.message ? `: ${submissionError.message}` : ""}`);

    const [platformResult, imagesResult, metricsResult] = await Promise.all([
      supabase.from("platforms").select("id,name").eq("id", submission.platform_id).single(),
      supabase.from("indicator_submission_images").select("id,image_url,display_order").eq("submission_id", submissionId).order("display_order"),
      supabase.from("indicator_definitions").select("id,name,unit,metric_key,source_section,display_order").eq("platform_id", submission.platform_id).eq("active", true).order("display_order"),
    ]);

    if (platformResult.error) throw new Error(`Falha ao ler plataforma: ${platformResult.error.message}`);
    if (imagesResult.error) throw new Error(`Falha ao ler prints: ${imagesResult.error.message}`);
    if (metricsResult.error) throw new Error(`Falha ao ler indicadores: ${metricsResult.error.message}`);

    const platform = platformResult.data;
    const images = imagesResult.data;
    const existingMetrics = metricsResult.data;

    if (!images?.length) throw new Error("Nenhum print anexado");

    const { error: extractingError } = await supabase
      .from("indicator_submissions")
      .update({ status: "extracting" })
      .eq("id", submissionId);
    if (extractingError) throw new Error(`Falha ao iniciar extração: ${extractingError.message}`);

    const known = (existingMetrics || []).map((m: any) => ({
      name: m.name,
      unit: m.unit,
      section: m.source_section,
      key: m.metric_key,
    }));

    const prompt = `Analise os prints da plataforma ${platform?.name || ""} e extraia TODOS os indicadores de desempenho atuais e principais visíveis.
Indicadores já conhecidos: ${JSON.stringify(known)}
Regras:
- Não invente valores.
- Ignore datas, horários, IDs, menus, metas isoladas, valores anteriores e números decorativos.
- Reutilize o mesmo nome de indicador conhecido quando for claramente o mesmo conceito.
- name deve ser curto e estável.
- section deve ser curta ou null.
- unit deve ser exatamente %, R$, nota, dias, pontos ou number.
- value deve ser numérico. Ex.: 0,42% => 0.42; 4,83/5 => 4.83; R$ 1.234,56 => 1234.56.
- confidence entre 0 e 1.
- raw_text deve trazer um trecho curto do print associado ao valor.
Retorne somente JSON no formato: {"metrics":[{"name":"","section":null,"unit":"%","value":0,"confidence":0.9,"raw_text":""}],"warnings":[]}`;

    const parts: any[] = [{ text: prompt }];
    for (const image of images) parts.push(await getImagePart(image.image_url));

    const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.6-flash";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini retornou ${response.status}: ${errorText}`);
    }

    const ai = await response.json();
    const raw = ai?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("").trim();
    if (!raw) {
      const finishReason = ai?.candidates?.[0]?.finishReason || ai?.promptFeedback?.blockReason || "sem conteúdo";
      throw new Error(`Gemini não retornou conteúdo (${finishReason})`);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Gemini retornou JSON inválido: ${raw.slice(0, 300)}`);
    }

    const discovered: any[] = [];
    const seen = new Set<string>();

    for (let index = 0; index < (parsed.metrics || []).length; index++) {
      const item = parsed.metrics[index];
      const name = String(item.name || "").trim();
      const section = item.section ? String(item.section).trim() : null;
      const value = Number(item.value);
      const unit = String(item.unit || "number");
      if (!name || !Number.isFinite(value)) continue;

      const key = metricKey(name, section);
      if (seen.has(key)) continue;
      seen.add(key);

      let definition = (existingMetrics || []).find((m: any) => m.metric_key === key);
      if (!definition) {
        const { data: created, error } = await supabase
          .from("indicator_definitions")
          .insert({
            platform_id: submission.platform_id,
            name,
            unit,
            direction: "neutral",
            weekly_aggregation: "last",
            display_order: (existingMetrics?.length || 0) + index + 1,
            metric_key: key,
            source_section: section,
            auto_discovered: true,
            created_by: userData.user.id,
            active: true,
          })
          .select("id,name,unit,metric_key,source_section,display_order")
          .single();
        if (error) throw new Error(`Falha ao salvar indicador "${name}": ${error.message}`);
        definition = created;
      }

      discovered.push({
        indicator_id: definition.id,
        name: definition.name,
        section: definition.source_section,
        unit: definition.unit,
        found: true,
        value,
        confidence: Math.max(0, Math.min(1, Number(item.confidence ?? 0.75))),
        raw_text: String(item.raw_text || "").slice(0, 300),
      });
    }

    const warnings = Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [];
    if (!discovered.length) warnings.push("O Gemini analisou os prints, mas não encontrou indicadores numéricos confiáveis.");

    for (const image of images) {
      const { error } = await supabase.from("indicator_submission_images").update({
        extraction_status: "processed",
        extraction_json: { provider: "gemini", model, extracted_metrics: discovered.length },
      }).eq("id", image.id);
      if (error) throw new Error(`Falha ao registrar leitura do print: ${error.message}`);
    }

    const { error: finishError } = await supabase.from("indicator_submissions").update({
      status: "extracted",
      extracted_at: new Date().toISOString(),
      extraction_warnings: warnings,
    }).eq("id", submissionId);
    if (finishError) throw new Error(`Falha ao finalizar extração: ${finishError.message}`);

    return new Response(JSON.stringify({ ok: true, metrics: discovered, warnings, provider: "gemini", model }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("extract-indicators:", message);

    // Durante a fase de integração, devolvemos 200 com ok=false para o supabase-js
    // não substituir o corpo útil por "Edge Function returned a non-2xx status code".
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
