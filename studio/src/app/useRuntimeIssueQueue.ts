import { useCallback, useState } from 'react';
import {
  enqueueIssue,
  errorDetails,
  type RuntimeIssue,
} from './runtimeIssues';

export function useRuntimeIssueQueue() {
  const [queue, setQueue] = useState<RuntimeIssue[]>([]);
  const [retrying, setRetrying] = useState(false);
  const issue = queue[0];

  const report = useCallback((next: RuntimeIssue) => {
    setQueue((current) => enqueueIssue(current, next));
  }, []);

  const dismiss = useCallback(() => {
    setQueue((current) => current.slice(1));
  }, []);

  const retry = useCallback(async () => {
    if (!issue?.retry || retrying) return;
    setRetrying(true);
    try {
      await issue.retry();
      setQueue((current) => current.filter((item) => item.key !== issue.key));
    } catch (error) {
      report({ ...issue, technicalDetails: errorDetails(error) });
    } finally {
      setRetrying(false);
    }
  }, [issue, report, retrying]);

  return { issue, report, dismiss, retry, retrying };
}
