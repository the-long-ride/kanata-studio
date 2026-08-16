import { useCallback, useRef, useState } from 'react';
export type ApplyState = 'Idle' | 'Applying' | 'Applied' | 'Error';
export function useAutoApply<T>(apply: (v: T) => Promise<void>, delay = 0) {
    const [state, setState] = useState<ApplyState>('Idle');
    const timer = useRef<number | null>(null);
    const last = useRef<string>('');
    const submit = useCallback((value: T) => {
        const key = JSON.stringify(value);
        if (key === last.current)
            return;
        if (timer.current)
            window.clearTimeout(timer.current);
        timer.current = window.setTimeout(async () => {
            setState('Applying');
            try {
                await apply(value);
                last.current = key;
                setState('Applied');
            }
            catch {
                setState('Error');
            }
        }, delay);
    }, [apply, delay]);
    return { state, submit };
}
