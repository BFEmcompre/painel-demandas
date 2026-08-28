export type PresentationMetric = {
  id: string;
  name: string;
  unit?: string;
};

export type PresentationImage = {
  id: string;
  image_url: string;
  original_name?: string | null;
};

export type PresentationBlockInsert = {
  report_id: string;
  block_type: 'kpi' | 'chart' | 'image' | 'text' | 'insight' | 'divider';
  title: string | null;
  content: Record<string, unknown>;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  style: Record<string, unknown>;
};

const accents = ['emerald', 'cyan', 'violet', 'amber', 'rose', 'blue'];

export function buildSmartPresentationBlocks(
  reportId: string,
  metrics: PresentationMetric[],
  images: PresentationImage[],
): PresentationBlockInsert[] {
  const blocks: PresentationBlockInsert[] = [];
  let z = 1;

  const push = (block: Omit<PresentationBlockInsert, 'report_id' | 'z_index'>) => {
    blocks.push({ report_id: reportId, z_index: z++, ...block });
  };

  push({
    block_type: 'text',
    title: 'Resumo executivo',
    content: {
      text: 'Visão consolidada dos principais indicadores, com comparação automática contra o último período válido.',
    },
    x: 4,
    y: 4,
    width: 92,
    height: 11,
    style: { page: 1, variant: 'hero', accent: 'emerald', depth: 3, radius: 26 },
  });

  metrics.slice(0, 4).forEach((metric, index) => {
    push({
      block_type: 'kpi',
      title: metric.name,
      content: { indicator_id: metric.id, comparison_mode: 'previous', show_previous: true },
      x: 4 + index * 23,
      y: 19,
      width: 21,
      height: 22,
      style: { page: 1, accent: accents[index % accents.length], depth: 2, radius: 22 },
    });
  });

  if (metrics[0]) {
    push({
      block_type: 'chart',
      title: `Comparativo • ${metrics[0].name}`,
      content: { indicator_id: metrics[0].id, chart_type: 'comparison', comparison_mode: 'previous', period_days: 30 },
      x: 4,
      y: 45,
      width: 43,
      height: 45,
      style: { page: 1, accent: 'cyan', depth: 2, radius: 24 },
    });
  }

  if (metrics[1] || metrics[0]) {
    const metric = metrics[1] || metrics[0];
    push({
      block_type: 'chart',
      title: `Evolução • ${metric.name}`,
      content: { indicator_id: metric.id, chart_type: 'area', comparison_mode: 'week', period_days: 30 },
      x: 53,
      y: 45,
      width: 43,
      height: 45,
      style: { page: 1, accent: 'emerald', depth: 2, radius: 24 },
    });
  }

  let page = 2;
  const remaining = metrics.slice(4);
  for (let offset = 0; offset < remaining.length; offset += 6) {
    const chunk = remaining.slice(offset, offset + 6);
    push({
      block_type: 'text',
      title: 'Indicadores detalhados',
      content: { text: `Detalhamento dos indicadores ${offset + 5} a ${offset + chunk.length + 4}.` },
      x: 4,
      y: 4,
      width: 92,
      height: 10,
      style: { page, variant: 'section', accent: 'violet', depth: 2, radius: 24 },
    });

    chunk.forEach((metric, index) => {
      const row = Math.floor(index / 3);
      const column = index % 3;
      push({
        block_type: 'kpi',
        title: metric.name,
        content: { indicator_id: metric.id, comparison_mode: 'previous', show_previous: true },
        x: 4 + column * 31,
        y: 18 + row * 20,
        width: 28,
        height: 17,
        style: { page, accent: accents[(offset + index + 2) % accents.length], depth: 2, radius: 20 },
      });
    });

    if (chunk[0]) {
      push({
        block_type: 'chart',
        title: `Tendência • ${chunk[0].name}`,
        content: { indicator_id: chunk[0].id, chart_type: 'area', comparison_mode: 'week', period_days: 30 },
        x: 4,
        y: 61,
        width: 44,
        height: 34,
        style: { page, accent: 'cyan', depth: 2, radius: 22 },
      });
    }

    if (chunk[1] || chunk[0]) {
      const metric = chunk[1] || chunk[0];
      push({
        block_type: 'chart',
        title: `Período • ${metric.name}`,
        content: { indicator_id: metric.id, chart_type: 'bar', comparison_mode: 'week', period_days: 14 },
        x: 52,
        y: 61,
        width: 44,
        height: 34,
        style: { page, accent: 'violet', depth: 2, radius: 22 },
      });
    }

    page += 1;
  }

  const evidencePage = Math.max(page, 2);
  push({
    block_type: 'text',
    title: 'Evidências e contexto',
    content: {
      text: 'Use esta página para manter os prints originais, registrar observações, causas, impactos e próximos passos.',
    },
    x: 4,
    y: 4,
    width: 92,
    height: 11,
    style: { page: evidencePage, variant: 'section', accent: 'amber', depth: 2, radius: 24 },
  });

  images.slice(0, 3).forEach((image, index) => {
    push({
      block_type: 'image',
      title: image.original_name || `Evidência ${index + 1}`,
      content: { image_id: image.id, image_url: image.image_url },
      x: 4 + index * 31,
      y: 20,
      width: 28,
      height: 51,
      style: { page: evidencePage, accent: 'cyan', depth: 2, radius: 20, object_fit: 'contain' },
    });
  });

  push({
    block_type: 'insight',
    title: 'Observações da apresentação',
    content: {
      text: 'Clique neste bloco no editor e registre o que afetou os indicadores, por que subiram ou caíram e quais ações serão tomadas.',
    },
    x: 4,
    y: images.length ? 75 : 24,
    width: 92,
    height: images.length ? 20 : 62,
    style: { page: evidencePage, accent: 'amber', depth: 2, radius: 22 },
  });

  return blocks;
}
