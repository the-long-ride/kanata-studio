import { Button } from '../../components/Button';
export function LayerRail({ layers, active, onSelect, onAdd }: {
    layers: string[];
    active: string;
    onSelect: (x: string) => void;
    onAdd: () => void;
}) { return <div><div className="panel-title">Layers</div>{layers.map(l => <button className={`profile-row ${active === l ? 'active' : ''}`} key={l} onClick={() => onSelect(l)}>{l}</button>)}<div className="profile-add"><Button onClick={onAdd}>+ Layer</Button></div></div>; }
