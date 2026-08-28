import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Eye, EyeOff, Orbit, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { useStore } from '../../store';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setUser = useStore((state) => state.setUser);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    const emailFake = `${username.toLowerCase().trim()}@paineldemandas.com.br`;

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailFake,
      password,
    });

    if (error) {
      setLoading(false);
      toast.error('Usuário ou senha inválidos');
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      setLoading(false);
      toast.error('Erro ao carregar perfil');
      return;
    }

    setUser({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
    });

    navigate('/');
  };

  return (
    <div className="flow-login-shell">
      <div className="flow-space-grid pointer-events-none absolute inset-0" />
      <div className="flow-ambient flow-ambient-one" />
      <div className="flow-ambient flow-ambient-two" />

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1320px] items-center gap-12 px-5 py-10 lg:grid-cols-[1.1fr_.9fr] lg:px-10">
        <section className="hidden lg:block">
          <p className="flow-kicker">FLOW / WORKSPACE</p>
          <h1 className="mt-5 max-w-3xl text-6xl font-black leading-[0.94] tracking-[-0.065em] text-[#eaf6ff] xl:text-7xl">
            Seu dia no controle.
            <br />
            Tudo no <span className="text-[#22d3ee] drop-shadow-[0_0_18px_rgba(34,211,238,0.45)]">Flow.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#7fa3c4]">
            Acesse suas demandas, acompanhe prazos, veja os avisos do time e participe das recompensas em um só lugar.
          </p>

          <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
            {[
              ['01', 'Demandas do dia'],
              ['02', 'Mural do time'],
              ['03', 'Pontos e recompensas'],
            ].map(([number, label]) => (
              <div key={number} className="flow-login-feature">
                <span className="text-[10px] font-black tracking-[0.2em] text-[#22d3ee]">{number}</span>
                <p className="mt-7 text-sm font-bold text-[#eaf6ff]">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mx-auto w-full max-w-[470px] [perspective:1200px]">
          <div className="flow-login-card">
            <div className="flow-login-card-line" />

            <div className="flex flex-col items-center text-center">
              <div className="flow-login-orb">
                <span className="flow-login-orbit flow-login-orbit-one" />
                <span className="flow-login-orbit flow-login-orbit-two" />
                <span className="flow-login-orbit flow-login-orbit-three" />
                <div className="flow-login-logo">
                  <img src="/logo.png" alt="FLOW" className="h-20 w-20 object-contain" />
                </div>
              </div>

              <h2 className="mt-7 text-3xl font-black tracking-[-0.055em] text-[#eaf6ff]">FLOW</h2>
              <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-[#7fa3c4]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#22d3ee]" />
                Acesso ao ambiente operacional
              </div>
            </div>

            <form onSubmit={handleLogin} className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm text-[#7fa3c4]">Usuário</Label>
                <Input
                  id="username"
                  placeholder="ex: joao"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  autoComplete="username"
                  className="flow-input h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm text-[#7fa3c4]">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoComplete="current-password"
                    className="flow-input h-12 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#6f93b3] transition hover:bg-[#0d1830] hover:text-[#22d3ee]"
                    title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="flow-primary-button h-12 w-full">
                {loading ? 'Entrando...' : 'Entrar no Flow'}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>

              <button
                type="button"
                onClick={() => navigate('/cadastro')}
                className="flow-login-create-account flex w-full items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold transition"
              >
                <Orbit className="h-4 w-4" />
                Criar conta
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
