import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { KeyboardCanvas } from './KeyboardCanvas';
describe('KeyboardCanvas', () => { it('selects a key and exposes inherited state', () => { const fn = vi.fn(); render(<KeyboardCanvas layout="Ansi" onSelect={fn} direct={{}} inherited={{ caps: { type: 'key', key: 'esc' } }}/>); const caps = screen.getByRole('button', { name: /Caps/ }); expect(caps.title).toBe('Inherited from Global'); fireEvent.click(caps); expect(fn).toHaveBeenCalledWith('caps'); }); });
