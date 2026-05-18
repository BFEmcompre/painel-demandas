import { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import {
  Bell,
  Lock,
  User,
  Shield,
} from 'lucide-react';
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

    const cleanUsername = username
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '');

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
    <div className="max-w-4xl space-y-6 min-h-screen bg-white dark:bg-[#0B0B0B] text-gray-900 dark:text-white p-1">

      <div>
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
          Configurações
        </h1>

        <p className="text-gray-500 dark:text-[#A1A1A1] mt-1">
          Gerencie as preferências do sistema
        </p>
      </div>

      {/* PERFIL */}

      <Card className="
        p-6
        bg-white
        dark:bg-[#121212]
        border
        border-gray-200
        dark:border-[#1F1F1F]
      ">

        <div className="flex items-center gap-3 mb-6">

          <div className="
            w-10
            h-10
            bg-gray-100
            dark:bg-[#181818]
            rounded-lg
            flex
            items-center
            justify-center
          ">
            <User className="w-5 h-5 text-gray-700 dark:text-white" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Perfil
            </h2>

            <p className="text-sm text-gray-500 dark:text-[#A1A1A1]">
              Atualize suas informações pessoais
            </p>
          </div>

        </div>

        <div className="space-y-4">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="space-y-2">

              <Label className="text-gray-900 dark:text-white">
                Nome completo
              </Label>

              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="
                  bg-white
                  border-gray-300
                  text-gray-900
                  dark:bg-[#181818]
                  dark:border-[#2A2A2A]
                  dark:text-white
                "
              />

            </div>

            <div className="space-y-2">

              <Label className="text-gray-900 dark:text-white">
                Usuário
              </Label>

              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="
                  bg-white
                  border-gray-300
                  text-gray-900
                  dark:bg-[#181818]
                  dark:border-[#2A2A2A]
                  dark:text-white
                "
              />

            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="space-y-2">

              <Label className="text-gray-900 dark:text-white">
                E-mail interno
              </Label>

              <Input
                value={profile?.email || ''}
                disabled
                className="
                  bg-gray-100
                  border-gray-300
                  text-gray-500
                  dark:bg-[#181818]
                  dark:border-[#2A2A2A]
                  dark:text-[#707070]
                "
              />

            </div>

            <div className="space-y-2">

              <Label className="text-gray-900 dark:text-white">
                Perfil de acesso
              </Label>

              <Input
                value={
                  profile?.role === 'manager'
                    ? 'Gestor'
                    : 'Responsável'
                }
                disabled
                className="
                  bg-gray-100
                  border-gray-300
                  text-gray-500
                  dark:bg-[#181818]
                  dark:border-[#2A2A2A]
                  dark:text-[#707070]
                "
              />

            </div>
          </div>

          <div className="flex justify-end pt-4">

            <Button
              onClick={handleSaveProfile}
              className="
                bg-gray-900
                text-white
                hover:bg-black
                dark:bg-white
                dark:text-black
                dark:hover:bg-[#E5E5E5]
              "
            >
              Salvar Alterações
            </Button>

          </div>
        </div>
      </Card>

      {/* SEGURANÇA */}

      <Card className="
        p-6
        bg-white
        dark:bg-[#121212]
        border
        border-gray-200
        dark:border-[#1F1F1F]
      ">

        <div className="flex items-center gap-3 mb-6">

          <div className="
            w-10
            h-10
            bg-gray-100
            dark:bg-[#181818]
            rounded-lg
            flex
            items-center
            justify-center
          ">
            <Lock className="w-5 h-5 text-gray-700 dark:text-white" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Segurança
            </h2>

            <p className="text-sm text-gray-500 dark:text-[#A1A1A1]">
              Altere sua senha de acesso
            </p>
          </div>

        </div>

        <div className="space-y-4">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="space-y-2">

              <Label className="text-gray-900 dark:text-white">
                Nova senha
              </Label>

              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="
                  bg-white
                  border-gray-300
                  text-gray-900
                  dark:bg-[#181818]
                  dark:border-[#2A2A2A]
                  dark:text-white
                "
              />

            </div>

            <div className="space-y-2">

              <Label className="text-gray-900 dark:text-white">
                Confirmar nova senha
              </Label>

              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="
                  bg-white
                  border-gray-300
                  text-gray-900
                  dark:bg-[#181818]
                  dark:border-[#2A2A2A]
                  dark:text-white
                "
              />

            </div>
          </div>

          <div className="flex justify-end pt-4">

            <Button
              variant="outline"
              onClick={handleChangePassword}
              className="
                bg-white
                border-gray-300
                text-gray-900
                hover:bg-gray-100
                dark:bg-[#181818]
                dark:border-[#2A2A2A]
                dark:text-white
                dark:hover:bg-[#242424]
              "
            >
              Alterar Senha
            </Button>

          </div>
        </div>
      </Card>

      {/* NOTIFICAÇÕES */}

      <Card className="
        p-6
        bg-white
        dark:bg-[#121212]
        border
        border-gray-200
        dark:border-[#1F1F1F]
      ">

        <div className="flex items-center gap-3 mb-6">

          <div className="
            w-10
            h-10
            bg-gray-100
            dark:bg-[#181818]
            rounded-lg
            flex
            items-center
            justify-center
          ">
            <Bell className="w-5 h-5 text-gray-700 dark:text-white" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Notificações
            </h2>

            <p className="text-sm text-gray-500 dark:text-[#A1A1A1]">
              Preferências visuais do sistema
            </p>
          </div>

        </div>

        <div className="space-y-4">

          <div className="flex items-center justify-between py-3">

            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                Tarefas atrasadas
              </p>

              <p className="text-sm text-gray-500 dark:text-[#A1A1A1]">
                Mostrar alertas quando uma tarefa ultrapassar o prazo
              </p>
            </div>

            <Switch defaultChecked />

          </div>

          <Separator className="dark:bg-[#1F1F1F]" />

          <div className="flex items-center justify-between py-3">

            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                Novas demandas
              </p>

              <p className="text-sm text-gray-500 dark:text-[#A1A1A1]">
                Mostrar sinalização quando houver uma nova tarefa
              </p>
            </div>

            <Switch defaultChecked />

          </div>
        </div>
      </Card>

      {/* SISTEMA */}

      {profile?.role === 'manager' && (

        <Card className="
          p-6
          bg-white
          dark:bg-[#121212]
          border
          border-gray-200
          dark:border-[#1F1F1F]
        ">

          <div className="flex items-center gap-3 mb-6">

            <div className="
              w-10
              h-10
              bg-gray-100
              dark:bg-[#181818]
              rounded-lg
              flex
              items-center
              justify-center
            ">
              <Shield className="w-5 h-5 text-gray-700 dark:text-white" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Preferências do Sistema
              </h2>

              <p className="text-sm text-gray-500 dark:text-[#A1A1A1]">
                Regras gerais de funcionamento
              </p>
            </div>

          </div>

          <div className="space-y-4">

            <div className="flex items-center justify-between py-3">

              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Exigir foto obrigatória
                </p>

                <p className="text-sm text-gray-500 dark:text-[#A1A1A1]">
                  Bloqueia conclusão de tarefas sem comprovação fotográfica
                </p>
              </div>

              <Switch defaultChecked disabled />

            </div>

            <Separator className="dark:bg-[#1F1F1F]" />

            <div className="flex items-center justify-between py-3">

              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Checklist obrigatório
                </p>

                <p className="text-sm text-gray-500 dark:text-[#A1A1A1]">
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