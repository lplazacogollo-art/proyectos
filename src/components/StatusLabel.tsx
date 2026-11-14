import { CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react';

interface StatusLabelProps {
  status: string;
}

export function StatusLabel({ status }: StatusLabelProps) {
  const normalized = status.toLowerCase();

  if (normalized === 'pagado' || normalized === 'disponible') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 whitespace-nowrap">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
        {status}
      </span>
    );
  }

  if (normalized === 'parcial' || normalized === 'bajo inventario') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 whitespace-nowrap">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
        {status}
      </span>
    );
  }

  if (normalized === 'agotado') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800 whitespace-nowrap">
        <XCircle className="h-3.5 w-3.5 text-red-600" />
        {status}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 whitespace-nowrap">
      <Clock className="h-3.5 w-3.5 text-[#2563EB]" />
      {status}
    </span>
  );
}
