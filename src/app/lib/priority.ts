// Escala de prioridade das demandas: 1 = máxima, 3/4 = média, 5 = baixa, 0 = nenhuma definida.
export type PriorityLevel = 0 | 1 | 2 | 3 | 4 | 5;

// Ordem de exibição nos seletores: mais urgente primeiro, "Nenhuma" por último.
export const PRIORITY_LEVELS: PriorityLevel[] = [1, 2, 3, 5, 0];

export const DEFAULT_PRIORITY: PriorityLevel = 0;

export const PRIORITY_LABEL: Record<PriorityLevel, string> = {
  0: 'Nenhuma',
  1: 'Máxima',
  2: 'Alta',
  3: 'Média',
  4: 'Média',
  5: 'Baixa',
};

// Classes usadas em badges/selos de prioridade (funciona em light e dark).
export const PRIORITY_BADGE_CLASS: Record<PriorityLevel, string> = {
  0: 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-white/5 dark:text-[#8A8A8A] dark:border-white/10',
  1: 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
  2: 'bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20',
  3: 'bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/20',
  4: 'bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/20',
  5: 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20',
};

// Classes usadas como faixa lateral (border-l) nos cards de tarefa.
export const PRIORITY_BORDER_CLASS: Record<PriorityLevel, string> = {
  0: 'border-l-4 border-l-gray-300 dark:border-l-white/10',
  1: 'border-l-4 border-l-red-500',
  2: 'border-l-4 border-l-orange-500',
  3: 'border-l-4 border-l-yellow-500',
  4: 'border-l-4 border-l-yellow-500',
  5: 'border-l-4 border-l-green-500',
};

export function priorityLabel(priority?: number | null): string {
  const p = normalizePriority(priority);
  return PRIORITY_LABEL[p];
}

export function priorityBadgeClass(priority?: number | null): string {
  const p = normalizePriority(priority);
  return PRIORITY_BADGE_CLASS[p];
}

export function priorityBorderClass(priority?: number | null): string {
  const p = normalizePriority(priority);
  return PRIORITY_BORDER_CLASS[p];
}

export function normalizePriority(priority?: number | null): PriorityLevel {
  if (priority === null || priority === undefined) return 0;
  const p = Math.round(Number(priority));
  if (!Number.isFinite(p) || p <= 0) return 0;
  if (p > 5) return 5;
  return p as PriorityLevel;
}

// Peso usado só pra ordenação: "Nenhuma" sempre por último, depois das demais por urgência.
function prioritySortWeight(priority?: number | null): number {
  const p = normalizePriority(priority);
  return p === 0 ? 99 : p;
}

// Ordena por prioridade (1 primeiro, "Nenhuma" por último) e, em empate, pelo horário limite mais próximo.
export function sortByPriorityThenDeadline<
  T extends { priority?: number | null; deadline: string }
>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const diff = prioritySortWeight(a.priority) - prioritySortWeight(b.priority);
    if (diff !== 0) return diff;
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });
}
