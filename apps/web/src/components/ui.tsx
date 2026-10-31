'use client';

import type { ReactNode } from 'react';
import { Icon } from '@/lib/icons';

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-10 text-sm text-zinc-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-200 border-t-brand-600" />
      {label ?? 'Loading…'}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function CardSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-zinc-100 bg-white">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'soft';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  icon?: ReactNode;
};

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled,
  type = 'button',
  className = '',
  icon,
}: ButtonProps) {
  const sizes = {
    sm: 'h-8 px-2.5 text-xs gap-1',
    md: 'h-9.5 px-3.5 text-sm gap-1.5',
    lg: 'h-11 px-5 text-sm gap-2',
  } as const;
  const styles = {
    primary:
      'bg-brand-600 text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 active:bg-brand-800',
    soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
    ghost: 'border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50',
    danger: 'border border-red-200 bg-white text-red-600 hover:bg-red-50',
  } as const;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-45 ${sizes[size]} ${styles[variant]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-[13px] font-medium text-zinc-700">{label}</span>
      {children}
      {hint ? <span className="text-xs text-zinc-400">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 hover:border-zinc-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10';

export function Badge({
  children,
  tone = 'zinc',
  icon,
}: {
  children: ReactNode;
  tone?: 'zinc' | 'green' | 'amber' | 'red' | 'blue';
  icon?: ReactNode;
}) {
  const tones = {
    zinc: 'bg-zinc-100 text-zinc-600',
    green: 'bg-brand-50 text-brand-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-sky-50 text-sky-700',
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className={`pop-in max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 bg-white/95 px-5 py-3.5 backdrop-blur">
          <h3 className="text-base font-semibold">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
          >
            <Icon.X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function ErrorNote({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600">
      <Icon.Alert size={15} className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}

export function OkNote({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-sm text-brand-700">
      <Icon.Check size={15} className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-zinc-300 bg-white/60 p-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon.Package size={20} />
      </div>
      <p className="text-sm font-semibold text-zinc-700">{title}</p>
      <p className="max-w-sm text-xs text-zinc-500">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
