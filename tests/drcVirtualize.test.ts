import { describe, expect, it } from 'vitest';
import { computeDrcWindow } from '../src/components/drc/drcVirtualize';

describe('computeDrcWindow', () => {
  it('小数据量全部渲染、无填充', () => {
    const w = computeDrcWindow(4, 0, 600, 40, 48, 10);
    expect(w).toEqual({ start: 0, end: 4, topPad: 0, bottomPad: 0 });
  });

  it('滚动到中部时截取窗口并生成上下填充', () => {
    const w = computeDrcWindow(1000, 5000, 600, 40, 48, 10);
    expect(w.start).toBeGreaterThan(0);
    expect(w.end).toBeGreaterThan(w.start);
    expect(w.end).toBeLessThanOrEqual(1000);
    expect(w.topPad).toBe(w.start * 48);
    expect(w.bottomPad).toBe((1000 - w.end) * 48);
  });

  it('顶部边界不产生负填充', () => {
    const w = computeDrcWindow(1000, 0, 600, 40, 48, 10);
    expect(w.start).toBe(0);
    expect(w.topPad).toBe(0);
  });

  it('底部边界 end 不超过 total', () => {
    const w = computeDrcWindow(10, 100000, 600, 40, 48, 10);
    expect(w.end).toBe(10);
    expect(w.bottomPad).toBe(0);
  });

  it('非法输入被安全归一', () => {
    const w = computeDrcWindow(-5, -1, -1, -1, 0, -1);
    expect(w.start).toBe(0);
    expect(w.end).toBe(0);
    expect(w.topPad).toBe(0);
    expect(w.bottomPad).toBe(0);
  });
});
