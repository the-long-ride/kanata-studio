import { useState } from 'react';
import type { ActionSpec, ChordSet, KeyboardLayout, StudioProfile } from '../../lib/types';
import { AdvancedSidebar, type AdvancedPane } from './AdvancedSidebar';
import { RawEditor } from './RawEditor';

export function AdvancedWorkspace(props: {
  profile: StudioProfile;
  layout: KeyboardLayout;
  activeLayer: string;
  selectedKey?: string;
  direct: Record<string, ActionSpec>;
  inherited: Record<string, ActionSpec>;
  preview?: string;
  onSelectKey: (key?: string) => void;
  onLayer: (layer: string) => void;
  onAddLayer: () => void;
  onChordSetsChange: (sets: ChordSet[]) => void;
  onSelectChord: (setIndex?: number, chordIndex?: number) => void;
  onConvertRaw: () => void;
  onRawValidate: (text: string) => Promise<{ ok: boolean; message?: string | null }>;
  onRawApply: (text: string) => Promise<void>;
  onPreview: () => void;
}) {
  const [pane, setPane] = useState<AdvancedPane>('layers');
  const { profile } = props;
  if (profile.source.kind === 'raw') {
    return <div className="advanced-raw-layout">
      <div className="advanced-toolbar">
        <strong>Raw Kanata</strong><span className="muted">.kbd is source of truth</span>
      </div>
      <RawEditor value={profile.source.kbd} onValidate={props.onRawValidate} onApply={props.onRawApply} />
    </div>;
  }
  const selectPane = (next: AdvancedPane) => {
    setPane(next);
    if (next === 'chords') props.onSelectKey(undefined);
    else props.onSelectChord();
  };
  return <AdvancedSidebar
    profile={profile}
    pane={pane}
    onPane={selectPane}
    activeLayer={props.activeLayer}
    onLayer={props.onLayer}
    onAddLayer={props.onAddLayer}
    onChordSetsChange={props.onChordSetsChange}
    onSelectChord={props.onSelectChord}
    preview={props.preview}
    onPreview={props.onPreview}
    onConvertRaw={props.onConvertRaw}
  />;
}
