export function WorkloggerLogo({ className = 'h-8 w-auto' }: { className?: string }) {
  return (
    <img
      src="/images/worklogger-logo.png"
      alt="Worklogger"
      className={`${className} mix-blend-screen`}
    />
  );
}

export function WorkloggerMark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <img
      src="/images/w-logo.png"
      alt="Worklogger"
      className={`${className} rounded-sm2 mix-blend-screen`}
    />
  );
}
