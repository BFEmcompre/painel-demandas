import { useState } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { CheckSquare } from 'lucide-react';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert('As senhas não conferem');
      return;
    }

    const cleanUsername = username.toLowerCase().trim();
    const fakeEmail = `${cleanUsername}@paineldemandas.com.br`;

    const { data, error } = await supabase.auth.signUp({
      email: fakeEmail,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user?.id,
      name,
      username: cleanUsername,
      email: fakeEmail,
      role: 'responsible',
    });

    if (profileError) {
      alert('Conta criada, mas houve erro ao salvar perfil');
      return;
    }

    alert('Conta criada com sucesso!');
    navigate('/login');
  };

  return (
    <div className="flow-login-shell">
      <div className="flow-space-grid pointer-events-none absolute inset-0" />
      <div className="flow-ambient flow-ambient-one" />
      <div className="flow-ambient flow-ambient-two" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1200px] items-center justify-center px-5 py-10">
        <div className="grid w-full gap-10 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
          <section className="hidden lg:block">
            <p className="flow-kicker">FLOW / NOVO ACESSO</p>
            <h1 className="mt-5 text-5xl font-black leading-[.96] tracking-[-0.055em] text-[#eaf6ff]">
              Entre no fluxo.
              <br />
              <span className="text-[#22d3ee]">Organize o seu dia.</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-[#7fa3c4]">
              Crie seu acesso para acompanhar demandas, avisos do time e recompensas.
            </p>
          </section>

          <div className="mx-auto w-full max-w-[520px] [perspective:1200px]">
            <div className="flow-login-card">
              <div className="flow-login-card-line" />

              <div className="mb-8 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#1c3a5e] bg-[#0d1830] shadow-[0_0_28px_rgba(34,211,238,.25)]">
                  <CheckSquare className="h-6 w-6 text-[#22d3ee]" />
                </div>
                <div>
                  <p className="flow-kicker">CADASTRO</p>
                  <h1 className="mt-1 text-2xl font-black text-[#eaf6ff]">Criar conta</h1>
                  <p className="mt-1 text-sm text-[#7fa3c4]">Cadastre seu acesso ao Flow.</p>
                </div>
              </div>

              <form onSubmit={handleRegister} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm text-[#7fa3c4]">Nome completo</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="flow-input h-12" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm text-[#7fa3c4]">Usuário</Label>
                  <Input id="username" placeholder="ex: joao" value={username} onChange={(e) => setUsername(e.target.value)} required className="flow-input h-12" />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm text-[#7fa3c4]">Senha</Label>
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="flow-input h-12" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm text-[#7fa3c4]">Confirmar senha</Label>
                    <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="flow-input h-12" />
                  </div>
                </div>

                <Button type="submit" className="flow-primary-button h-12 w-full">
                  Criar conta
                </Button>

                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="flow-login-create-account flex w-full items-center justify-center rounded-xl py-2 text-sm font-semibold transition"
                >
                  Já tenho conta
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}