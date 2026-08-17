import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeyboardCanvas } from './KeyboardCanvas';
import { keyboardEventCodeToKanataId } from './keyEventCode';

afterEach(cleanup);

describe('KeyboardCanvas', () => {
  it('selects a key and exposes inherited state', () => {
    const onSelect = vi.fn();
    render(
      <KeyboardCanvas
        layout="Ansi"
        onSelect={onSelect}
        direct={{}}
        inherited={{ caps: { type: 'key', key: 'esc' } }}
      />,
    );
    const caps = screen.getByRole('button', { name: /Caps/ });
    expect(caps.title).toBe('Inherited from Global');
    fireEvent.click(caps);
    expect(onSelect).toHaveBeenCalledWith('caps');
  });

  it('shows physical key presses without changing selection', () => {
    const onSelect = vi.fn();
    render(
      <KeyboardCanvas
        layout="Ansi"
        selected="a"
        onSelect={onSelect}
        direct={{}}
        inherited={{}}
      />,
    );

    const caps = screen.getByRole('button', { name: /Caps/ });
    fireEvent.keyDown(window, { code: 'CapsLock' });
    expect(caps.classList.contains('pressed')).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.keyUp(window, { code: 'CapsLock' });
    expect(caps.classList.contains('pressed')).toBe(false);
    expect(screen.getByRole('button', { name: 'A' }).classList.contains('selected')).toBe(true);
  });

  it('clears physical pressed state when the window loses focus', () => {
    render(
      <KeyboardCanvas layout="Ansi" onSelect={() => undefined} direct={{}} inherited={{}} />,
    );
    const caps = screen.getByRole('button', { name: /Caps/ });
    fireEvent.keyDown(window, { code: 'CapsLock' });
    expect(caps.classList.contains('pressed')).toBe(true);
    fireEvent.blur(window);
    expect(caps.classList.contains('pressed')).toBe(false);
  });
});

describe('keyboardEventCodeToKanataId', () => {
  it('maps browser physical key codes to Kanata ids', () => {
    expect(keyboardEventCodeToKanataId('KeyA')).toBe('a');
    expect(keyboardEventCodeToKanataId('Digit1')).toBe('1');
    expect(keyboardEventCodeToKanataId('CapsLock')).toBe('caps');
    expect(keyboardEventCodeToKanataId('Space')).toBe('spc');
    expect(keyboardEventCodeToKanataId('ControlLeft')).toBe('lctl');
    expect(keyboardEventCodeToKanataId('ShiftRight')).toBe('rsft');
    expect(keyboardEventCodeToKanataId('UnknownCode')).toBeUndefined();
  });
});
