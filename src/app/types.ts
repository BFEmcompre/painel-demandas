export interface User {
  id: string;
  name: string;
  email: string;
  role: 'manager' | 'responsible';
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  responsibleId: string;
  responsibleName: string;
  date: string;
  deadline: string;
  status: 'pending' | 'completed' | 'overdue';
  checklist: ChecklistItem[];
  photo?: string;
  completedAt?: string;
  observation?: string;
}

export interface Responsible {
  id: string;
  name: string;
  email: string;
  tasksCount: number;
  completedCount: number;
}
