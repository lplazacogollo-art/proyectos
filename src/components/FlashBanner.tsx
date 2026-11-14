import { CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';
import type { FlashMessage } from '../types';

interface FlashBannerProps {
  messages: FlashMessage[];
  onDismiss: (id: string) => void;
}

export function FlashBanner({ messages, onDismiss }: FlashBannerProps) {
  if (messages.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex w-full max-w-md flex-col gap-2.5 px-4 sm:px-0">
      {messages.map((msg) => {
        const styles =
          msg.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : msg.type === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-red-200 bg-red-50 text-red-900';

        const Icon =
          msg.type === 'success'
            ? CheckCircle2
            : msg.type === 'warning'
              ? AlertTriangle
              : XCircle;

        const iconColor =
          msg.type === 'success'
            ? 'text-emerald-600'
            : msg.type === 'warning'
              ? 'text-amber-600'
              : 'text-red-600';

        return (
          <div
            key={msg.id}
            role="status"
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-md transition-all ${styles}`}
          >
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} />
            <p className="flex-1 text-sm font-medium leading-snug">{msg.text}</p>
            <button
              type="button"
              onClick={() => onDismiss(msg.id)}
              aria-label="Cerrar notificación"
              className="rounded-md p-1 opacity-60 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
