import { describe, expect, it } from 'vitest';
import { ATM_WINDOW_BOUNDS } from '../electron/windowConfig';

describe('ATM window bounds', () => {
  it('prevents the desktop window from shrinking below the hotkey workspace safe size', () => {
    expect(ATM_WINDOW_BOUNDS.minWidth).toBeGreaterThanOrEqual(1100);
    expect(ATM_WINDOW_BOUNDS.minHeight).toBeGreaterThanOrEqual(760);
  });
});
