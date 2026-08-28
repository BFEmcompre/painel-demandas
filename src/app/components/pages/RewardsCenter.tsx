import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  Crown,
  Gift,
  ImagePlus,
  LoaderCircle,
  Medal,
  Minus,
  PackageCheck,
  Pencil,
  Plus,
  Save,
  Search,
  ShoppingCart,
  Sparkles,
  Trash2,
  TrafficCone,
  Trophy,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '../../lib/supabase';
import { loadActiveRewardSettings, type RewardSettings } from '../../lib/gamification';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';

type Profile = {
  id: string;
  name: string;
  role: string;
  avatar_url?: string | null;
};

type Wallet = {
  available_points: number;
  lifetime_points: number;
  redeemed_points: number;
  lost_points: number;
};

type ShopItem = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  points_cost: number;
  stock: number | null;
  is_active: boolean;
  created_at: string;
};

type Redemption = {
  id: string;
  item_id: string;
  user_id: string;
  quantity: number;
  points_spent: number;
  status: 'pending' | 'approved' | 'delivered' | 'cancelled';
  item_snapshot_name: string | null;
  cart_group_id: string | null;
  created_at: string;
  updated_at?: string | null;
  profiles?: { name: string; avatar_url?: string | null } | null;
};

type LeaderboardRow = {
  user_id: string;
  available_points: number;
  lifetime_points: number;
  redeemed_points: number;
  lost_points: number;
  profiles?: { name: string; avatar_url?: string | null } | null;
};

type ShopForm = {
  id: string | null;
  name: string;
  description: string;
  image_url: string;
  points_cost: number;
  stock: string;
  is_active: boolean;
};

type CartMap = Record<string, number>;

const emptyShopForm: ShopForm = {
  id: null,
  name: '',
  description: '',
  image_url: '',
  points_cost: 100,
  stock: '',
  is_active: true,
};

function isAdminRole(role?: string) {
  return ['manager', 'admin', 'gestor'].includes(String(role).toLowerCase());
}

function initials(name?: string | null) {
  if (!name) return 'FL';
  const letters = name
    .split(' ')
    .map((part) => part.trim())
    .filter((part) => /[a-zA-ZÀ-ÖØ-öø-ÿ]/.test(part[0] || ''))
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
  return letters || 'FL';
}

function statusLabel(status: Redemption['status']) {
  switch (status) {
    case 'approved':
      return 'Aprovado para retirada';
    case 'delivered':
      return 'Entregue';
    case 'cancelled':
      return 'Cancelado';
    default:
      return 'Aguardando aprovação';
  }
}

