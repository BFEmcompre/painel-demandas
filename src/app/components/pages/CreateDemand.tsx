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
  priorityLabel,
  type PriorityLevel,
} from '../../lib/priority';

type Responsible = {
  id: string;
  name: string;
};

type CheckMode = 'simple' | 'shift' | 'weekly' | 'biweekly' | 'monthly' | 'interval';

type ChecklistDraftItem = {
  text: string;
  checkMode: CheckMode;
  requiresMorning: boolean;
  morningCutoff: string;
  requiresAfternoon: boolean;
  afternoonCutoff: string;
  monthlyDay: number;
  intervalHours: number;
  intervalWindowStart: string;
  intervalWindowEnd: string;
};

function computePeriodKey(mode: 'weekly' | 'biweekly', date: Date) {
  if (mode === 'weekly') {
    // Semana ISO (segunda a domingo) — igual ao to_char(date,'IYYY-IW') do Postgres.
    const target = new Date(date.getTime());
    const day = (target.getDay() + 6) % 7; // 0 = segunda
    target.setDate(target.getDate() - day + 3);
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
    return `${target.getFullYear()}-${String(week).padStart(2, '0')}`;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const half = date.getDate() <= 15 ? '1' : '2';
  return `${year}-${month}-H${half}`;
}

// Se está sendo criada antes das 18h num dia útil, conta a partir de hoje.
// Depois das 18h (ou em qualquer horário de fim de semana), só passa a
// valer no próximo dia útil — assim uma demanda fixa criada à noite não
// nasce "vencida" com o prazo do mesmo dia já estourado.
function computeNextEffectiveDate(): string {
  const brazilNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dow = brazilNow.getDay();
  const hour = brazilNow.getHours();
  const target = new Date(brazilNow.getFullYear(), brazilNow.getMonth(), brazilNow.getDate());

  if (dow === 0 || dow === 6) {
    target.setDate(target.getDate() + ((8 - dow) % 7));
  } else if (hour >= 18) {
    target.setDate(target.getDate() + 1);
    const nextDow = target.getDay();
    if (nextDow === 6) target.setDate(target.getDate() + 2);
    else if (nextDow === 0) target.setDate(target.getDate() + 1);
  }

  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const emptyChecklistDraftItem: ChecklistDraftItem = {
  text: '',
  checkMode: 'simple',
  requiresMorning: false,
  morningCutoff: '12:00',
  requiresAfternoon: false,
  afternoonCutoff: '18:00',
  monthlyDay: 1,
  intervalHours: 2,
  intervalWindowStart: '08:00',
  intervalWindowEnd: '18:00',
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
  const [recurringIntervalDays, setRecurringIntervalDays] = useState(1);
  const [checklistItems, setChecklistItems] = useState<ChecklistDraftItem[]>([
    { ...emptyChecklistDraftItem },
  ]);
  const [isStandby, setIsStandby] = useState(false);
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
    setChecklistItems([...checklistItems, { ...emptyChecklistDraftItem }]);
  };

  const removeChecklistItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  const updateChecklistItem = (index: number, value: string) => {
    const newItems = [...checklistItems];
    newItems[index] = { ...newItems[index], text: value };
    setChecklistItems(newItems);
  };

  function patchChecklistItem(index: number, patch: Partial<ChecklistDraftItem>) {
    setChecklistItems((current) => {
      const next = [...current];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !description || selectedResponsibles.length === 0 || !deadline) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const invalidShiftItem = checklistItems.some(
      (item) => item.text.trim() && item.checkMode === 'shift' && !item.requiresMorning && !item.requiresAfternoon
    );
    if (invalidShiftItem) {
      toast.error('Selecione ao menos manhã ou tarde para os itens do tipo "Manhã e Tarde".');
      return;
    }

    const taskDate = isRecurring ? computeNextEffectiveDate() : date;
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
        recurring_interval_days: isRecurring ? recurringIntervalDays : 1,
        is_standby: isStandby,
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
      .filter((item) => item.text.trim())
      .map((item) => ({
        task_id: task.id,
        text: item.text,
        check_mode: item.checkMode,
        requires_morning_check: item.checkMode === 'shift' ? item.requiresMorning : false,
        morning_cutoff: item.checkMode === 'shift' && item.requiresMorning ? item.morningCutoff : null,
        requires_afternoon_check: item.checkMode === 'shift' ? item.requiresAfternoon : false,
        afternoon_cutoff: item.checkMode === 'shift' && item.requiresAfternoon ? item.afternoonCutoff : null,
        monthly_day: item.checkMode === 'monthly' ? item.monthlyDay : null,
        interval_hours: item.checkMode === 'interval' ? item.intervalHours : null,
        interval_window_start: item.checkMode === 'interval' ? item.intervalWindowStart : '08:00',
        interval_window_end: item.checkMode === 'interval' ? item.intervalWindowEnd : '18:00',
        period_key:
          item.checkMode === 'weekly' || item.checkMode === 'biweekly'
            ? computePeriodKey(item.checkMode, new Date(`${taskDate}T12:00:00`))
            : null,
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
    <div className="mx-auto w-full max-w-4xl min-h-screen px-1 pb-10">
      
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

      <Card className="rounded-[28px] border border-gray-200 dark:border-[#183521] bg-white dark:bg-[#08110c]/96 p-6 shadow-[0_28px_80px_-48px_rgba(0,0,0,.08)] dark:shadow-[0_28px_80px_-48px_rgba(0,0,0,.95)] md:p-8">
        
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
                    {priorityLabel(level)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    rounded-2xl
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
            rounded-2xl
          ">
            <Checkbox
              checked={isRecurring}
              onCheckedChange={(checked) => setIsRecurring(Boolean(checked))}
            />

            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-white">
                Demanda fixa
              </p>

              <p className="text-sm text-gray-600 dark:text-[#A1A1A1]">
                {recurringIntervalDays <= 1
                  ? 'Essa demanda deverá ser realizada todos os dias durante o expediente.'
                  : `Essa demanda se repete a cada ${recurringIntervalDays} dias.`}
              </p>

              {isRecurring && (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Todo dia', value: 1 },
                      { label: 'Toda semana', value: 7 },
                      { label: 'A cada 15 dias', value: 15 },
                      { label: 'Todo mês', value: 30 },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setRecurringIntervalDays(option.value)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                          recurringIntervalDays === option.value
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-gray-300 bg-white text-gray-700 dark:border-[#2A2A2A] dark:bg-[#181818] dark:text-[#A1A1A1]'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="whitespace-nowrap text-sm text-gray-700 dark:text-[#A1A1A1]">
                      Ou a cada
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={recurringIntervalDays}
                      onChange={(e) => setRecurringIntervalDays(Math.max(1, Number(e.target.value) || 1))}
                      className="w-20 bg-white dark:bg-[#181818] border-gray-300 dark:border-[#2A2A2A] text-gray-900 dark:text-white"
                    />
                    <span className="text-sm text-gray-700 dark:text-[#A1A1A1]">dia(s)</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="
            flex
            items-center
            gap-3
            p-4
            bg-amber-50
            border
            border-amber-200
            dark:bg-[#181818]
            dark:border-[#2A2A2A]
            rounded-2xl
          ">
            <Checkbox
              checked={isStandby}
              onCheckedChange={(checked) => setIsStandby(Boolean(checked))}
            />

            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-white">
                Criar em standby
              </p>

              <p className="text-sm text-gray-600 dark:text-[#A1A1A1]">
                A demanda fica pausada e não conta como atraso nem gera avisos até o gestor clicar em "Ativar" no painel.
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
              <div key={index} className="space-y-2 rounded-2xl border border-gray-200 p-3 dark:border-[#2A2A2A]">
                <div className="flex gap-2">
                  <Input
                    value={item.text}
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

                <div className="flex flex-wrap items-center gap-2 pl-1">
                  <Label className="text-xs text-gray-600 dark:text-[#A1A1A1]">Tipo de checagem</Label>
                  <Select
                    value={item.checkMode}
                    onValueChange={(value) => patchChecklistItem(index, { checkMode: value as CheckMode })}
                  >
                    <SelectTrigger className="h-8 w-44 bg-white text-xs dark:bg-[#181818] border-gray-300 dark:border-[#2A2A2A] text-gray-900 dark:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simple">Diário (uma marcação)</SelectItem>
                      <SelectItem value="shift">Manhã e Tarde</SelectItem>
                      <SelectItem value="weekly">Semanal (segunda a sexta)</SelectItem>
                      <SelectItem value="biweekly">Quinzenal (1ª e 2ª metade do mês)</SelectItem>
                      <SelectItem value="monthly">Mensal (um dia do mês)</SelectItem>
                      <SelectItem value="interval">Contínuo (a cada X horas)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {item.checkMode === 'shift' && (
                  <div className="flex flex-wrap items-center gap-4 pl-1 text-xs text-gray-600 dark:text-[#A1A1A1]">
                    <label className="flex items-center gap-1.5">
                      <Checkbox
                        checked={item.requiresMorning}
                        onCheckedChange={(checked) => patchChecklistItem(index, { requiresMorning: Boolean(checked) })}
                      />
                      Manhã, até
                      <Input
                        type="time"
                        disabled={!item.requiresMorning}
                        value={item.morningCutoff}
                        onChange={(e) => patchChecklistItem(index, { morningCutoff: e.target.value })}
                        className="h-7 w-24 bg-white px-2 text-xs dark:bg-[#181818] border-gray-300 dark:border-[#2A2A2A] text-gray-900 dark:text-white"
                      />
                    </label>

                    <label className="flex items-center gap-1.5">
                      <Checkbox
                        checked={item.requiresAfternoon}
                        onCheckedChange={(checked) => patchChecklistItem(index, { requiresAfternoon: Boolean(checked) })}
                      />
                      Tarde, até
                      <Input
                        type="time"
                        disabled={!item.requiresAfternoon}
                        value={item.afternoonCutoff}
                        onChange={(e) => patchChecklistItem(index, { afternoonCutoff: e.target.value })}
                        className="h-7 w-24 bg-white px-2 text-xs dark:bg-[#181818] border-gray-300 dark:border-[#2A2A2A] text-gray-900 dark:text-white"
                      />
                    </label>
                  </div>
                )}

                {item.checkMode === 'weekly' && (
                  <p className="pl-1 text-xs text-gray-600 dark:text-[#A1A1A1]">
                    Fica ativo o expediente inteiro, de segunda a sexta — uma marcação resolve a semana toda.
                    Se ninguém marcar até sexta, fica vencido.
                  </p>
                )}

                {item.checkMode === 'biweekly' && (
                  <p className="pl-1 text-xs text-gray-600 dark:text-[#A1A1A1]">
                    Precisa de uma marcação na primeira metade do mês (dias 1 a 15) e outra na segunda
                    metade (dias 16 ao fim do mês).
                  </p>
                )}

                {item.checkMode === 'monthly' && (
                  <div className="flex flex-wrap items-center gap-2 pl-1 text-xs text-gray-600 dark:text-[#A1A1A1]">
                    <span>Aparece esmaecido todo dia e libera pra marcar no dia</span>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={item.monthlyDay}
                      onChange={(e) => patchChecklistItem(index, { monthlyDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })}
                      className="h-7 w-16 bg-white px-2 text-xs dark:bg-[#181818] border-gray-300 dark:border-[#2A2A2A] text-gray-900 dark:text-white"
                    />
                    <span>de cada mês</span>
                  </div>
                )}

                {item.checkMode === 'interval' && (
                  <div className="flex flex-wrap items-center gap-2 pl-1 text-xs text-gray-600 dark:text-[#A1A1A1]">
                    <span>Precisa marcar a cada</span>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={item.intervalHours}
                      onChange={(e) => patchChecklistItem(index, { intervalHours: Math.max(1, Number(e.target.value) || 1) })}
                      className="h-7 w-16 bg-white px-2 text-xs dark:bg-[#181818] border-gray-300 dark:border-[#2A2A2A] text-gray-900 dark:text-white"
                    />
                    <span>hora(s), entre</span>
                    <Input
                      type="time"
                      value={item.intervalWindowStart}
                      onChange={(e) => patchChecklistItem(index, { intervalWindowStart: e.target.value })}
                      className="h-7 w-24 bg-white px-2 text-xs dark:bg-[#181818] border-gray-300 dark:border-[#2A2A2A] text-gray-900 dark:text-white"
                    />
                    <span>e</span>
                    <Input
                      type="time"
                      value={item.intervalWindowEnd}
                      onChange={(e) => patchChecklistItem(index, { intervalWindowEnd: e.target.value })}
                      className="h-7 w-24 bg-white px-2 text-xs dark:bg-[#181818] border-gray-300 dark:border-[#2A2A2A] text-gray-900 dark:text-white"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-4">

            <Button
              type="submit"
              className="flow-primary-button rounded-2xl px-5"
            >
              Salvar Demanda
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/')}
              className="rounded-2xl border-[#1c3a5e] bg-[#0d1830] text-white hover:bg-[#12233d]"
            >
              Cancelar
            </Button>

          </div>
        </form>
      </Card>
    </div>
  );
}
