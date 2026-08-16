import type { ButtonHTMLAttributes, ReactNode } from 'react';
export function IconButton({ label, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    children: ReactNode;
}) { return <button className="ui-icon-button" aria-label={label} title={label} {...props}>{children}</button>; }
