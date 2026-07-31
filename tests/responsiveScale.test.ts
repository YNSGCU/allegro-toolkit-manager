import { describe, expect, it } from 'vitest';
import {
  SHELL_SCALE_CONFIG,
  HOTKEY_WORKSPACE_SCALE_CONFIG,
  computeResponsiveScale,
} from '../src/layout/responsiveScale';

describe('responsive scale', () => {
  it('keeps baseline size at 1 when the viewport matches the design size', () => {
    expect(
      computeResponsiveScale(
        SHELL_SCALE_CONFIG.baseWidth,
        SHELL_SCALE_CONFIG.baseHeight,
        SHELL_SCALE_CONFIG,
      ),
    ).toBe(1);
  });

  it('grows above 1 when the viewport is larger than the hotkey workspace baseline', () => {
    expect(
      computeResponsiveScale(
        HOTKEY_WORKSPACE_SCALE_CONFIG.baseWidth * 1.25,
        HOTKEY_WORKSPACE_SCALE_CONFIG.baseHeight * 1.3,
        HOTKEY_WORKSPACE_SCALE_CONFIG,
      ),
    ).toBeGreaterThan(1);
  });

  it('uses a noticeably larger scale for a common wide desktop hotkey workspace', () => {
    expect(
      computeResponsiveScale(1160, 820, HOTKEY_WORKSPACE_SCALE_CONFIG),
    ).toBeGreaterThan(1.12);
  });

  it('shrinks below 1 when the viewport is smaller than the shell baseline', () => {
    expect(
      computeResponsiveScale(
        SHELL_SCALE_CONFIG.baseWidth * 0.9,
        SHELL_SCALE_CONFIG.baseHeight * 0.92,
        SHELL_SCALE_CONFIG,
      ),
    ).toBeLessThan(1);
  });

  it('clamps the computed scale between the configured min and max', () => {
    expect(
      computeResponsiveScale(
        HOTKEY_WORKSPACE_SCALE_CONFIG.baseWidth * 3,
        HOTKEY_WORKSPACE_SCALE_CONFIG.baseHeight * 3,
        HOTKEY_WORKSPACE_SCALE_CONFIG,
      ),
    ).toBe(HOTKEY_WORKSPACE_SCALE_CONFIG.maxScale);

    expect(
      computeResponsiveScale(
        HOTKEY_WORKSPACE_SCALE_CONFIG.baseWidth * 0.2,
        HOTKEY_WORKSPACE_SCALE_CONFIG.baseHeight * 0.2,
        HOTKEY_WORKSPACE_SCALE_CONFIG,
      ),
    ).toBe(HOTKEY_WORKSPACE_SCALE_CONFIG.minScale);
  });
});
