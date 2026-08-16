export function Toggle({ checked, onChange, label }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
}) { return <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}/><span>{label}</span></label>; }
