export type OcrImageInput = {
  id: string;
  image_url: string;
  original_name?: string | null;
};

export type OcrMetricCandidate = {
  key: string;
  name: string;
  section: string | null;
  unit: string;
  value: number;
  confidence: number;
  raw_text: string;
  image_id: string;
};

export type OcrProgress = {
  imageIndex: number;
  imageCount: number;
  progress: number;
  status: string;
};

const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.esm.min.js';

let tesseractModulePromise: Promise<any> | null = null;

async function loadTesseract() {
  if (!tesseractModulePromise) {
    tesseractModulePromise = import(/* @vite-ignore */ TESSERACT_URL);
  }
  return tesseractModulePromise;
}

export function normalizeMetricKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(atual|hoje|resultado|valor)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
}

function cleanLine(value: string) {
  return value.replace(/[\t\u00a0]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function hasUsefulLetters(value: string) {
  return (value.match(/[A-Za-zÀ-ÿ]/g) || []).length >= 3;
}

function cleanName(value: string) {
  return value
    .replace(/^[\s:;|•·–—-]+/, '')
    .replace(/[\s:;|•·–—-]+$/, '')
    .replace(/\b(valor atual|resultado atual|resultado|atual|hoje)\b\s*[:\-]?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isBadName(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (!normalized || normalized.length < 3 || normalized.length > 110) return true;
  if (/^(meta|objetivo|alvo|anterior|periodo anterior|variacao|comparacao|data|hora)$/.test(normalized)) return true;
  if (/^(de|ate|desde|ultimos?|ultima|primeiro|segundo)\s+\d+/.test(normalized)) return true;
  return false;
}

function looksLikeDateOrTime(line: string) {
  return (
    /\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/.test(line) ||
    /\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(line)
  );
}

const NUMBER_RE = /(?:R\$\s*)?[+\-]?\d+(?:[.\s]\d{3})*(?:[.,]\d+)?\s*(?:%|p\.?\s*p\.?|\/\s*5|dias?|pontos?)?/i;

function parseNumber(token: string) {
  let value = token
    .replace(/R\$/gi, '')
    .replace(/%/g, '')
    .replace(/p\.?\s*p\.?/gi, '')
    .replace(/\/\s*5/g, '')
    .replace(/dias?/gi, '')
    .replace(/pontos?/gi, '')
    .replace(/\s+/g, '')
    .trim();

  if (!value) return null;

  if (value.includes(',') && value.includes('.')) {
    value = value.replace(/\./g, '').replace(',', '.');
  } else if (value.includes(',')) {
    value = value.replace(',', '.');
  } else if ((value.match(/\./g) || []).length > 1) {
    value = value.replace(/\./g, '');
  } else if (/^[-+]?\d{1,3}\.\d{3}$/.test(value)) {
    // Em telas em pt-BR, 1.234 normalmente e milhar, nao decimal.
    value = value.replace('.', '');
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function detectUnit(token: string, line: string, name: string) {
  if (/%/.test(token)) return '%';
  if (/R\$/i.test(token) || /R\$/i.test(line)) return 'R$';
  if (/\/\s*5/.test(token) || /\b(nota|avaliacao|avaliação|rating)\b/i.test(`${name} ${line}`)) return 'nota';
  if (/\bdias?\b/i.test(token) || /\bdias?\b/i.test(line)) return 'dias';
  if (/\bpontos?\b/i.test(token) || /\bpontos?\b/i.test(line)) return 'pontos';
  if (/p\.?\s*p\.?/i.test(token)) return 'p.p.';
  return 'number';
}

function previousTextLine(lines: string[], index: number, skip = 0) {
  let found = 0;
  for (let cursor = index - 1; cursor >= 0 && cursor >= index - 4; cursor -= 1) {
    const line = lines[cursor];
    if (!line || NUMBER_RE.test(line) || !hasUsefulLetters(line)) continue;
    if (found < skip) {
      found += 1;
      continue;
    }
    return cleanName(line);
  }
  return '';
}

function parseText(text: string, imageId: string, baseConfidence: number) {
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const candidates: OcrMetricCandidate[] = [];

  lines.forEach((line, index) => {
    const match = NUMBER_RE.exec(line);
    if (!match) return;

    const token = match[0].trim();
    const value = parseNumber(token);
    if (value === null) return;

    const hasSemanticUnit = /%|R\$|\/\s*5|p\.?\s*p\.?|dias?|pontos?/i.test(token);
    if (looksLikeDateOrTime(line) && !hasSemanticUnit) return;

    const before = cleanName(line.slice(0, match.index));
    const after = cleanName(line.slice(match.index + match[0].length));

    let name = hasUsefulLetters(before) ? before : '';
    if (!name && hasUsefulLetters(after) && after.length <= 90) name = after;
    if (!name) name = previousTextLine(lines, index);
    name = cleanName(name);

    if (!hasUsefulLetters(name) || isBadName(name)) return;
    if (/^(meta|objetivo|alvo)\b/i.test(name)) return;

    const key = normalizeMetricKey(name);
    if (!key || key.length < 3) return;

    const sectionCandidate = previousTextLine(lines, index, name === previousTextLine(lines, index) ? 1 : 0);
    const section = sectionCandidate && normalizeMetricKey(sectionCandidate) !== key ? sectionCandidate : null;
    const unit = detectUnit(token, line, name);

    let confidence = Math.max(0.45, Math.min(0.96, baseConfidence));
    if (hasSemanticUnit) confidence = Math.min(0.98, confidence + 0.05);
    if (!hasUsefulLetters(before) && !hasUsefulLetters(after)) confidence = Math.max(0.45, confidence - 0.08);

    candidates.push({
      key,
      name,
      section,
      unit,
      value,
      confidence,
      raw_text: line.slice(0, 220),
      image_id: imageId,
    });
  });

  return candidates;
}

function dedupeCandidates(input: OcrMetricCandidate[]) {
  const byKey = new Map<string, OcrMetricCandidate>();
  const warnings: string[] = [];

  for (const candidate of input) {
    const existing = byKey.get(candidate.key);
    if (!existing) {
      byKey.set(candidate.key, candidate);
      continue;
    }

    if (existing.value !== candidate.value) {
      warnings.push(`Mais de um valor foi lido para “${candidate.name}”. Confira antes de confirmar.`);
    }

    if (candidate.confidence > existing.confidence) byKey.set(candidate.key, candidate);
  }

  return { metrics: Array.from(byKey.values()), warnings: Array.from(new Set(warnings)) };
}

export async function extractIndicatorsLocally(
  images: OcrImageInput[],
  onProgress?: (progress: OcrProgress) => void,
) {
  const Tesseract = await loadTesseract();
  let activeImage = 0;

  const worker = await Tesseract.createWorker('por+eng', undefined, {
    logger: (message: any) => {
      const raw = Number(message?.progress || 0);
      onProgress?.({
        imageIndex: Math.min(activeImage + 1, images.length),
        imageCount: images.length,
        progress: Number.isFinite(raw) ? raw : 0,
        status: String(message?.status || 'Lendo imagem'),
      });
    },
  });

  const allCandidates: OcrMetricCandidate[] = [];
  const imageResults: Array<{ image_id: string; text: string; metrics: OcrMetricCandidate[] }> = [];

  try {
    for (let index = 0; index < images.length; index += 1) {
      activeImage = index;
      onProgress?.({ imageIndex: index + 1, imageCount: images.length, progress: 0, status: 'Preparando print' });

      const result = await worker.recognize(images[index].image_url);
      const text = String(result?.data?.text || '');
      const baseConfidence = Math.max(0.45, Math.min(0.95, Number(result?.data?.confidence || 70) / 100));
      const metrics = parseText(text, images[index].id, baseConfidence);

      allCandidates.push(...metrics);
      imageResults.push({ image_id: images[index].id, text, metrics });
    }
  } finally {
    await worker.terminate();
  }

  const deduped = dedupeCandidates(allCandidates);
  if (!deduped.metrics.length) {
    deduped.warnings.push('O OCR leu os prints, mas não encontrou pares claros de nome + valor. Tente um print com melhor resolução ou recorte mais próximo dos indicadores.');
  }

  return {
    metrics: deduped.metrics,
    warnings: deduped.warnings,
    imageResults,
  };
}
