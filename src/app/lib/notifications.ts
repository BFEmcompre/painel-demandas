import { supabase } from './supabase';

/**
 * Dispara as checagens de avisos com prazo (tarefas, indicadores, demandas ao
 * gestor, trocas pendentes) no banco. Qualquer navegador logado que chame isso
 * periodicamente mantém o sistema de avisos rodando — ver SUPABASE_V6_7_AVISOS.sql.
 */
export async function pollFlowNotifications() {
  const { error } = await supabase.rpc('run_flow_notification_checks');
  if (error) {
    console.error('Falha ao checar avisos:', error.message);
  }
}

export const FLOW_NOTIFICATION_POLL_INTERVAL_MS = 60_000;

export const OVERDUE_TASK_NOTIFICATION_TYPES = ['task_overdue'] as const;
