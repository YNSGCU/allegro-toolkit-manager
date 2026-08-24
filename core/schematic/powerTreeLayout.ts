/**
 * ATM - 电源树布局模块
 * 纯 TS，可脱离 React / Electron 测试。
 *
 * 输入：PowerTree
 * 输出：PowerTreeLayout（节点/边的像素坐标，供 SVG 画布渲染）
 *
 * 布局策略：按「根轨层级 0 → 每级转换器输出轨 +1」分层，
 * 同层按电压降序纵向排列，横向按层推进。
 */
import type { PowerTree, PowerRail } from '../../src/types/schematic';

export const NODE_WIDTH = 190;
export const NODE_HEIGHT = 52;
export const LEVEL_GAP = 260;
export const ROW_GAP = 96;
export const PADDING = 48;

export interface PowerTreeNodeLayout {
  id: string;
  name: string;
  voltage?: number;
  isRoot: boolean;
  x: number;
  y: number;
  loadCount: number;
}

export interface PowerTreeEdgeLayout {
  id: string;
  refdes: string;
  partName: string;
  topology: string;
  inputRailId: string;
  outputRailId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PowerTreeLayout {
  nodes: PowerTreeNodeLayout[];
  edges: PowerTreeEdgeLayout[];
  width: number;
  height: number;
}

export function layoutPowerTree(tree: PowerTree): PowerTreeLayout {
  const level = new Map<string, number>();
  for (const r of tree.rails) level.set(r.id, 0);
  if (tree.rootRailId) level.set(tree.rootRailId, 0);

  // 层级传播：转换器输出轨 = 输入轨层级 + 1（最多 rails.length 轮防环）
  for (let pass = 0; pass <= tree.rails.length; pass++) {
    let changed = false;
    for (const c of tree.converters) {
      if (!c.inputRailId) continue;
      const inLevel = level.get(c.inputRailId);
      if (inLevel === undefined) continue;
      for (const outId of c.outputRailIds) {
        const next = inLevel + 1;
        if ((level.get(outId) ?? 0) < next) {
          level.set(outId, next);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  const byLevel = new Map<number, PowerRail[]>();
  for (const r of tree.rails) {
    const lv = level.get(r.id) ?? 0;
    if (!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv)!.push(r);
  }

  const levels = [...byLevel.keys()].sort((a, b) => a - b);
  const pos = new Map<string, { x: number; y: number }>();
  for (const lv of levels) {
    const rails = byLevel.get(lv)!.sort((a, b) => (b.voltage ?? -1) - (a.voltage ?? -1));
    rails.forEach((r, i) => {
      pos.set(r.id, { x: PADDING + lv * LEVEL_GAP, y: PADDING + i * ROW_GAP });
    });
  }

  const loadCountByRail = new Map<string, number>();
  for (const l of tree.loads) {
    loadCountByRail.set(l.railId, (loadCountByRail.get(l.railId) ?? 0) + 1);
  }

  const nodes: PowerTreeNodeLayout[] = tree.rails.map((r) => {
    const p = pos.get(r.id) ?? { x: PADDING, y: PADDING };
    return {
      id: r.id,
      name: r.name,
      voltage: r.voltage,
      isRoot: r.isRoot,
      x: p.x,
      y: p.y,
      loadCount: loadCountByRail.get(r.id) ?? 0,
    };
  });

  const edges: PowerTreeEdgeLayout[] = [];
  for (const c of tree.converters) {
    const from = pos.get(c.inputRailId);
    if (!from) continue;
    for (const outId of c.outputRailIds) {
      const to = pos.get(outId);
      if (!to) continue;
      edges.push({
        id: `${c.id}:${outId}`,
        refdes: c.refdes,
        partName: c.partName,
        topology: c.topology,
        inputRailId: c.inputRailId,
        outputRailId: outId,
        x1: from.x + NODE_WIDTH,
        y1: from.y + NODE_HEIGHT / 2,
        x2: to.x,
        y2: to.y + NODE_HEIGHT / 2,
      });
    }
  }

  const maxCount = byLevel.size === 0 ? 1 : Math.max(...[...byLevel.values()].map((a) => a.length));
  const width = levels.length === 0
    ? NODE_WIDTH + PADDING * 2
    : PADDING * 2 + (levels.length - 1) * LEVEL_GAP + NODE_WIDTH;
  const height = PADDING * 2 + (maxCount - 1) * ROW_GAP + NODE_HEIGHT;

  return { nodes, edges, width, height };
}
