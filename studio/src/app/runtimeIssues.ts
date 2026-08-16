export type RuntimeIssueKind = 'persistence' | 'autostart' | 'engine';

export type RuntimeIssue = {
  key: string;
  kind: RuntimeIssueKind;
  title: string;
  message: string;
  technicalDetails: string;
  retry?: () => Promise<void>;
};

export function enqueueIssue(
  queue: RuntimeIssue[],
  issue: RuntimeIssue,
): RuntimeIssue[] {
  const existing = queue.findIndex((item) => item.key === issue.key);
  if (existing < 0) return [...queue, issue];
  const next = [...queue];
  next[existing] = issue;
  return next;
}

export function persistenceIssue(
  error: unknown,
  retry?: () => Promise<void>,
): RuntimeIssue {
  return {
    key: 'onboarding-persistence',
    kind: 'persistence',
    title: 'Could not finish setup',
    message: 'Kanata Studio could not save your setup. Retry to continue.',
    technicalDetails: errorDetails(error),
    retry,
  };
}

export function keyboardPersistenceIssue(
  operation: 'configure' | 'update' | 'copy',
  error: unknown,
  retry?: () => Promise<void>,
): RuntimeIssue {
  const labels = {
    configure: ['Could not set up keyboard', 'Studio could not save this keyboard configuration.'],
    update: ['Could not save keyboard settings', 'Studio could not save changes for this keyboard.'],
    copy: ['Could not copy keyboard settings', 'Studio could not copy the source keyboard configuration.'],
  } as const;
  const [title, message] = labels[operation];
  return {
    key: `keyboard-${operation}`,
    kind: 'persistence',
    title,
    message,
    technicalDetails: errorDetails(error),
    retry,
  };
}

export function autostartIssue(
  enabled: boolean,
  error: unknown,
  retry?: () => Promise<void>,
): RuntimeIssue {
  return {
    key: 'autostart',
    kind: 'autostart',
    title: enabled
      ? 'Could not enable Start with system'
      : 'Could not disable Start with system',
    message: enabled
      ? 'Studio is ready, but Windows startup registration failed.'
      : 'Studio is ready, but Windows startup registration could not be removed.',
    technicalDetails: errorDetails(error),
    retry,
  };
}

export function engineIssue(
  error: unknown,
  retry?: () => Promise<void>,
): RuntimeIssue {
  return {
    key: 'engine-startup',
    kind: 'engine',
    title: 'Kanata engine could not start',
    message: 'Studio is ready, but remapping is not active.',
    technicalDetails: errorDetails(error),
    retry,
  };
}

export function errorDetails(error: unknown): string {
  if (error instanceof Error) return error.stack || error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}
