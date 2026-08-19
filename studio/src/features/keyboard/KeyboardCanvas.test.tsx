import type { ComponentType } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeyboardCanvas } from './KeyboardCanvas';
import { keyboardEventCodeToKanataId } from './keyEventCode';

const Canvas = KeyboardCanvas as unknown as ComponentType<Record<string, unknown>>;

afterEach(cleanup);

describe('KeyboardCanvas', () => {
  it('selects a key and exposes inherited state', () => {
    const onSelect = vi.fn();
    render(<KeyboardCanvas layout="Ansi" onSelect={onSelect} direct={{}}
      inherited={{ caps: { type: 'key', key: 'esc' } }} />);
    const caps = screen.getByRole('button', { name: /Caps/ });
    expect(caps.title).toBe('Inherited from Global');
    fireEvent.click(caps);
    expect(onSelect).toHaveBeenCalledWith('caps');
  });

  it('shows physical key presses without changing selection', () => {
    const onSelect = vi.fn();
    render(<KeyboardCanvas layout="Ansi" selected="a" onSelect={onSelect} direct={{}} inherited={{}} />);
    const caps = screen.getByRole('button', { name: /Caps/ });
    fireEvent.keyDown(window, { code: 'CapsLock' });
    expect(caps.classList.contains('pressed')).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.keyUp(window, { code: 'CapsLock' });
    expect(caps.classList.contains('pressed')).toBe(false);
    expect(screen.getByRole('button', { name: 'A' }).classList.contains('selected')).toBe(true);
  });

  it('clears physical pressed state when the window loses focus', () => {
    render(<KeyboardCanvas layout="Ansi" onSelect={() => undefined} direct={{}} inherited={{}} />);
    const caps = screen.getByRole('button', { name: /Caps/ });
    fireEvent.keyDown(window, { code: 'CapsLock' });
    expect(caps.classList.contains('pressed')).toBe(true);
    fireEvent.blur(window);
    expect(caps.classList.contains('pressed')).toBe(false);
  });

  it('uses the selected keyboard visual preset instead of generic ANSI geometry', () => {
    render(<Canvas layout="Ansi" visualPreset="tkl" onSelect={() => undefined} direct={{}} inherited={{}} />);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Num 1' })).toBeNull();
  });

  it('does not invent an Fn media layer for an unknown generic keyboard', () => {
    render(<KeyboardCanvas layout="Iso" onSelect={() => undefined} direct={{}} inherited={{}} />);
    expect(screen.queryByRole('button', { name: 'Fn layer' })).toBeNull();
    expect(screen.queryByText('Mute')).toBeNull();
  });

  it('shows Fn legends and selects a hardware-controlled Fn key for explanation', () => {
    const onSelect = vi.fn();
    render(<Canvas layout="Ansi" visualPreset="75" onSelect={onSelect} direct={{}} inherited={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fn layer' }));
    expect(screen.getByText('Mute')).toBeTruthy();
    const fn = screen.getByRole('button', { name: /^Fn$/ });
    expect(fn.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(fn);
    expect(onSelect).toHaveBeenCalledWith('fn');
  });

  it('zooms from 50 percent through 200 percent with toolbar controls', () => {
    render(<Canvas layout="Ansi" viewMode="Beginner" viewportResetKey="kbd-1"
      onSelect={() => undefined} direct={{}} inherited={{}} />);
    const zoomOut = screen.getByRole('button', { name: 'Zoom out' });
    const zoomIn = screen.getByRole('button', { name: 'Zoom in' });
    for (let index = 0; index < 10; index += 1) fireEvent.click(zoomOut);
    expect(screen.getByText('50%')).toBeTruthy();
    for (let index = 0; index < 20; index += 1) fireEvent.click(zoomIn);
    expect(screen.getByText('200%')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fit keyboard' })).toBeTruthy();
  });

  it('pans empty space while key clicks remain selection interactions', () => {
    const onSelect = vi.fn();
    render(<Canvas layout="Ansi" viewMode="Advanced" viewportResetKey="kbd-1"
      onSelect={onSelect} direct={{}} inherited={{}} />);
    const viewport = screen.getByTestId('keyboard-viewport');
    const board = screen.getByTestId('keyboard-transform');
    const before = board.getAttribute('style');
    fireEvent.pointerDown(viewport, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 150, clientY: 130 });
    fireEvent.pointerUp(window, { pointerId: 1 });
    expect(board.getAttribute('style')).not.toBe(before);
    const afterPan = board.getAttribute('style');
    fireEvent.click(screen.getByRole('button', { name: 'A' }));
    expect(onSelect).toHaveBeenCalledWith('a');
    expect(board.getAttribute('style')).toBe(afterPan);
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
