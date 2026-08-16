import type { ValidationResult } from '../../lib/types';
export function DiagnosticsPanel({ result }: {
    result: ValidationResult;
}) { return <div className={`diagnostics ${result.ok ? 'ok' : 'bad'}`}>{result.ok ? 'Valid Kanata config' : result.message ?? 'Invalid config'}{result.span && <span> · {result.span.line}:{result.span.column}</span>}</div>; }
