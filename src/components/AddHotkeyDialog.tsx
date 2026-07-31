/**
 * ATM - 添加快捷键对话框（V2.2）
 */
import React, { useState, useMemo } from 'react';

interface AddHotkeyDialogProps {
  physicalKey: string;
  onClose: () => void;
  onConfirm: (draft: { key: string; command: string; type: 'funckey' | 'alias' }) => void;
}

const LAYER_OPTIONS: { label: string; modifiers: string[] }[] = [
  { label: '普通层', modifiers: [] },
  { label: 'Ctrl 层', modifiers: ['Ctrl'] },
  { label: 'Shift 层', modifiers: ['Shift'] },
  { label: 'Alt 层', modifiers: ['Alt'] },
  { label: 'Ctrl+Shift 层', modifiers: ['Ctrl', 'Shift'] },
  { label: 'Ctrl+Alt 层', modifiers: ['Ctrl', 'Alt'] },
  { label: 'Shift+Alt 层', modifiers: ['Shift', 'Alt'] },
];

/**
 * 根据 physicalKey + modifiers 生成 rawKey。
 * 普通层用小写，其他用 Windows 风格 "Mod+" 前缀。
 */
function generateRawKey(physicalKey: string, modifiers: string[]): string {
  const base = physicalKey.toLowerCase();
  if (modifiers.length === 0) return base;
  return [...modifiers].sort((a, b) => {
    if (a === 'Ctrl' && (b === 'Shift' || b === 'Alt')) return -1;
    if ((a === 'Shift' || a === 'Alt') && b === 'Ctrl') return 1;
    if (a === 'Shift' && b === 'Alt') return -1;
    if (a === 'Alt' && b === 'Shift') return 1;
    return 0;
  }).join('+') + '+' + base;
}

const AddHotkeyDialog: React.FC<AddHotkeyDialogProps> = ({ physicalKey, onClose, onConfirm }) => {
  const [selectedLayerIdx, setSelectedLayerIdx] = useState(0);
  const [command, setCommand] = useState('');
  const [bindingType, setBindingType] = useState<'funckey' | 'alias'>('funckey');

  const rawKey = useMemo(
    () => generateRawKey(physicalKey, LAYER_OPTIONS[selectedLayerIdx].modifiers),
    [physicalKey, selectedLayerIdx],
  );

  const displayKey = useMemo(() => {
    const mods = LAYER_OPTIONS[selectedLayerIdx].modifiers;
    if (mods.length === 0) return physicalKey.toLowerCase();
    return [...mods, physicalKey.toLowerCase()].join('+');
  }, [physicalKey, selectedLayerIdx]);

  const handleConfirm = () => {
    if (!command.trim()) return;
    onConfirm({ key: rawKey, command: command.trim(), type: bindingType });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: 15 }}>新增绑定 — 物理键 {physicalKey}</h3>
          <button className="btn btn-sm" onClick={onClose}>关闭</button>
        </div>
        <div className="modal-body" style={{ padding: '12px 0' }}>
          {/* 修饰键层 */}
          <div className="form-row" style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
              修饰键层
            </label>
            <select
              value={selectedLayerIdx}
              onChange={(e) => setSelectedLayerIdx(Number(e.target.value))}
              style={{ width: '100%', padding: '6px 8px' }}
            >
              {LAYER_OPTIONS.map((opt, i) => (
                <option key={i} value={i}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* 绑定类型 */}
          <div className="form-row" style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
              类型
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={bindingType === 'funckey'}
                  onChange={() => setBindingType('funckey')}
                  style={{ marginRight: 4 }}
                />
                Funckey
              </label>
              <label style={{ fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={bindingType === 'alias'}
                  onChange={() => setBindingType('alias')}
                  style={{ marginRight: 4 }}
                />
                Alias
              </label>
            </div>
          </div>

          {/* 命令 */}
          <div className="form-row" style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
              原始命令
            </label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="例: move, add connect, zoom fit"
              style={{ width: '100%', padding: '6px 8px', fontFamily: 'monospace' }}
            />
          </div>

          {/* 预览 */}
          <div className="form-row" style={{
            padding: '8px 10px',
            background: 'var(--bg-hover)',
            borderRadius: 'var(--radius)',
            fontSize: 13,
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>将绑定为：</span>
            <code style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
              {bindingType} {rawKey} {command ? (command.includes(' ') ? `"${command}"` : command) : '(等待输入命令)'}
            </code>
          </div>
        </div>
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
          <button className="btn" onClick={onClose}>取消</button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!command.trim()}
          >
            生成 Apply Plan
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddHotkeyDialog;
