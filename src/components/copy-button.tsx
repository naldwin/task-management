import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { copyText } from '../lib/utils';
import { CheckIcon, CopyIcon } from './icons';

type CopyButtonProps = {
  text: string;
  label: string;
  className?: string;
  iconClassName?: string;
  /** 'icon' = icon-only; 'button' = .btn styled with Copy/Copied text */
  variant?: 'icon' | 'button';
};

/**
 * "Copied!" bubble rendered in a portal with position:fixed.
 * The task table lives inside an overflow-x:auto scroll container, which
 * clips any absolutely-positioned tooltip — no z-index can escape that.
 * A fixed-position portal sits above everything and never gets clipped.
 */
function CopiedBubble({ anchor }: { anchor: HTMLElement | null }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!anchor) return;
    const update = () => {
      const r = anchor.getBoundingClientRect();
      setPos({ top: r.top - 6, left: r.left + r.width / 2 });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [anchor]);

  if (!pos) return null;
  return createPortal(
    <span
      role="status"
      style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translate(-50%, -100%)', zIndex: 9999 }}
      className="whitespace-nowrap rounded-sm2 border border-charcoal-600 bg-charcoal-700 px-1.5 py-0.5 text-[11px] text-slate-100 shadow-lg shadow-black/40"
    >
      Copied!
    </span>,
    document.body,
  );
}

export function CopyButton({ text, label, className = '', iconClassName = 'h-3.5 w-3.5', variant = 'icon' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const anchorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onClick = async () => {
    try {
      await copyText(text);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 600);
    } catch {
      /* clipboard unavailable — leave state unchanged */
    }
  };

  if (variant === 'button') {
    return (
      <span ref={anchorRef} className="relative inline-flex">
        <button
          type="button"
          className={`btn ml-2 !px-2 !py-0.5 text-xs ${className}`}
          title={copied ? 'Copied!' : `Copy ${label}`}
          aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
          onClick={onClick}
        >
          <span aria-hidden className="inline-flex shrink-0">
            {copied ? <CheckIcon className={`${iconClassName} text-accent`} /> : <CopyIcon className={iconClassName} />}
          </span>
          {copied ? 'Copied' : 'Copy'}
        </button>
        {copied && <CopiedBubble anchor={anchorRef.current} />}
      </span>
    );
  }

  return (
    <span ref={anchorRef} className="relative inline-flex">
      <button
        type="button"
        className={`text-muted hover:text-white inline-flex ${copied ? '!text-accent' : ''} ${className}`}
        title={copied ? 'Copied!' : `Copy ${label}`}
        aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
        onClick={onClick}
      >
        {copied ? <CheckIcon className={iconClassName} /> : <CopyIcon className={iconClassName} />}
      </button>
      {copied && <CopiedBubble anchor={anchorRef.current} />}
    </span>
  );
}
