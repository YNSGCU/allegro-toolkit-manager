/**
 * ATM - 键盘图例
 */
import React from 'react';

const LEGEND_ITEMS = [
  { color: 'var(--accent-green)', label: '正常' },
  { color: 'var(--accent-red)', label: '冲突' },
  { color: 'var(--accent-yellow)', label: '警告' },
  { color: 'var(--text-muted)', label: '未绑定' },
  { color: 'var(--accent-blue)', label: '已选中' },
];

const KeyboardLegend: React.FC = () => (
  <div className="keyboard-legend">
    {LEGEND_ITEMS.map((item) => (
      <div key={item.label} className="keyboard-legend-item">
        <span className="keyboard-legend-dot" style={{ background: item.color }} />
        <span>{item.label}</span>
      </div>
    ))}
  </div>
);

export default React.memo(KeyboardLegend);
