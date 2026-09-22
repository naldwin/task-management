export function isOverdue(dueDate: string | null | undefined, category?: string): boolean {
  if (!dueDate) return false;
  if (category === 'Done' || category === 'Cancelled') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dueDate) < today;
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthStartOf(key: string): Date {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

export function currentMonthKey(): string {
  return monthKey(new Date());
}

export function can(perform: string, role: string | null | undefined): boolean {
  if (!role) return false;
  switch (perform) {
    case 'manage-space':
      return role === 'owner';
    case 'manage-status':
    case 'manage-report':
    case 'invite':
      return role === 'owner' || role === 'lead';
    case 'create-task':
    case 'comment':
      return role === 'owner' || role === 'lead' || role === 'member';
    case 'read':
      return true;
    default:
      return false;
  }
}

export function copyText(t: string): Promise<void> {
  if (navigator.clipboard) return navigator.clipboard.writeText(t);
  return Promise.reject(new Error('clipboard unavailable'));
}

/** Copy-ready task identifier: `KEY-slugified-title` (e.g. `HC-001-create-a-task`). */
export function taskCopyKey(key: string, title: string): string {
  const slug = (title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `${key}-${slug}` : key;
}

/**
 * Race a promise against a timeout so UI actions can never spin forever
 * (e.g. Supabase unreachable, wrong VITE_SUPABASE_URL, ad-blocker).
 */
export async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s. Check your connection and VITE_SUPABASE_URL in .env, then restart the dev server.`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
