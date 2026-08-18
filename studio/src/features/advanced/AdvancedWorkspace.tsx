import { Code2, Eye } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/Button';
import type { ActionSpec, ChordSet, KeyboardLayout, StudioProfile } from '../../lib/types';
import { KeyboardCanvas } from '../keyboard/KeyboardCanvas';
import { ChordEditor } from './ChordEditor';
import { LayerRail } from './LayerRail';
import { RawEditor } from './RawEditor';

type WorkspaceMode = 'layers' | 'chords';

export function AdvancedWorkspace({
    profile, layout, activeLayer, selectedKey, direct, inherited, preview,
    onSelectKey, onLayer, onAddLayer, onChordSetsChange, onSelectChord,
    onConvertRaw, onRawValidate, onRawApply, onPreview,
}: {
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
    onRawValidate: (text: string) => Promise<{
        ok: boolean;
        message?: string | null;
    }>;
    onRawApply: (text: string) => Promise<void>;
    onPreview: () => void;
}) {
    const [showPreview, setShowPreview] = useState(false);
    const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('layers');
    if (profile.source.kind === 'raw') {
        return (<div className="advanced-raw-layout">
        <div className="advanced-toolbar">
          <strong>Raw Kanata</strong>
          <span className="muted">.kbd is source of truth</span>
        </div>
        <RawEditor value={profile.source.kbd} onValidate={onRawValidate} onApply={onRawApply}/>
      </div>);
    }
    const layers = ['base', ...profile.source.advanced.layers.map((layer) => layer.name)];
    const chooseMode = (next: WorkspaceMode) => {
        setWorkspaceMode(next);
        setShowPreview(false);
        if (next === 'chords') onSelectKey(undefined);
        else onSelectChord();
    };
    return (<div className={`advanced-layout ${workspaceMode === 'chords' ? 'chord-mode' : ''}`}>
      {workspaceMode === 'layers' && <aside className="layer-rail">
        <LayerRail layers={layers} active={activeLayer} onSelect={onLayer} onAdd={onAddLayer}/>
      </aside>}
      <section className="advanced-main">
        <div className="advanced-toolbar">
          <strong>{workspaceMode === 'layers' ? activeLayer : 'Chords'}</strong>
          <div className="mode-switch" aria-label="Advanced visual mode">
            <button className={workspaceMode === 'layers' ? 'active' : ''} onClick={() => chooseMode('layers')}>Layers</button>
            <button className={workspaceMode === 'chords' ? 'active' : ''} onClick={() => chooseMode('chords')}>Chords</button>
          </div>
          <div className="topbar-spacer"/>
          <Button onClick={() => { onPreview(); setShowPreview(true); }}><Eye size={14}/> Preview .kbd</Button>
          <Button onClick={onConvertRaw}><Code2 size={14}/> Raw mode</Button>
        </div>
        {showPreview && preview ? (<div className="preview-panel">
            <div className="preview-head">
              <span>Generated Kanata config</span>
              <button onClick={() => setShowPreview(false)}>×</button>
            </div>
            <pre>{preview}</pre>
          </div>) : workspaceMode === 'chords' ? (
            <ChordEditor
              chordSets={profile.source.advanced.chordSets ?? []}
              layers={layers}
              onChange={onChordSetsChange}
              onSelect={(setIndex, chordIndex) => onSelectChord(setIndex, chordIndex)}
            />
          ) : (<KeyboardCanvas layout={layout} selected={selectedKey}
            onSelect={key => onSelectKey(key)} direct={direct} inherited={inherited}/>)}
      </section>
    </div>);
}
