export function StatusDot({ error = false }: {
    error?: boolean;
}) { return <span className={`status-dot ${error ? 'error' : ''}`} aria-hidden/>; }
