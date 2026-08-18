import { useEffect, useId, type ReactNode } from 'react';

export function Modal({
  open = true,
  title,
  onClose,
  className = '',
  children,
}: {
  open?: boolean;
  title: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section
      className={`dialog ${className}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={event => event.stopPropagation()}
    >
      <h3 id={titleId}>{title}</h3>
      {children}
    </section>
  </div>;
}
