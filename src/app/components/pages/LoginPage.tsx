import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useStore } from '../../store';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';


export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const setUser = useStore((state) => state.setUser);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailFake = `${username.toLowerCase().trim()}@paineldemandas.com.br`;

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailFake,
      password,
    });

    if (error) {
      alert('Usuário ou senha inválidos');
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      alert('Erro ao carregar perfil');
      return;
    }

    setUser({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
    });

    if (profile.role === 'manager') {
      navigate('/');
    } else {
      navigate('/minhas-demandas');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex flex-col items-center mb-8">
<img
  src="/logo.png"
  alt="Task Hub"
  className="w-24 h-24 object-contain mb-4"
/>

<h1 className="text-2xl font-semibold text-gray-900">𝚃𝚊𝚜𝚔 𝙷𝚞𝚋</h1>
            <p className="text-gray-500 mt-1">Entre com seu usuário</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                placeholder="ex: joao"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700">
              Entrar
            </Button>
		<button
  type="button"
  onClick={() => navigate('/cadastro')}
  className="w-full text-sm text-blue-600 hover:underline mt-3"
>
  Criar conta
</button>
          </form>
        </div>
      </div>
    </div>
  );
}