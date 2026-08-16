import { Button } from '../../components/Button';
import type { RuntimeIssue } from '../../app/runtimeIssues';
import './runtime-error.css';

type Props = {
  issue?: RuntimeIssue;
  busy: boolean;
  onRetry: () => void;
  onLogs: () => void;
  onDismiss: () => void;
};

export function RuntimeErrorDialog({
  issue,
  busy,
  onRetry,
  onLogs,
  onDismiss,
}: Props) {
  if (!issue) return null;
  return (
    <div className="runtime-error-backdrop" role="presentation">
      <section
        className="runtime-error-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="runtime-error-title"
      >
        <h3 id="runtime-error-title">{issue.title}</h3>
        <p>{issue.message}</p>
        <details>
          <summary>Technical details</summary>
          <pre>{issue.technicalDetails}</pre>
        </details>
        <div className="dialog-actions">
          <Button type="button" onClick={onLogs}>Open logs</Button>
          <Button type="button" onClick={onDismiss}>Dismiss</Button>
          {issue.retry && (
            <Button className="primary" disabled={busy} onClick={onRetry}>
              {busy ? 'Retrying…' : 'Retry'}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
