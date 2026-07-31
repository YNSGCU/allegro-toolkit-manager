/**
 * ATM - 键盘筛选工具栏
 */
import React from 'react';

export type FilterMode = 'all' | 'funckey' | 'alias' | 'conflict' | 'warning' | 'empty';

interface KeyboardToolbarProps {
  filter: FilterMode;
  onChange: (f: FilterMode) => void;
  counts: Record<FilterMode, number>;
}

const FILTERS: { key: FilterMode; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'funckey', label: 'Funckey' },
  { key: 'alias', label: 'Alias' },
  { key: 'conflict', label: '冲突' },
  { key: 'warning', label: '警告' },
  { key: 'empty', label: '未绑定' },
];

const KeyboardToolbar: React.FC<KeyboardToolbarProps> = ({ filter, onChange, counts }) => {
  return (
    <div className="keyboard-toolbar">
      {FILTERS.map(({ key, label }) => (
        <button
          key={key}
          className={`btn btn-sm ${filter === key ? 'btn-primary' : ''}`}
          onClick={() => onChange(key)}
        >
          {label}
          {counts[key] > 0 && <span className="badge badge-info" style={{ marginLeft: 4 }}>{counts[key]}</span>}
        </button>
      ))}
    </div>
  );
};

export default React.memo(KeyboardToolbar);
