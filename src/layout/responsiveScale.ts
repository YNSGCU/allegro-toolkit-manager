export interface ResponsiveScaleConfig {
  baseWidth: number;
  baseHeight: number;
  minScale: number;
  maxScale: number;
}

export const SHELL_SCALE_CONFIG: ResponsiveScaleConfig = {
  baseWidth: 1160,
  baseHeight: 780,
  minScale: 0.92,
  maxScale: 1.26,
};

export const HOTKEY_WORKSPACE_SCALE_CONFIG: ResponsiveScaleConfig = {
  baseWidth: 960,
  baseHeight: 680,
  minScale: 0.9,
  maxScale: 1.4,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeResponsiveScale(
  width: number,
  height: number,
  config: ResponsiveScaleConfig,
): number {
  if (width <= 0 || height <= 0) {
    return 1;
  }

  const widthScale = width / config.baseWidth;
  const heightScale = height / config.baseHeight;
  const rawScale = Math.min(widthScale, heightScale);

  return Number(clamp(rawScale, config.minScale, config.maxScale).toFixed(3));
}
