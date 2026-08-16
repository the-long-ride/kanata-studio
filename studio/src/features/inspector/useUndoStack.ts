import { useCallback, useRef } from 'react';
export function useUndoStack<T>(limit = 50) { const stack = useRef<T[]>([]); const push = useCallback((v: T) => { stack.current = [...stack.current.slice(-(limit - 1)), structuredClone(v)]; }, [limit]); const undo = useCallback(() => stack.current.pop(), []); return { push, undo, size: () => stack.current.length }; }
