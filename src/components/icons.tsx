type IconProps = { className?: string };

function Base({ className = 'h-4 w-4', children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return <Base className={className}><path d="M12 5v14M5 12h14" /></Base>;
}

export function DotsIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function LogoutIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </Base>
  );
}

export function CopyIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Base>
  );
}

export function ExternalIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14L21 3" />
    </Base>
  );
}

export function CloseIcon({ className }: IconProps) {
  return <Base className={className}><path d="M18 6L6 18M6 6l12 12" /></Base>;
}

export function CheckIcon({ className }: IconProps) {
  return <Base className={className}><path d="M20 6L9 17l-5-5" /></Base>;
}

export function SaveIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </Base>
  );
}

export function PrintIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M6 9V2h12v7" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </Base>
  );
}

export function ChevronLeftIcon({ className }: IconProps) {
  return <Base className={className}><path d="M15 18l-6-6 6-6" /></Base>;
}

export function ChevronUpIcon({ className }: IconProps) {
  return <Base className={className}><path d="M18 15l-6-6-6 6" /></Base>;
}

export function ChevronRightIcon({ className }: IconProps) {
  return <Base className={className}><path d="M9 18l6-6-6-6" /></Base>;
}

export function BoardIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <rect x="3" y="3" width="7" height="18" rx="1" />
      <rect x="14" y="3" width="7" height="10" rx="1" />
    </Base>
  );
}

export function TableIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18" />
    </Base>
  );
}

export function ArchiveIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </Base>
  );
}

export function SendIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </Base>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Base>
  );
}

export function RefreshIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M23 4v6h-6" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </Base>
  );
}
