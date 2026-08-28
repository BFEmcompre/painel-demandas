import { X, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Button } from '../ui/button';

interface AlertNotificationProps {
  message: string;
  type: 'overdue' | 'completed' | 'pending';
  onClose: () => void;
  onMarkAsViewed?: () => void;
}

export function AlertNotification({
  message,
  type,
  onClose,
  onMarkAsViewed,
}: AlertNotificationProps) {
  const styles = {
    overdue: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-800',
      icon: AlertCircle,
      iconColor: 'text-red-500',
    },
    completed: {
      bg: 'bg-green-50 border-green-200',
      text: 'text-green-800',
      icon: CheckCircle,
      iconColor: 'text-green-500',
    },
    pending: {
      bg: 'bg-yellow-50 border-yellow-200',
      text: 'text-yellow-800',
      icon: Clock,
      iconColor: 'text-yellow-500',
    },
  };

  const style = styles[type];
  const Icon = style.icon;

  return (
    <div className="fixed top-6 right-6 z-50">
      <div className={`${style.bg} border rounded-lg shadow-lg p-4 pr-12 max-w-md`}>
        <div className="flex items-start gap-3">
          <Icon className={`w-5 h-5 ${style.iconColor} mt-0.5 flex-shrink-0`} />
          <div>
            <p className={`${style.text} text-sm font-medium`}>{message}</p>

            {onMarkAsViewed && (
              <Button
                type="button"
                size="sm"
                className="mt-3 bg-red-600 hover:bg-red-700"
                onClick={onMarkAsViewed}
              >
                Marcar como visto
              </Button>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className={`absolute top-3 right-3 ${style.text} hover:opacity-70 transition-opacity`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}