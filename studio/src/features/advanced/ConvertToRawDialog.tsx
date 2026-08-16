import { Button } from '../../components/Button';
export function ConvertToRawDialog({ open, onCancel, onConvert }: {
    open: boolean;
    onCancel: () => void;
    onConvert: () => void;
}) {
    if (!open)
        return null;
    return <div className="dialog-backdrop"><div className="dialog"><h3>Convert to Raw Kanata mode?</h3><p>This is one-way for editing. The generated `.kbd` becomes the source of truth and visual editing becomes read-only.</p><div><Button onClick={onCancel}>Cancel</Button> <Button className="primary" onClick={onConvert}>Convert</Button></div></div></div>;
}
