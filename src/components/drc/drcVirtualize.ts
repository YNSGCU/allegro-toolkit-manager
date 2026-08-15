/**
 * ATM - DRC 明细表窗口化渲染计算（纯函数，可测）
 */

export interface DrcWindow {
  start: number;
  end: number;
  topPad: number;
  bottomPad: number;
}

export function computeDrcWindow(
  total: number,
  scrollTop: number,
  viewHeight: number,
  headerHeight: number,
  rowHeight: number,
  overscan: number,
): DrcWindow {
  const safeTotal = Math.max(0, Math.floor(total));
  const safeScroll = Math.max(0, scrollTop);
  const safeView = Math.max(0, viewHeight);
  const safeHeader = Math.max(0, headerHeight);
  const safeRow = Math.max(1, rowHeight);
  const safeOverscan = Math.max(0, Math.floor(overscan));

  const start = Math.max(0, Math.floor((safeScroll - safeHeader) / safeRow) - safeOverscan);
  const visibleCount = Math.ceil(safeView / safeRow) + safeOverscan * 2;
  const end = Math.min(safeTotal, start + visibleCount);

  return {
    start,
    end,
    topPad: start * safeRow,
    bottomPad: (safeTotal - end) * safeRow,
  };
}
