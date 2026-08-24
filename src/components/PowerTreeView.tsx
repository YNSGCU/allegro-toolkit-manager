/**
 * ATM - 电源树只读视图
 * 复用 core/schematic/powerTreeExport 的自包含 SVG（页面内与导出同一份渲染）。
 */
import { renderPowerTreeSvg } from '../../core/schematic/powerTreeExport';
import type { PowerTree } from '../types/schematic';

export default function PowerTreeView({ tree }: { tree: PowerTree }) {
  // 文本在 renderPowerTreeSvg 中已做 XML 转义，注入安全。
  const svg = renderPowerTreeSvg(tree);
  return <div className="power-tree-view" dangerouslySetInnerHTML={{ __html: svg }} />;
}
