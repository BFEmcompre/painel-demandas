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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4">
              <CheckSquare className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">Criar conta</h1>
            <p className="text-gray-500 mt-1">Cadastre seu acesso</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-11"
              />
            </div>

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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700">
              Criar conta
            </Button>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full text-sm text-blue-600 hover:underline"
            >
              Já tenho conta
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}