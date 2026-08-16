import { Code2, Eye, Plus, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/Button';
import type { ActionSpec, KeyboardLayout, StudioProfile } from '../../lib/types';
import { KeyboardCanvas } from '../keyboard/KeyboardCanvas';
import { LayerRail } from './LayerRail';
import { RawEditor } from './RawEditor';
export function AdvancedWorkspace({ profile, layout, activeLayer, selectedKey, direct, inherited, preview, onSelectKey, onLayer, onAddLayer, onConvertRaw, onRawValidate, onRawApply, onPreview, }: {
    profile: StudioProfile;
    layout: KeyboardLayout;
    activeLayer: string;
    selectedKey?: string;
    direct: Record<string, ActionSpec>;
    inherited: Record<string, ActionSpec>;
    preview?: string;
    onSelectKey: (key: string) => void;
    onLayer: (layer: string) => void;
    onAddLayer: () => void;
    onConvertRaw: () => void;
    onRawValidate: (text: string) => Promise<{
        ok: boolean;
        message?: string | null;
    }>;
    onRawApply: (text: string) => Promise<void>;
    onPreview: () => void;
}) {
    const [showPreview, setShowPreview] = useState(false);
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
    return (<div className="advanced-layout">
      <aside className="layer-rail">
        <LayerRail layers={layers} active={activeLayer} onSelect={onLayer} onAdd={onAddLayer}/>
      </aside>
      <section className="advanced-main">
        <div className="advanced-toolbar">
          <strong>{activeLayer}</strong>
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
          </div>) : (<KeyboardCanvas layout={layout} selected={selectedKey} onSelect={onSelectKey} direct={direct} inherited={inherited}/>)}
      </section>
    </div>);
}
