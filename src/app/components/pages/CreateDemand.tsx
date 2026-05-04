import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

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
    <div className="max-w-3xl">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Criar Nova Demanda</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Defina os detalhes da tarefa e os responsáveis</p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>Título da Demanda *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="space-y-3">
            <Label>Responsáveis *</Label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {responsibles.map((resp) => (
                <label
                  key={resp.id}
                  className="flex items-center gap-3 border rounded-lg p-3 cursor-pointer hover:bg-gray-50"
                >
                  <Checkbox
                    checked={selectedResponsibles.includes(resp.id)}
                    onCheckedChange={() => toggleResponsible(resp.id)}
                  />
                  <span className="font-medium text-gray-800">{resp.name}</span>
                </label>
              ))}
            </div>

            {responsibles.length === 0 && (
              <p className="text-sm text-red-600">
                Nenhum responsável cadastrado ainda.
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-100 rounded-lg">
            <Checkbox
              checked={isRecurring}
              onCheckedChange={(checked) => setIsRecurring(Boolean(checked))}
            />
            <div>
              <p className="font-medium text-gray-900">Demanda fixa diária</p>
              <p className="text-sm text-gray-600">
                Essa demanda deverá ser realizada todos os dias durante o expediente.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!isRecurring && (
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            )}

            <div className="space-y-2">
              <Label>Horário Limite *</Label>
              <Input type="time" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              {isRecurring && (
                <p className="text-xs text-gray-500">
                  Para demandas fixas, o padrão recomendado é 17:00.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Checklist</Label>
              <Button type="button" variant="outline" size="sm" onClick={addChecklistItem}>
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
                />

                {checklistItems.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeChecklistItem(index)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              Salvar Demanda
            </Button>

            <Button type="button" variant="outline" onClick={() => navigate('/')}>
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}