export function RewardsCenter() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet>({
    available_points: 0,
    lifetime_points: 0,
    redeemed_points: 0,
    lost_points: 0,
  });
  const [settings, setSettings] = useState<RewardSettings | null>(null);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [shopForm, setShopForm] = useState<ShopForm>(emptyShopForm);
  const [cart, setCart] = useState<CartMap>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [uploadingProduct, setUploadingProduct] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const isAdmin = isAdminRole(profile?.role);

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`flow-marketplace-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reward_redemptions' }, () => void loadData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reward_catalog_items' }, () => void loadData(true))
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [profile?.id]);

  async function loadData(silent = false) {
    if (!silent) setLoading(true);

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setLoading(false);
      return;
    }

    const userId = authData.user.id;

    const [{ data: profileData }, activeSettings] = await Promise.all([
      supabase.from('profiles').select('id, name, role, avatar_url').eq('id', userId).single(),
      loadActiveRewardSettings(),
    ]);

    const nextProfile = profileData as Profile | null;
    const nextIsAdmin = isAdminRole(nextProfile?.role);
    if (nextProfile) setProfile(nextProfile);
    setSettings(activeSettings);

    const [walletResult, shopResult, leaderboardResult, allProfilesResult, redemptionResult] = await Promise.all([
      supabase.from('user_point_wallets').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('reward_catalog_items').select('*').order('created_at', { ascending: false }),
      supabase
        .from('user_point_wallets')
        .select('user_id, available_points, lifetime_points, redeemed_points, lost_points, profiles(name, avatar_url)')
        .order('available_points', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, name, avatar_url, role')
        .order('name'),
      nextIsAdmin
        ? supabase
            .from('reward_redemptions')
            .select('id, item_id, user_id, quantity, points_spent, status, item_snapshot_name, cart_group_id, created_at, updated_at, profiles(name, avatar_url)')
            .order('created_at', { ascending: false })
        : supabase
            .from('reward_redemptions')
            .select('id, item_id, user_id, quantity, points_spent, status, item_snapshot_name, cart_group_id, created_at, updated_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }),
    ]);

    const walletData = walletResult.data;
    setWallet({
      available_points: Number(walletData?.available_points || 0),
      lifetime_points: Number(walletData?.lifetime_points || 0),
      redeemed_points: Number(walletData?.redeemed_points || 0),
      lost_points: Number(walletData?.lost_points || 0),
    });
    setItems((shopResult.data || []) as ShopItem[]);

    const walletRows = (leaderboardResult.data || []) as unknown as LeaderboardRow[];
    const walletByUser = new Map(walletRows.map((row) => [row.user_id, row]));
    const mergedLeaderboard = (allProfilesResult.data || [])
      .map((person: any) => {
        const walletRow = walletByUser.get(person.id);
        return {
          user_id: person.id,
          available_points: Number(walletRow?.available_points || 0),
          lifetime_points: Number(walletRow?.lifetime_points || 0),
          redeemed_points: Number(walletRow?.redeemed_points || 0),
          lost_points: Number(walletRow?.lost_points || 0),
          profiles: {
            name: person.name || 'Usuário',
            avatar_url: person.avatar_url || null,
          },
        } as LeaderboardRow;
      })
      .sort((a: LeaderboardRow, b: LeaderboardRow) =>
        b.available_points - a.available_points ||
        b.lifetime_points - a.lifetime_points ||
        String(a.profiles?.name || '').localeCompare(String(b.profiles?.name || ''), 'pt-BR')
      );

    setLeaderboard(mergedLeaderboard);
    setRedemptions((redemptionResult.data || []) as unknown as Redemption[]);
    if (!silent) setLoading(false);
  }

  const activeItems = useMemo(
    () =>
      items.filter((item) => {
        if (!item.is_active) return false;
        const term = search.trim().toLowerCase();
        if (!term) return true;
        return `${item.name} ${item.description || ''}`.toLowerCase().includes(term);
      }),
    [items, search],
  );

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, quantity]) => {
          const item = items.find((candidate) => candidate.id === id);
          return item ? { item, quantity } : null;
        })
        .filter(Boolean) as Array<{ item: ShopItem; quantity: number }>,
    [cart, items],
  );

  const cartCount = cartItems.reduce((total, entry) => total + entry.quantity, 0);
  const cartTotal = cartItems.reduce(
    (total, entry) => total + Number(entry.item.points_cost || 0) * entry.quantity,
    0,
  );

  const podium = [leaderboard[1], leaderboard[0], leaderboard[2]];

  const orderGroups = useMemo(() => {
    const groups = new Map<string, Redemption[]>();
    redemptions.forEach((redemption) => {
      const key = redemption.cart_group_id || redemption.id;
      const current = groups.get(key) || [];
      current.push(redemption);
      groups.set(key, current);
    });

    return Array.from(groups.entries()).map(([groupId, rows]) => ({
      groupId,
      rows,
      status: rows[0]?.status || 'pending',
      userName: rows[0]?.profiles?.name || (profile?.id === rows[0]?.user_id ? profile.name : 'Usuário'),
      userAvatar: rows[0]?.profiles?.avatar_url || null,
      createdAt: rows[0]?.created_at,
      total: rows.reduce((sum, row) => sum + Number(row.points_spent || 0), 0),
    }));
  }, [redemptions, profile]);

  function changeQuantity(item: ShopItem, nextQuantity: number) {
    const max = item.stock === null || item.stock === undefined ? 99 : Math.max(0, Number(item.stock));
    const safe = Math.min(Math.max(nextQuantity, 0), max);

    setCart((current) => {
      const next = { ...current };
      if (safe <= 0) delete next[item.id];
      else next[item.id] = safe;
      return next;
    });
  }

  function addToCart(item: ShopItem) {
    if (item.stock !== null && item.stock !== undefined && item.stock <= 0) {
      toast.error('Este item está sem estoque.');
      return;
    }
    changeQuantity(item, (cart[item.id] || 0) + 1);
    toast.success(`${item.name} adicionado ao carrinho.`);
  }

  async function checkoutCart() {
    if (!profile || cartItems.length === 0) return;
    if (wallet.available_points < cartTotal) {
      toast.error('Seu saldo de pontos não é suficiente para este carrinho.');
      return;
    }

    setCheckingOut(true);
    const payload = cartItems.map(({ item, quantity }) => ({ item_id: item.id, quantity }));
    const { error } = await supabase.rpc('request_reward_cart', { p_items: payload });
    setCheckingOut(false);

    if (error) {
      toast.error(error.message || 'Não foi possível enviar a troca.');
      return;
    }

    setCart({});
    setCartOpen(false);
    toast.success('Pedido enviado para aprovação.');
    await loadData();
  }

  async function handleApprove(groupId: string) {
    const { error } = await supabase.rpc('approve_reward_cart', { p_cart_group_id: groupId });
    if (error) {
      toast.error(error.message || 'Não foi possível aprovar.');
      return;
    }
    toast.success('Troca aprovada. O usuário foi notificado.');
    await loadData();
  }

  async function handleCancel(groupId: string) {
    if (!window.confirm('Cancelar esta troca e devolver os pontos ao usuário?')) return;
    const { error } = await supabase.rpc('cancel_reward_cart', { p_cart_group_id: groupId });
    if (error) {
      toast.error(error.message || 'Não foi possível cancelar.');
      return;
    }
    toast.success('Troca cancelada e pontos estornados.');
    await loadData();
  }

  async function handleDelivered(groupId: string) {
    const { error } = await supabase.rpc('deliver_reward_cart', { p_cart_group_id: groupId });
    if (error) {
      toast.error(error.message || 'Não foi possível marcar como entregue.');
      return;
    }
    toast.success('Pedido marcado como entregue.');
    await loadData();
  }

  async function handleSaveSettings() {
    if (!settings) return;
    setSavingSettings(true);
    const { error } = await supabase
      .from('reward_settings')
      .update({ ...settings, updated_at: new Date().toISOString() })
      .eq('id', settings.id);
    setSavingSettings(false);

    if (error) {
      toast.error(error.message || 'Não foi possível salvar as regras.');
      return;
    }

    toast.success('Regras de pontuação atualizadas.');
    await loadData();
  }

  async function uploadProductImage(file: File) {
    setUploadingProduct(true);
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from('flow-shop').upload(path, file, { upsert: false });

    if (error) {
      setUploadingProduct(false);
      toast.error('Não foi possível enviar a imagem. Rode a migration V6 no Supabase.');
      return;
    }

    const { data } = supabase.storage.from('flow-shop').getPublicUrl(path);
    setShopForm((current) => ({ ...current, image_url: data.publicUrl }));
    setUploadingProduct(false);
    toast.success('Imagem adicionada ao produto.');
  }

  function openProductEditor(item?: ShopItem) {
    if (item) {
      setShopForm({
        id: item.id,
        name: item.name,
        description: item.description || '',
        image_url: item.image_url || '',
        points_cost: Number(item.points_cost || 0),
        stock: item.stock == null ? '' : String(item.stock),
        is_active: item.is_active,
      });
    } else {
      setShopForm(emptyShopForm);
    }

    window.requestAnimationFrame(() => {
      document.getElementById('admin-product-editor')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  async function handleSaveItem() {
    if (!shopForm.name.trim()) {
      toast.error('Informe o nome do item.');
      return;
    }

    setSavingItem(true);
    const payload = {
      name: shopForm.name.trim(),
      description: shopForm.description.trim() || null,
      image_url: shopForm.image_url.trim() || null,
      points_cost: Number(shopForm.points_cost || 0),
      stock: shopForm.stock === '' ? null : Number(shopForm.stock),
      is_active: shopForm.is_active,
      updated_at: new Date().toISOString(),
    };

    const result = shopForm.id
      ? await supabase.from('reward_catalog_items').update(payload).eq('id', shopForm.id)
      : await supabase.from('reward_catalog_items').insert(payload);

    setSavingItem(false);
    if (result.error) {
      toast.error(result.error.message || 'Não foi possível salvar o item.');
      return;
    }

    toast.success(shopForm.id ? 'Produto atualizado.' : 'Produto criado.');
    setShopForm(emptyShopForm);
    await loadData();
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flow-loader"><LoaderCircle className="h-7 w-7 animate-spin" /></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30">
          <TrafficCone className="h-11 w-11 text-amber-500" />
        </div>

        <div
          className="w-full max-w-sm -rotate-2 rounded-md border-y-4 border-black/80 bg-[repeating-linear-gradient(45deg,#f5b400,#f5b400_14px,#141414_14px,#141414_28px)] py-2 shadow-lg"
        >
          <p className="text-sm font-black uppercase tracking-widest text-black" style={{ textShadow: '0 1px 0 rgba(255,255,255,.35)' }}>
            Em construção
          </p>
        </div>

        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">
            Recompensas em manutenção
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-[#A1A1A1]">
            Essa tela está passando por ajustes da gestão. Assim que estiver pronta,
            ela volta a ficar disponível pra todo mundo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flow-marketplace mx-auto w-full max-w-[1680px] space-y-7 pb-12">
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flow-kicker">RECOMPENSAS</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight md:text-4xl">Pódio do time</h1>
            <p className="mt-1 text-sm text-[var(--ocean-muted)]">Veja quem está no topo, acompanhe sua pontuação e confira a classificação geral completa.</p>
          </div>
          <div className="flow-wallet-pill">
            <Sparkles className="h-5 w-5" />
            <div>
              <span>Seu saldo</span>
              <strong>{wallet.available_points} pontos</strong>
            </div>
          </div>
        </div>

        <div className="flow-podium-shell">
          <div className="flow-podium-glow" />
          <div className="flow-podium-grid">
            {podium.map((row, index) => {
              const actualPosition = index === 0 ? 2 : index === 1 ? 1 : 3;
              const isFirst = actualPosition === 1;
              return (
                <div key={row?.user_id || `empty-${actualPosition}`} className={`flow-podium-person position-${actualPosition}`}>
                  <div className="flow-podium-avatar-wrap">
                    <span className={`flow-podium-aura aura-${actualPosition}`} aria-hidden="true" />
                    {isFirst && <Crown className="flow-podium-crown" />}
                    {row?.profiles?.avatar_url ? (
                      <img src={row.profiles.avatar_url} alt={row.profiles.name} className="flow-podium-avatar" />
                    ) : (
                      <div className="flow-podium-avatar flow-avatar-fallback">{initials(row?.profiles?.name)}</div>
                    )}
                    <span className="flow-podium-number">{actualPosition}</span>
                  </div>
                  <p className="flow-podium-name">{row?.profiles?.name || 'Lugar disponível'}</p>
                  <p className="flow-podium-points">{row ? `${row.available_points} pts` : '0 pts'}</p>
                  <div className="flow-podium-hovercard">
                    <div><b>Disponível</b><span>{row?.available_points || 0} pts</span></div>
                    <div><b>Histórico</b><span>{row?.lifetime_points || 0} pts</span></div>
                    <div><b>Resgatado</b><span>{row?.redeemed_points || 0} pts</span></div>
                    <div><b>Perdido</b><span>{row?.lost_points || 0} pts</span></div>
                  </div>
                  <div className={`flow-podium-base base-${actualPosition}`}>
                    {isFirst ? <Trophy className="h-7 w-7" /> : <Medal className="h-6 w-6" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flow-leaderboard-panel">
          <div className="flow-leaderboard-panel-head">
            <div>
              <p className="flow-kicker">CLASSIFICAÇÃO GERAL</p>
              <h2>Todos os colocados</h2>
            </div>
            <span>{leaderboard.length} participante(s)</span>
          </div>

          {leaderboard.length === 0 ? (
            <div className="flow-market-empty"><Trophy className="h-7 w-7" /><p>Nenhuma pontuação registrada até agora.</p></div>
          ) : (
            <div className="flow-leaderboard-stack">
              {leaderboard.map((row, index) => {
                const rank = index + 1;
                const isTop = rank === 1;
                return (
                  <article key={row.user_id} className={`flow-leaderboard-card ${isTop ? 'is-top' : ''}`}>
                    <div className="flow-leaderboard-main">
                      <span className="flow-leaderboard-place">{rank}º</span>
                      <div className="flow-leaderboard-avatar-wrap">
                        {row.profiles?.avatar_url ? (
                          <img src={row.profiles.avatar_url} alt={row.profiles.name} className="flow-leaderboard-avatar" />
                        ) : (
                          <div className="flow-leaderboard-avatar flow-avatar-fallback">{initials(row.profiles?.name)}</div>
                        )}
                        {isTop && <span className="flow-leaderboard-aura" aria-hidden="true" />}
                      </div>
                      <div className="flow-leaderboard-copy">
                        <strong>{row.profiles?.name || 'Colaborador sem nome'}</strong>
                        <small>{row.lifetime_points || 0} pts históricos</small>
                      </div>
                    </div>

                    <div className="flow-leaderboard-score">
                      <span>Pontuação atual</span>
                      <strong>{row.available_points} pts</strong>
                    </div>

                    <div className="flow-leaderboard-hovercard">
                      <div><b>Disponível</b><span>{row.available_points} pts</span></div>
                      <div><b>Histórico</b><span>{row.lifetime_points || 0} pts</span></div>
                      <div><b>Resgatado</b><span>{row.redeemed_points || 0} pts</span></div>
                      <div><b>Perdido</b><span>{row.lost_points || 0} pts</span></div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="flow-market-toolbar">
          <div>
            <p className="flow-kicker">LOJA DE PONTOS</p>
            <h2 className="mt-1 text-2xl font-black md:text-3xl">Escolha seu prêmio</h2>
            <p className="mt-1 text-sm text-[var(--ocean-muted)]">Adicione ao carrinho e envie a troca para aprovação.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flow-market-search">
              <Search className="h-4 w-4" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar item..." />
            </div>
            <button type="button" className="flow-cart-button" onClick={() => setCartOpen(true)}>
              <ShoppingCart className="h-5 w-5" />
              <span>Carrinho</span>
              {cartCount > 0 && <b>{cartCount}</b>}
            </button>
          </div>
        </div>

        {activeItems.length === 0 ? (
          <div className="flow-market-empty"><Gift className="h-8 w-8" /><p>Nenhum item disponível agora.</p></div>
        ) : (
          <div className="flow-product-grid">
            {activeItems.map((item) => {
              const soldOut = item.stock !== null && item.stock !== undefined && item.stock <= 0;
              return (
                <article key={item.id} className="flow-product-card">
                  <div className="flow-product-media">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} />
                    ) : (
                      <div className="flow-product-placeholder"><Gift className="h-12 w-12" /></div>
                    )}
                    {soldOut && <span className="flow-product-soldout">Sem estoque</span>}
                  </div>
                  <div className="flow-product-content">
                    <div>
                      <h3>{item.name}</h3>
                      <p>{item.description || 'Brinde disponível para troca no Flow.'}</p>
                    </div>
                    <div className="flow-product-meta">
                      <span>{item.stock === null || item.stock === undefined ? 'Estoque livre' : `${item.stock} disponível(is)`}</span>
                      <strong>{item.points_cost} pts</strong>
                    </div>
                    <button type="button" disabled={soldOut} className="flow-product-add" onClick={() => addToCart(item)}>
                      <ShoppingCart className="h-4 w-4" />
                      {soldOut ? 'Indisponível' : 'Adicionar ao carrinho'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {isAdmin && (
        <section className="flow-admin-catalog-section">
          <div className="flow-admin-catalog-head">
            <div>
              <p className="flow-kicker">ADM / CATÁLOGO</p>
              <h2>Gerenciar produtos</h2>
              <p>Edite preço em pontos, estoque, imagem e disponibilidade dos itens da loja.</p>
            </div>
            <button type="button" className="flow-admin-new-product" onClick={() => openProductEditor()}>
              <Plus className="h-4 w-4" /> Novo produto
            </button>
          </div>

          <div className="flow-admin-catalog-table">
            {items.length === 0 ? (
              <div className="flow-admin-catalog-empty"><Gift className="h-6 w-6" /> Nenhum produto cadastrado.</div>
            ) : items.map((item) => (
              <div key={item.id} className="flow-admin-catalog-row">
                <div className="flow-admin-product-thumb">
                  {item.image_url ? <img src={item.image_url} alt="" /> : <Gift className="h-5 w-5" />}
                </div>
                <div className="flow-admin-product-name">
                  <strong>{item.name}</strong>
                  <small>{item.description || 'Sem descrição'}</small>
                </div>
                <div><span className="flow-admin-cell-label">Pontos</span><strong>{item.points_cost}</strong></div>
                <div><span className="flow-admin-cell-label">Estoque</span><strong>{item.stock == null ? 'Livre' : item.stock}</strong></div>
                <div><span className="flow-admin-cell-label">Status</span><strong className={item.is_active ? 'is-active' : 'is-inactive'}>{item.is_active ? 'Ativo' : 'Oculto'}</strong></div>
                <button type="button" className="flow-admin-edit-product" onClick={() => openProductEditor(item)}>
                  <Pencil className="h-4 w-4" /> Editar
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="flow-orders-section">
        <div className="mb-4">
          <p className="flow-kicker">{isAdmin ? 'APROVAÇÕES' : 'MINHAS TROCAS'}</p>
          <h2 className="mt-1 text-2xl font-black">{isAdmin ? 'Pedidos aguardando o ADM' : 'Acompanhe seus pedidos'}</h2>
        </div>
        {orderGroups.length === 0 ? (
          <div className="flow-market-empty"><PackageCheck className="h-7 w-7" /><p>Nenhum pedido por aqui ainda.</p></div>
        ) : (
          <div className="flow-order-list">
            {orderGroups.map((group) => (
              <article key={group.groupId} className="flow-order-row">
                <div className="flow-order-user">
                  {group.userAvatar ? <img src={group.userAvatar} alt="" /> : <span>{initials(group.userName)}</span>}
                  <div>
                    <strong>{group.userName}</strong>
                    <small>{new Date(group.createdAt).toLocaleString('pt-BR')}</small>
                  </div>
                </div>
                <div className="flow-order-items">
                  {group.rows.map((row) => (
                    <span key={row.id}>{row.quantity > 1 ? `${row.quantity}x ` : ''}{row.item_snapshot_name}</span>
                  ))}
                </div>
                <div className="flow-order-total"><span>Total</span><strong>{group.total} pts</strong></div>
                <span className={`flow-order-status is-${group.status}`}>{statusLabel(group.status)}</span>
                {isAdmin && (
                  <div className="flow-order-actions">
                    {group.status === 'pending' && (
                      <>
                        <button type="button" className="is-approve" onClick={() => void handleApprove(group.groupId)}><Check className="h-4 w-4" /> Aprovar</button>
                        <button type="button" className="is-cancel" onClick={() => void handleCancel(group.groupId)}><X className="h-4 w-4" /> Recusar</button>
                      </>
                    )}
                    {group.status === 'approved' && (
                      <button type="button" className="is-delivered" onClick={() => void handleDelivered(group.groupId)}><PackageCheck className="h-4 w-4" /> Entregue</button>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {isAdmin && settings && (
        <section className="grid gap-6 xl:grid-cols-2">
          <Card className="flow-ocean-card border-0">
            <CardHeader>
              <CardTitle className="text-xl font-black">Regras de pontos</CardTitle>
              <p className="text-sm text-[var(--ocean-muted)]">Defina quanto cada comportamento vale.</p>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2"><Label>Conclusão</Label><Input type="number" className="flow-input" value={settings.base_completion_points} onChange={(e) => setSettings((c) => c ? { ...c, base_completion_points: Number(e.target.value) } : c)} /></div>
              <div className="grid gap-2"><Label>Bônus no prazo</Label><Input type="number" className="flow-input" value={settings.on_time_bonus_points} onChange={(e) => setSettings((c) => c ? { ...c, on_time_bonus_points: Number(e.target.value) } : c)} /></div>
              <div className="grid gap-2"><Label>Bônus antecipado</Label><Input type="number" className="flow-input" value={settings.early_bonus_points} onChange={(e) => setSettings((c) => c ? { ...c, early_bonus_points: Number(e.target.value) } : c)} /></div>
              <div className="grid gap-2"><Label>Horário do bônus</Label><Input type="time" className="flow-input" value={(settings.early_cutoff || '12:00:00').slice(0, 5)} onChange={(e) => setSettings((c) => c ? { ...c, early_cutoff: `${e.target.value}:00` } : c)} /></div>
              <div className="grid gap-2"><Label>Penalidade por atraso</Label><Input type="number" className="flow-input" value={settings.late_penalty_points} onChange={(e) => setSettings((c) => c ? { ...c, late_penalty_points: Number(e.target.value) } : c)} /></div>
              <div className="md:col-span-2 grid gap-2"><Label>Multiplicador por prioridade (P1 → P5)</Label><div className="grid grid-cols-5 gap-2">{(['p1_multiplier','p2_multiplier','p3_multiplier','p4_multiplier','p5_multiplier'] as const).map((key) => <Input key={key} type="number" step="0.05" className="flow-input" value={settings[key]} onChange={(e) => setSettings((c) => c ? { ...c, [key]: Number(e.target.value) } : c)} />)}</div></div>
              <div className="md:col-span-2"><Button onClick={() => void handleSaveSettings()} disabled={savingSettings} className="flow-primary-button"><Save className="h-4 w-4" />{savingSettings ? 'Salvando...' : 'Salvar regras'}</Button></div>
            </CardContent>
          </Card>

          <Card id="admin-product-editor" className="flow-ocean-card border-0">
            <CardHeader>
              <CardTitle className="text-xl font-black">Editor de produto</CardTitle>
              <p className="text-sm text-[var(--ocean-muted)]">Cadastre ou edite um item do marketplace.</p>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2"><Label>Nome</Label><Input className="flow-input" value={shopForm.name} onChange={(e) => setShopForm((c) => ({ ...c, name: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Descrição</Label><Textarea className="flow-input min-h-24" value={shopForm.description} onChange={(e) => setShopForm((c) => ({ ...c, description: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Imagem</Label><div className="flex gap-2"><div className="relative flex-1"><ImagePlus className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" /><Input className="flow-input pl-10" value={shopForm.image_url} onChange={(e) => setShopForm((c) => ({ ...c, image_url: e.target.value }))} placeholder="URL ou envie um arquivo" /></div><label className="flow-upload-button"><Upload className="h-4 w-4" />{uploadingProduct ? 'Enviando...' : 'Enviar'}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadingProduct} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadProductImage(file); e.currentTarget.value = ''; }} /></label></div></div>
              <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label>Custo em pontos</Label><Input type="number" className="flow-input" value={shopForm.points_cost} onChange={(e) => setShopForm((c) => ({ ...c, points_cost: Number(e.target.value) }))} /></div><div className="grid gap-2"><Label>Estoque</Label><Input className="flow-input" value={shopForm.stock} onChange={(e) => setShopForm((c) => ({ ...c, stock: e.target.value }))} placeholder="Vazio = ilimitado" /></div></div>
              <label className="flow-setting-switch"><div><strong>Produto ativo</strong><span>Exibe o item para os usuários.</span></div><Switch checked={shopForm.is_active} onCheckedChange={(checked) => setShopForm((c) => ({ ...c, is_active: checked }))} /></label>
              <div className="flex gap-2"><Button onClick={() => void handleSaveItem()} disabled={savingItem} className="flow-primary-button"><Save className="h-4 w-4" />{savingItem ? 'Salvando...' : shopForm.id ? 'Salvar produto' : 'Criar produto'}</Button>{shopForm.id && <Button variant="outline" className="flow-secondary-button" onClick={() => setShopForm(emptyShopForm)}>Cancelar</Button>}</div>
              {items.length > 0 && <div className="flow-admin-product-list">{items.map((item) => <button key={item.id} type="button" onClick={() => openProductEditor(item)}><span>{item.name}</span><small>{item.points_cost} pts</small><ChevronRight className="h-4 w-4" /></button>)}</div>}
            </CardContent>
          </Card>
        </section>
      )}

      <div className={`flow-cart-overlay ${cartOpen ? 'is-open' : ''}`} onMouseDown={(event) => { if (event.currentTarget === event.target) setCartOpen(false); }}>
        <aside className="flow-cart-panel">
          <div className="flow-cart-head"><div><p className="flow-kicker">SEU CARRINHO</p><h2>Troca de pontos</h2></div><button type="button" onClick={() => setCartOpen(false)}><X className="h-5 w-5" /></button></div>
          <div className="flow-cart-list">
            {cartItems.length === 0 ? <div className="flow-cart-empty"><ShoppingCart className="h-8 w-8" /><p>Seu carrinho está vazio.</p></div> : cartItems.map(({ item, quantity }) => <div key={item.id} className="flow-cart-item"><div className="flow-cart-thumb">{item.image_url ? <img src={item.image_url} alt="" /> : <Gift className="h-6 w-6" />}</div><div className="flow-cart-item-copy"><strong>{item.name}</strong><span>{item.points_cost} pts cada</span><div className="flow-cart-qty"><button type="button" onClick={() => changeQuantity(item, quantity - 1)}><Minus className="h-3.5 w-3.5" /></button><b>{quantity}</b><button type="button" onClick={() => changeQuantity(item, quantity + 1)}><Plus className="h-3.5 w-3.5" /></button><button type="button" className="is-remove" onClick={() => changeQuantity(item, 0)}><Trash2 className="h-3.5 w-3.5" /></button></div></div><strong>{item.points_cost * quantity} pts</strong></div>)}
          </div>
          <div className="flow-cart-footer"><div className="flow-cart-balance"><span>Seu saldo</span><strong>{wallet.available_points} pts</strong></div><div className="flow-cart-total"><span>Total do pedido</span><strong>{cartTotal} pts</strong></div><button type="button" disabled={cartItems.length === 0 || checkingOut || wallet.available_points < cartTotal} className="flow-cart-checkout" onClick={() => void checkoutCart()}>{checkingOut ? 'Enviando...' : 'Solicitar troca'}<ChevronRight className="h-5 w-5" /></button>{wallet.available_points < cartTotal && cartItems.length > 0 && <p className="flow-cart-warning">Saldo insuficiente para este carrinho.</p>}</div>
        </aside>
      </div>
    </div>
  );
}
