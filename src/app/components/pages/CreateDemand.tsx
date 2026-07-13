import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import {
  PRIORITY_LEVELS,
  DEFAULT_PRIORITY,
  PRIORITY_LABEL,
  type PriorityLevel,
} from '../../lib/priority';

type Responsible = {
  id: string;
  name: string;
};

export function CreateDemand() {
  const navigate = useNavigate();

  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [selectedResponsibles, setSelectedResponsibles] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const todayBrazil = new Date().toLocaleDateString('sv-SE', {
    timeZone: 'America/Sao_Paulo',
  });

  const [date, setDate] = useState(todayBrazil);
  const [deadline, setDeadline] = useState('17:00');
  const [isRecurring, setIsRecurring] = useState(false);
  const [checklistItems, setChecklistItems] = useState<string[]>(['']);
  const [requiresPhoto, setRequiresPhoto] = useState(true);
  const [priority, setPriority] = useState<PriorityLevel>(DEFAULT_PRIORITY);

  useEffect(() => {
    loadResponsibles();
  }, []);

  async function loadResponsibles() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('role', 'responsible')
      .order('name');

    if (error) {
      toast.error('Erro ao carregar responsáveis');
      return;
    }

    setResponsibles(data || []);
  }

  function toggleResponsible(id: string) {
    setSelectedResponsibles((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  const addChecklistItem = () => {
    setChecklistItems([...checklistItems, '']);
  };

  const removeChecklistItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  const updateChecklistItem = (index: number, value: string) => {
    const newItems = [...checklistItems];
    newItems[index] = value;
    setChecklistItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !description || selectedResponsibles.length === 0 || !deadline) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const taskDate = isRecurring ? todayBrazil : date;
    const deadlineFull = `${taskDate}T${deadline}`;

    const responsibleNames = responsibles
      .filter((r) => selectedResponsibles.includes(r.id))
      .map((r) => r.name)
      .join(', ');

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        title,
        description,
        responsible_id: selectedResponsibles[0],
        responsible_name: responsibleNames,
        date: taskDate,
        deadline: deadlineFull,
        status: 'pending',
        is_recurring: isRecurring,
        recurring_deadline: deadline,
        priority,
        requires_photo: requiresPhoto, 
      })
      .select()
      .single();

    if (taskError || !task) {
      toast.error('Erro ao criar demanda');
      return;
    }

    const taskResponsibles = selectedResponsibles.map((responsibleId) => {
      const responsible = responsibles.find((r) => r.id === responsibleId);

      return {
        task_id: task.id,
        responsible_id: responsibleId,
        responsible_name: responsible?.name || '',
      };
    });

    const { error: responsibleError } = await supabase
      .from('task_responsibles')
      .insert(taskResponsibles);

    if (responsibleError) {
      toast.error('Erro ao salvar responsáveis da demanda');
      return;
    }

    const checklist = checklistItems
      .filter((item) => item.trim())
      .map((item) => ({
        task_id: task.id,
        text: item,
      }));

    if (checklist.length > 0) {
      const { error: checklistError } = await supabase
        .from('checklist_items')
        .insert(checklist);

      if (checklistError) {
        toast.error('Erro ao salvar checklist');
        return;
      }
    }

    toast.success('Demanda criada com sucesso!');
    navigate('/');
  };

  return (
    <div className="max-w-3xl min-h-screen bg-white dark:bg-[#0B0B0B] p-1">
      
      <button
        onClick={() => navigate('/')}
        className="
          flex
          items-center
          gap-2
          text-gray-600
          hover:text-gray-900
          dark:text-[#A1A1A1]
          dark:hover:text-white
          mb-6
          transition-colors
        "
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
          Criar Nova Demanda
        </h1>

        <p className="text-gray-500 dark:text-[#A1A1A1] mt-1">
          Defina os detalhes da tarefa e os responsáveis
        </p>
      </div>

      <Card className="
        p-6
        bg-white
        dark:bg-[#121212]
        border
        border-gray-200
        dark:border-[#1F1F1F]
      ">
        
        <form onSubmit={handleSubmit} className="space-y-6">

          <div className="space-y-2">
            <Label className="text-gray-900 dark:text-white">
              Título da Demanda *
            </Label>

            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="
                bg-white
                dark:bg-[#181818]
                border-gray-300
                dark:border-[#2A2A2A]
                text-gray-900
                dark:text-white
              "
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-900 dark:text-white">
              Descrição *
            </Label>

            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="
                bg-white
                dark:bg-[#181818]
                border-gray-300
                dark:border-[#2A2A2A]
                text-gray-900
                dark:text-white
              "
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-900 dark:text-white">
              Prioridade *
            </Label>

            <Select
              value={String(priority)}
              onValueChange={(value) =>
                setPriority(Number(value) as PriorityLevel)
              }
            >
              <SelectTrigger
                className="
                  bg-white
                  dark:bg-[#181818]
                  border-gray-300
                  dark:border-[#2A2A2A]
                  text-gray-900
                  dark:text-white
                "
              >
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>

              <SelectContent className="dark:bg-[#181818] dark:border-[#2A2A2A]">
                {PRIORITY_LEVELS.map((level) => (
                  <SelectItem key={level} value={String(level)}>
                    P{level} · {PRIORITY_LABEL[level]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <p className="text-xs text-gray-500 dark:text-[#707070]">
              1 é a prioridade máxima, 3 e 4 são médias, 5 é baixa.
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-gray-900 dark:text-white">
              Responsáveis *
            </Label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {responsibles.map((resp) => (
                <label
                  key={resp.id}
                  className="
                    flex
                    items-center
                    gap-3
                    border
                    border-gray-200
                    dark:border-[#2A2A2A]
                    rounded-lg
                    p-3
                    cursor-pointer
                    hover:bg-gray-50
                    dark:hover:bg-[#181818]
                    transition-colors
                  "
                >
                  <Checkbox
                    checked={selectedResponsibles.includes(resp.id)}
                    onCheckedChange={() => toggleResponsible(resp.id)}
                  />

                  <span className="font-medium text-gray-800 dark:text-white">
                    {resp.name}
                  </span>
                </label>
              ))}
            </div>

            {responsibles.length === 0 && (
              <p className="text-sm text-red-600 dark:text-red-400">
                Nenhum responsável cadastrado ainda.
              </p>
            )}
          </div>

          <div className="
            flex
            items-center
            gap-3
            p-4
            bg-blue-50
            border
            border-blue-100
            dark:bg-[#181818]
            dark:border-[#2A2A2A]
            rounded-lg
          ">
            <Checkbox
              checked={isRecurring}
              onCheckedChange={(checked) => setIsRecurring(Boolean(checked))}
            />

            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                Demanda fixa diária
              </p>

              <p className="text-sm text-gray-600 dark:text-[#A1A1A1]">
                Essa demanda deverá ser realizada todos os dias durante o expediente.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-100 dark:bg-[#181818] dark:border-[#2A2A2A] rounded-lg">
            <Checkbox
              checked={requiresPhoto}
              onCheckedChange={(checked) => setRequiresPhoto(Boolean(checked))}
            />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                Exigir foto para concluir
              </p>
              <p className="text-sm text-gray-600 dark:text-[#A1A1A1]">
                Se desmarcado, o responsável poderá concluir sem anexar foto.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {!isRecurring && (
              <div className="space-y-2">
                <Label className="text-gray-900 dark:text-white">
                  Data *
                </Label>

                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="
                    bg-white
                    dark:bg-[#181818]
                    border-gray-300
                    dark:border-[#2A2A2A]
                    text-gray-900
                    dark:text-white
                  "
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-gray-900 dark:text-white">
                Horário Limite *
              </Label>

              <Input
                type="time"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="
                  bg-white
                  dark:bg-[#181818]
                  border-gray-300
                  dark:border-[#2A2A2A]
                  text-gray-900
                  dark:text-white
                "
              />

              {isRecurring && (
                <p className="text-xs text-gray-500 dark:text-[#707070]">
                  Para demandas fixas, o padrão recomendado é 17:00.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">

            <div className="flex items-center justify-between">
              <Label className="text-gray-900 dark:text-white">
                Checklist
              </Label>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addChecklistItem}
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
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Item
              </Button>
            </div>

            {checklistItems.map((item, index) => (
              <div key={index} className="flex gap-2">

                <Input
                  value={item}
                  onChange={(e) => updateChecklistItem(index, e.target.value)}
                  placeholder={`Item ${index + 1}`}
                  className="
                    bg-white
                    dark:bg-[#181818]
                    border-gray-300
                    dark:border-[#2A2A2A]
                    text-gray-900
                    dark:text-white
                  "
                />

                {checklistItems.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeChecklistItem(index)}
                    className="
                      bg-white
                      border-gray-300
                      hover:bg-red-50
                      dark:bg-[#181818]
                      dark:border-[#2A2A2A]
                      dark:hover:bg-[#242424]
                    "
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-4">

            <Button
              type="submit"
              className="
                bg-gray-900
                text-white
                hover:bg-black
                dark:bg-white
                dark:text-black
                dark:hover:bg-[#E5E5E5]
              "
            >
              Salvar Demanda
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/')}
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
              Cancelar
            </Button>

          </div>
        </form>
      </Card>
    </div>
  );
}
