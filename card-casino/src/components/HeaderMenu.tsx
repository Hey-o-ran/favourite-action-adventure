import { useEffect, useRef, useState } from 'react';

export interface MenuItem {
  id: string;
  label: string;
  onSelect: () => void;
  /** True for the page you're on, which is marked for screen readers. */
  current?: boolean;
}

/** A Menu button that drops a list of the header actions down, lined up with the right edge of the screen. */
export function HeaderMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Start on the first item, so the keyboard works straight away.
    root.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();

    const onPointerDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const list = [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const at = list.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? (at + 1) % list.length : (at - 1 + list.length) % list.length;
    list[next]?.focus();
  };

  return (
    <div className="menu" ref={root} onKeyDown={onKeyDown}>
      <button ref={button} className="menu-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true">☰</span> Menu
      </button>
      {open && (
        <div className="menu-list" role="menu" aria-label="Menu">
          {items.map((item) => (
            <button
              key={item.id}
              role="menuitem"
              aria-current={item.current ? 'page' : undefined}
              onClick={() => {
                close(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
