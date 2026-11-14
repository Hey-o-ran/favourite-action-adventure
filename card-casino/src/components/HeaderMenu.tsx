import { Fragment, useEffect, useRef, useState } from 'react';

export interface MenuItem {
  id: string;
  label: string;
  onSelect: () => void;
  /** True for the page you're on, which is marked for screen readers. */
  current?: boolean;
  /** Makes this a choice among several (like a language), and says whether it is the chosen one. */
  checked?: boolean;
  /** A small heading shown above this item, to start a new group. */
  heading?: string;
}

/** A Menu button that drops a list of the header actions down, lined up with the right edge of the screen. */
export function HeaderMenu({ items, menuLabel = 'Menu' }: { items: MenuItem[]; menuLabel?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Start on the first item, so the keyboard works straight away.
    root.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();

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
    const list = [...(root.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
    const at = list.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? (at + 1) % list.length : (at - 1 + list.length) % list.length;
    list[next]?.focus();
  };

  return (
    <div className="menu" ref={root} onKeyDown={onKeyDown}>
      <button ref={button} className="menu-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true">☰</span> {menuLabel}
      </button>
      {open && (
        <div className="menu-list" role="menu" aria-label={menuLabel}>
          {items.map((item) => (
            <Fragment key={item.id}>
              {item.heading && (
                <div className="menu-heading" role="presentation">
                  {item.heading}
                </div>
              )}
              <button
                role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                aria-checked={item.checked}
                aria-current={item.current ? 'page' : undefined}
                className={item.checked ? 'checked' : undefined}
                onClick={() => {
                  close(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
