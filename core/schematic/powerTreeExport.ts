/**
 * ATM - 电源树导出模块
 * 纯 TS，可脱离 Electron / React 测试。
 *
 * 生成自包含（内联样式）的 SVG / HTML，供：
 * 1. 页面内只读渲染（PowerTreeView 复用同一份 SVG 字符串）
 * 2. SVG 直写导出
 * 3. 隐藏 BrowserWindow 栅格化 / 打印为 PNG / PDF
 */
import type { PowerTree } from '../../src/types/schematic';
import { layoutPowerTree, NODE_HEIGHT, NODE_WIDTH } from './powerTreeLayout';

const TOPOLOGY_LABEL: Record<string, string> = {
  LDO: 'LDO',
  BUCK: '降压',
  BOOST: '升压',
  PMIC: 'PMIC',
  unknown: '稳压',
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 电源树画布尺寸 */
export function powerTreeDimensions(tree: PowerTree): { width: number; height: number } {
  const layout = layoutPowerTree(tree);
  return { width: Math.ceil(layout.width), height: Math.ceil(layout.height) };
}

/** 生成自包含 SVG 字符串 */
export function renderPowerTreeSvg(tree: PowerTree): string {
  const layout = layoutPowerTree(tree);
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" font-family="Microsoft YaHei, sans-serif">`,
  );

  // 转换器连线
  for (const e of layout.edges) {
    const mx = (e.x1 + e.x2) / 2;
    const my = (e.y1 + e.y2) / 2;
    const topo = TOPOLOGY_LABEL[e.topology] ?? e.topology;
    parts.push(
      `<path d="M ${e.x1} ${e.y1} C ${mx} ${e.y1}, ${mx} ${e.y2}, ${e.x2} ${e.y2}" fill="none" stroke="#94a3b8" stroke-width="2"/>`,
    );
    parts.push(`<g transform="translate(${mx}, ${my})">`);
    parts.push(
      `<rect x="-72" y="-18" width="144" height="36" rx="7" fill="#f8fafc" stroke="#e2e8f0"/>`,
    );
    parts.push(
      `<text x="0" y="-2" text-anchor="middle" font-size="12" font-weight="600" fill="#334155">${escapeXml(e.refdes)} · ${escapeXml(topo)}</text>`,
    );
    parts.push(
      `<text x="0" y="12" text-anchor="middle" font-size="10" fill="#94a3b8">${escapeXml(e.partName)}</text>`,
    );
    parts.push(`</g>`);
  }

  // 电压轨节点
  for (const n of layout.nodes) {
    const fill = n.isRoot ? '#eff6ff' : '#ffffff';
    const stroke = n.isRoot ? '#3b82f6' : '#cbd5e1';
    const meta = `${n.voltage !== undefined ? `${n.voltage}V` : '电压未知'} · ${n.loadCount} 负载`;
    parts.push(`<g transform="translate(${n.x}, ${n.y})">`);
    parts.push(
      `<rect width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="${n.isRoot ? 2 : 1.5}"/>`,
    );
    parts.push(
      `<text x="14" y="21" font-size="14" font-weight="600" fill="#0f172a">${escapeXml(n.name)}</text>`,
    );
    parts.push(
      `<text x="14" y="40" font-size="11" fill="#64748b">${escapeXml(meta)}</text>`,
    );
    parts.push(`</g>`);
  }

  parts.push(`</svg>`);
  return parts.join('\n');
}

/** 生成完整 HTML（供隐藏窗口渲染 PNG/PDF） */
export function renderPowerTreeHtml(tree: PowerTree): string {
  const svg = renderPowerTreeSvg(tree);
  const { width, height } = powerTreeDimensions(tree);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>电源树</title>
<style>html,body{margin:0;padding:0;background:#fff;}</style>
</head>
<body style="width:${width}px;height:${height}px">
${svg}
</body>
</html>`;
}

/** 默认导出文件名（不含路径） */
export function powerTreeExportFileName(tree: PowerTree, format: string): string {
  const base = (tree.designName || 'power-tree').replace(/[\\/:*?"<>|]/g, '_').trim() || 'power-tree';
  return `${base}-power-tree.${format}`;
}
