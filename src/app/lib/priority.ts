// Escala de prioridade das demandas: 1 = máxima, 3/4 = média, 5 = baixa.
export type PriorityLevel = 1 | 2 | 3 | 4 | 5;

export const PRIORITY_LEVELS: PriorityLevel[] = [1, 2, 3, 4, 5];

export const DEFAULT_PRIORITY: PriorityLevel = 3;

export const PRIORITY_LABEL: Record<PriorityLevel, string> = {
  1: 'Máxima',
  2: 'Alta',
  3: 'Média',
  4: 'Média',
  5: 'Baixa',
};

// Classes usadas em badges/selos de prioridade (funciona em light e dark).
export const PRIORITY_BADGE_CLASS: Record<PriorityLevel, string> = {
  1: 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
  2: 'bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20',
  3: 'bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/20',
  4: 'bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/20',
  5: 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20',
};

// Classes usadas como faixa lateral (border-l) nos cards de tarefa.
export const PRIORITY_BORDER_CLASS: Record<PriorityLevel, string> = {
  1: 'border-l-4 border-l-red-500',
  2: 'border-l-4 border-l-orange-500',
  3: 'border-l-4 border-l-yellow-500',
  4: 'border-l-4 border-l-yellow-500',
  5: 'border-l-4 border-l-green-500',
};

export function priorityLabel(priority?: number | null): string {
  const p = normalizePriority(priority);
  return `P${p} · ${PRIORITY_LABEL[p]}`;
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
  const p = Number(priority);
  if (!p || p < 1) return DEFAULT_PRIORITY;
  if (p > 5) return 5;
  return Math.round(p) as PriorityLevel;
}

// Ordena por prioridade (1 primeiro) e, em empate, pelo horário limite mais próximo.
export function sortByPriorityThenDeadline<
  T extends { priority?: number | null; deadline: string }
>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const diff = normalizePriority(a.priority) - normalizePriority(b.priority);
    if (diff !== 0) return diff;
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });
}
