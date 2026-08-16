import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { useEffect, useRef, useState } from 'react';
import type { ValidationResult } from '../../lib/types';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { kanataCompletions } from './KanataCompletions';
import { kanataLanguage } from './KanataLanguage';

export function RawEditor({
  value,
  onValidate,
  onApply,
}: {
  value: string;
  onValidate: (value: string) => Promise<ValidationResult>;
  onApply: (value: string) => Promise<void>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | undefined>(undefined);
  const validateRef = useRef(onValidate);
  const applyRef = useRef(onApply);
  const [diagnostics, setDiagnostics] = useState<ValidationResult>({ ok: true });

  validateRef.current = onValidate;
  applyRef.current = onApply;

  useEffect(() => {
    if (!host.current) return;
    let timer: number | undefined;
    const state = EditorState.create({
      doc: value,
      extensions: [
        kanataLanguage,
        autocompletion({ override: [kanataCompletions] }),
        keymap.of(completionKeymap),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          window.clearTimeout(timer);
          timer = window.setTimeout(async () => {
            const text = update.state.doc.toString();
            const result = await validateRef.current(text);
            setDiagnostics(result);
            if (result.ok) await applyRef.current(text);
          }, 350);
        }),
      ],
    });
    view.current = new EditorView({ state, parent: host.current });
    return () => {
      window.clearTimeout(timer);
      view.current?.destroy();
      view.current = undefined;
    };
  }, []);

  useEffect(() => {
    const editor = view.current;
    if (!editor || editor.state.doc.toString() === value) return;
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: value },
    });
  }, [value]);

  return (
    <div className="raw-editor">
      <div ref={host} />
      <DiagnosticsPanel result={diagnostics} />
    </div>
  );
}
