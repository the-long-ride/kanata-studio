export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return <label className={`ui-switch ${disabled ? 'disabled' : ''}`}>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      onChange={event => onChange(event.target.checked)}
    />
    <span className="ui-switch-track" aria-hidden="true">
      <span className="ui-switch-thumb" />
    </span>
    <span className="ui-switch-label">{label}</span>
  </label>;
}
