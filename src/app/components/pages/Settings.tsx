import { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { Bell, Lock, User, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

type Profile = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: 'manager' | 'responsible';
};

export function Settings() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      toast.error('Usuário não encontrado');
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (error || !data) {
      toast.error('Erro ao carregar perfil');
      return;
    }

    setProfile(data);
    setName(data.name);
    setUsername(data.username);
  }

  async function handleSaveProfile() {
    if (!profile) return;

    const cleanUsername = username.toLowerCase().trim().replace(/\s+/g, '');

    const { error } = await supabase
      .from('profiles')
      .update({
        name,
        username: cleanUsername,
      })
      .eq('id', profile.id);

    if (error) {
      toast.error('Erro ao salvar perfil');
      return;
    }

    toast.success('Perfil atualizado com sucesso');
    loadProfile();
  }

  async function handleChangePassword() {
    if (!newPassword || !confirmPassword) {
      toast.error('Preencha a nova senha e a confirmação');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('As senhas não conferem');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('A senha precisa ter pelo menos 6 caracteres');
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      toast.error('Erro ao alterar senha');
      return;
    }

    setNewPassword('');
    setConfirmPassword('');
    toast.success('Senha alterada com sucesso');
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Configurações</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie as preferências do sistema</p>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <User className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Perfil</h2>
            <p className="text-sm text-gray-500">Atualize suas informações pessoais</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Usuário</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>E-mail interno</Label>
              <Input value={profile?.email || ''} disabled />
            </div>

            <div className="space-y-2">
              <Label>Perfil de acesso</Label>
              <Input
                value={profile?.role === 'manager' ? 'Gestor' : 'Responsável'}
                disabled
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSaveProfile} className="bg-blue-600 hover:bg-blue-700">
              Salvar Alterações
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Lock className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Segurança</h2>
            <p className="text-sm text-gray-500">Altere sua senha de acesso</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Confirmar nova senha</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={handleChangePassword}>
              Alterar Senha
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <Bell className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Notificações</h2>
            <p className="text-sm text-gray-500">Preferências visuais do sistema</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-gray-900">Tarefas atrasadas</p>
              <p className="text-sm text-gray-500">
                Mostrar alertas quando uma tarefa ultrapassar o prazo
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-gray-900">Novas demandas</p>
              <p className="text-sm text-gray-500">
                Mostrar sinalização quando houver uma nova tarefa
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </div>
      </Card>

      {profile?.role === 'manager' && (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Preferências do Sistema</h2>
              <p className="text-sm text-gray-500">Regras gerais de funcionamento</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-gray-900">Exigir foto obrigatória</p>
                <p className="text-sm text-gray-500">
                  Bloqueia conclusão de tarefas sem comprovação fotográfica
                </p>
              </div>
              <Switch defaultChecked disabled />
            </div>

            <Separator />

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-gray-900">Checklist obrigatório</p>
                <p className="text-sm text-gray-500">
                  Exige que todos os itens sejam marcados antes da conclusão
                </p>
              </div>
              <Switch defaultChecked disabled />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}