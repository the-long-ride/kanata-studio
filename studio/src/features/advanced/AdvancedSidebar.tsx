import { Code2, Eye } from 'lucide-react';
import { Button } from '../../components/Button';
import type { ChordSet, StudioProfile } from '../../lib/types';
import { ChordEditor } from './ChordEditor';
import { LayerRail } from './LayerRail';

export type AdvancedPane = 'layers' | 'chords';

export function AdvancedSidebar({
  profile,
  pane,
  onPane,
  activeLayer,
  onLayer,
  onAddLayer,
  onChordSetsChange,
  onSelectChord,
  preview,
  onPreview,
  onConvertRaw,
}: {
  profile: StudioProfile;
  pane: AdvancedPane;
  onPane: (pane: AdvancedPane) => void;
  activeLayer: string;
  onLayer: (layer: string) => void;
  onAddLayer: () => void;
  onChordSetsChange: (sets: ChordSet[]) => void;
  onSelectChord: (setIndex?: number, chordIndex?: number) => void;
  preview?: string;
  onPreview: () => void;
  onConvertRaw: () => void;
}) {
  if (profile.source.kind === 'raw') {
    return <div className="advanced-sidebar-content">
      <div className="panel-title">Raw profile</div>
      <div className="inspector-body">
        <p className="muted">The .kbd source is authoritative for this profile.</p>
      </div>
    </div>;
  }

  const layers = ['base', ...profile.source.advanced.layers.map(layer => layer.name)];
  const choosePane = (next: AdvancedPane) => {
    onPane(next);
    if (next === 'layers') onSelectChord();
  };

  return <div className="advanced-sidebar-content">
    <div className="advanced-sidebar-tabs mode-switch" role="group" aria-label="Advanced tools">
      <button className={pane === 'layers' ? 'active' : ''} onClick={() => choosePane('layers')}>Layers</button>
      <button className={pane === 'chords' ? 'active' : ''} onClick={() => choosePane('chords')}>Chords</button>
    </div>
    <div className="advanced-sidebar-body">
      {pane === 'layers'
        ? <LayerRail layers={layers} active={activeLayer} onSelect={onLayer} onAdd={onAddLayer} />
        : <ChordEditor
          chordSets={profile.source.advanced.chordSets ?? []}
          layers={layers}
          onChange={onChordSetsChange}
          onSelect={onSelectChord}
        />}
    </div>
    <div className="advanced-sidebar-actions">
      <Button onClick={onPreview}><Eye size={14} /> Preview .kbd</Button>
      <Button onClick={onConvertRaw}><Code2 size={14} /> Raw mode</Button>
    </div>
    {preview && <pre className="advanced-sidebar-preview">{preview}</pre>}
  </div>;
}
