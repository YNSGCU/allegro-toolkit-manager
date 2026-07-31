import { describe, expect, it } from 'vitest';
import {
  computeKeyboardScale,
  KEYBOARD_NATURAL_WIDTH,
  KEYBOARD_SIDE_PADDING,
} from '../src/components/hotkeys/keyboardViewport';

describe('keyboard viewport scaling', () => {
  it('keeps neutral scale when the container just fits the natural keyboard width', () => {
    expect(
      computeKeyboardScale(KEYBOARD_NATURAL_WIDTH + KEYBOARD_SIDE_PADDING),
    ).toBe(1);
  });

  it('allows the keyboard to grow when the container becomes much wider', () => {
    expect(computeKeyboardScale(1280)).toBeGreaterThan(1);
  });

  it('caps the keyboard by the available height so it will not force page scrolling', () => {
    expect(computeKeyboardScale(1280, 280)).toBeLessThan(1);
  });

  it('keeps shrinking below the old hard stop instead of forcing a scroll threshold', () => {
    expect(computeKeyboardScale(620)).toBeLessThan(0.82);
  });
});
