export const KEYBOARD_NATURAL_WIDTH = 840;
export const KEYBOARD_NATURAL_HEIGHT = 360;
export const KEYBOARD_SIDE_PADDING = 24;
export const KEYBOARD_MAX_SCALE = 1.68;

export function computeKeyboardScale(
  containerWidth: number,
  containerHeight = Number.POSITIVE_INFINITY,
  naturalWidth = KEYBOARD_NATURAL_WIDTH,
  naturalHeight = KEYBOARD_NATURAL_HEIGHT,
  sidePadding = KEYBOARD_SIDE_PADDING,
  maxScale = KEYBOARD_MAX_SCALE,
): number {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return 1;
  }

  const usableWidth = Math.max(0, containerWidth - sidePadding);
  const usableHeight = Number.isFinite(containerHeight)
    ? Math.max(0, containerHeight)
    : Number.POSITIVE_INFINITY;

  const widthScale = usableWidth / naturalWidth;
  const heightScale = usableHeight / naturalHeight;

  return Math.min(maxScale, widthScale, heightScale);
}
