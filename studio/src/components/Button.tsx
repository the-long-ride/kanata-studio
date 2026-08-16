import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
export function Button({ className = '', children, ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) { return <button className={`ui-button ${className}`} {...props}>{children}</button>; }
