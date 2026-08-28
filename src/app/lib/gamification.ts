import { supabase } from './supabase';

export type RewardSettings = {
  id: string;
  is_active: boolean;
  base_completion_points: number;
  on_time_bonus_points: number;
  early_bonus_points: number;
  early_cutoff: string;
  late_penalty_points: number;
  p1_multiplier: number;
  p2_multiplier: number;
  p3_multiplier: number;
  p4_multiplier: number;
  p5_multiplier: number;
  updated_at?: string;
};

const defaultRewardSettings: RewardSettings = {
  id: 'default',
  is_active: true,
  base_completion_points: 10,
  on_time_bonus_points: 5,
  early_bonus_points: 8,
  early_cutoff: '12:00:00',
  late_penalty_points: 4,
  p1_multiplier: 1.7,
  p2_multiplier: 1.45,
  p3_multiplier: 1.2,
  p4_multiplier: 1,
  p5_multiplier: 0.85,
};

function getTimeMinutes(value?: string | null) {
  if (!value) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function toSafeDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getPriorityMultiplier(priority: number | null | undefined, settings: RewardSettings) {
  switch (Number(priority ?? 3)) {
    case 1:
      return Number(settings.p1_multiplier ?? defaultRewardSettings.p1_multiplier);
    case 2:
      return Number(settings.p2_multiplier ?? defaultRewardSettings.p2_multiplier);
    case 3:
      return Number(settings.p3_multiplier ?? defaultRewardSettings.p3_multiplier);
    case 4:
      return Number(settings.p4_multiplier ?? defaultRewardSettings.p4_multiplier);
    case 5:
      return Number(settings.p5_multiplier ?? defaultRewardSettings.p5_multiplier);
    default:
      return 1;
  }
}

export async function loadActiveRewardSettings(): Promise<RewardSettings> {
  const { data } = await supabase
    .from('reward_settings')
    .select('*')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    ...defaultRewardSettings,
    ...(data || {}),
  };
}

