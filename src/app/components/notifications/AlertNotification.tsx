import { useEffect, useRef } from 'react';
import { X, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface AlertNotificationProps {
  message: string;
  type: 'overdue' | 'completed' | 'pending';
  onClose: () => void;
}

export function AlertNotification({ message, type, onClose }: AlertNotificationProps) {
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (notifiedRef.current) return;
    notifiedRef.current = true;

    async function notify() {
      try {
        if (!('Notification' in window)) return;

        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission();

          if (permission !== 'granted') return;
        }

        if (Notification.permission === 'granted') {
          new Notification('Painel de Demandas', {
            body: message,
          });
        }
      } catch (error) {
        console.log('Notificação do navegador não permitida');
      }
    }

    notify();
  }, [message]);

  const Icon =
    type === 'overdue' ? AlertCircle : type === 'completed' ? CheckCircle : Clock;

  const color =
    type === 'overdue'
      ? 'bg-red-50 border-red-200 text-red-800'
      : type === 'completed'
      ? 'bg-green-50 border-green-200 text-green-800'
      : 'bg-yellow-50 border-yellow-200 text-yellow-800';

  const iconColor =
    type === 'overdue'
      ? 'text-red-500'
      : type === 'completed'
      ? 'text-green-500'
      : 'text-yellow-500';

  return (
    <div className="fixed top-6 right-6 z-50">
      <div className={`${color} border rounded-lg shadow-lg p-4 pr-12 max-w-md relative`}>
        <div className="flex items-start gap-3">
          <Icon className={`w-5 h-5 ${iconColor} mt-0.5 flex-shrink-0`} />
          <p className="text-sm font-medium">{message}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 hover:opacity-70 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}