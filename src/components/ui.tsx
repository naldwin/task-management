import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { RefreshIcon } from './icons';

export function Button({
  variant = 'default',
  className = '',
  icon,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'danger' | 'ghost'; icon?: ReactNode }) {
  const v = variant === 'primary' ? 'btn btn-primary' : variant === 'danger' ? 'btn btn-danger' : variant === 'ghost' ? 'btn btn-ghost' : 'btn';
  return (
    <button className={`${v} ${className}`} {...rest}>
      {icon && <span aria-hidden className="inline-flex shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref) {
  return <input ref={ref} className={`input ${props.className ?? ''}`} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(props, ref) {
  return <select ref={ref} className={`input ${props.className ?? ''}`} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(props, ref) {
  return <textarea ref={ref} className={`input ${props.className ?? ''}`} {...props} />;
});

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <label className="label">{label}</label>
      {children}
      {error && <p className="error-text" role="alert">{error}</p>}
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card p-6 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <p className="text-sm text-muted py-4" role="status">{label}</p>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card p-4 border-red-900" role="alert">
      <p className="text-sm text-red-200">{message}</p>
      {onRetry && <button className="btn mt-2" onClick={onRetry}><span aria-hidden className="inline-flex shrink-0"><RefreshIcon className="h-4 w-4" /></span>Retry</button>}
    </div>
  );
}

export function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full border border-black/40" style={{ background: color }} />
      <span>{label}</span>
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const color =
    priority === 'Urgent' ? 'text-red-300 border-red-900' : priority === 'High' ? 'text-amber-200 border-amber-900' : 'text-muted';
  return <span className={`badge ${color}`}>{priority}</span>;
}