export async function applyWalletMutation({
  userId,
  amount,
  category,
}: {
  userId: string;
  amount: number;
  category: string;
}) {
  const { data: existing } = await supabase
    .from('user_point_wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const available = Number(existing?.available_points || 0);
  const lifetime = Number(existing?.lifetime_points || 0);
  const redeemed = Number(existing?.redeemed_points || 0);
  const lost = Number(existing?.lost_points || 0);

  const payload = {
    user_id: userId,
    available_points: available + amount,
    lifetime_points: lifetime + (amount > 0 ? amount : 0),
    redeemed_points:
      redeemed + (category === 'shop_redemption' ? Math.abs(Math.min(amount, 0)) : 0),
    lost_points:
      lost + (category === 'task_penalty' ? Math.abs(Math.min(amount, 0)) : 0),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('user_point_wallets').upsert(payload, {
    onConflict: 'user_id',
  });

  return { error };
}

export async function awardTaskCompletionPoints({
  taskId,
  title,
  priority,
  deadline,
  completedAt,
  userId,
}: {
  taskId: string;
  title: string;
  priority?: number | null;
  deadline?: string | null;
  completedAt?: string | null;
  userId: string;
}) {
  const { data: alreadyAwarded } = await supabase
    .from('points_ledger')
    .select('id')
    .eq('user_id', userId)
    .eq('task_id', taskId)
    .eq('category', 'task_completion')
    .maybeSingle();

  if (alreadyAwarded) {
    return { skipped: true, totalAwarded: 0, reason: 'already_awarded' };
  }

  const settings = await loadActiveRewardSettings();
  const multiplier = getPriorityMultiplier(priority, settings);
  const base = Math.round(Number(settings.base_completion_points || 0) * multiplier);

  const completedDate = toSafeDate(completedAt) || new Date();
  const deadlineDate = toSafeDate(deadline);

  let total = base;
  const breakdown: Record<string, any> = {
    taskTitle: title,
    base,
    multiplier,
    priority: Number(priority ?? 3),
  };

  if (deadlineDate && completedDate.getTime() <= deadlineDate.getTime()) {
    total += Number(settings.on_time_bonus_points || 0);
    breakdown.onTimeBonus = Number(settings.on_time_bonus_points || 0);
  }

  const completedMinutes = completedDate.getHours() * 60 + completedDate.getMinutes();
  const cutoffMinutes = getTimeMinutes(settings.early_cutoff);
  if (cutoffMinutes !== null && completedMinutes <= cutoffMinutes) {
    total += Number(settings.early_bonus_points || 0);
    breakdown.earlyBonus = Number(settings.early_bonus_points || 0);
  }

  if (deadlineDate && completedDate.getTime() > deadlineDate.getTime()) {
    total -= Number(settings.late_penalty_points || 0);
    breakdown.latePenalty = Number(settings.late_penalty_points || 0);
  }

  const category = total >= 0 ? 'task_completion' : 'task_penalty';

  const { error: ledgerError } = await supabase.from('points_ledger').insert({
    user_id: userId,
    task_id: taskId,
    amount: total,
    category,
    reason: total >= 0 ? 'Conclusão de tarefa' : 'Penalidade por atraso na tarefa',
    metadata: {
      ...breakdown,
      deadline,
      completedAt: completedDate.toISOString(),
    },
  });

  if (ledgerError) {
    return { skipped: false, totalAwarded: 0, reason: ledgerError.message, error: ledgerError };
  }

  const { error: walletError } = await applyWalletMutation({
    userId,
    amount: total,
    category,
  });

  return {
    skipped: false,
    totalAwarded: total,
    reason: walletError?.message,
    error: walletError || null,
  };
}

export async function redeemRewardItem({
  userId,
  itemId,
  itemName,
  pointsCost,
}: {
  userId: string;
  itemId: string;
  itemName: string;
  pointsCost: number;
}) {
  const { data: wallet } = await supabase
    .from('user_point_wallets')
    .select('available_points')
    .eq('user_id', userId)
    .maybeSingle();

  if (Number(wallet?.available_points || 0) < Number(pointsCost || 0)) {
    return { error: new Error('Saldo insuficiente') };
  }

  const { data: item, error: itemError } = await supabase
    .from('reward_catalog_items')
    .select('id, stock, is_active')
    .eq('id', itemId)
    .maybeSingle();

  if (itemError || !item || item.is_active === false) {
    return { error: itemError || new Error('Item indisponível') };
  }

  if (item.stock !== null && item.stock !== undefined && Number(item.stock) <= 0) {
    return { error: new Error('Sem estoque no momento') };
  }

  const { data: redemption, error: redemptionError } = await supabase
    .from('reward_redemptions')
    .insert({
      user_id: userId,
      item_id: itemId,
      points_spent: pointsCost,
      item_snapshot_name: itemName,
      status: 'pending',
    })
    .select('*')
    .single();

  if (redemptionError || !redemption) {
    return { error: redemptionError || new Error('Não foi possível criar o resgate') };
  }

  await supabase.from('points_ledger').insert({
    user_id: userId,
    reward_redemption_id: redemption.id,
    amount: -Math.abs(pointsCost),
    category: 'shop_redemption',
    reason: `Troca por ${itemName}`,
    metadata: { itemId, itemName, pointsCost },
  });

  await applyWalletMutation({
    userId,
    amount: -Math.abs(pointsCost),
    category: 'shop_redemption',
  });

  if (item.stock !== null && item.stock !== undefined) {
    await supabase
      .from('reward_catalog_items')
      .update({ stock: Math.max(Number(item.stock) - 1, 0), updated_at: new Date().toISOString() })
      .eq('id', itemId);
  }

  return { data: redemption, error: null };
}

export async function refundRedemption(redemptionId: string) {
  const { data: redemption } = await supabase
    .from('reward_redemptions')
    .select('id, user_id, item_id, points_spent, item_snapshot_name, status')
    .eq('id', redemptionId)
    .maybeSingle();

  if (!redemption || redemption.status === 'cancelled') {
    return { error: null };
  }

  await supabase
    .from('reward_redemptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', redemptionId);

  await supabase.from('points_ledger').insert({
    user_id: redemption.user_id,
    reward_redemption_id: redemption.id,
    amount: Math.abs(Number(redemption.points_spent || 0)),
    category: 'refund',
    reason: `Estorno do resgate: ${redemption.item_snapshot_name || 'item'}`,
    metadata: { redemptionId },
  });

  await applyWalletMutation({
    userId: redemption.user_id,
    amount: Math.abs(Number(redemption.points_spent || 0)),
    category: 'refund',
  });

  const { data: item } = await supabase
    .from('reward_catalog_items')
    .select('id, stock')
    .eq('id', redemption.item_id)
    .maybeSingle();

  if (item && item.stock !== null && item.stock !== undefined) {
    await supabase
      .from('reward_catalog_items')
      .update({ stock: Number(item.stock) + 1, updated_at: new Date().toISOString() })
      .eq('id', item.id);
  }

  return { error: null };
}
