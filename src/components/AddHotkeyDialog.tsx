/**
 * ATM - 添加快捷键对话框（V2.2）
 */
import React, { useState, useMemo } from 'react';
import { BusinessDialog } from '../shared/ui';
import type { HotkeyBinding } from '../types/hotkey';
import HotkeyCommandAssist from './HotkeyCommandAssist';

interface AddHotkeyDialogProps {
  physicalKey: string;
  currentBindings?: HotkeyBinding[];
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

const AddHotkeyDialog: React.FC<AddHotkeyDialogProps> = ({
  physicalKey,
  currentBindings = [],
  onClose,
  onConfirm,
}) => {
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

  const occupiedBinding = useMemo(
    () => currentBindings.find(
      (binding) => [
        'user_env_original',
        'atm_managed_block',
        'active_profile',
        'imported_profile',
      ].includes(binding.bindingSource)
        && binding.type === bindingType
        && binding.key.toLowerCase() === rawKey.toLowerCase(),
    ),
    [bindingType, currentBindings, rawKey],
  );

  const referenceConflict = useMemo(
    () => currentBindings.find(
      (binding) => binding !== occupiedBinding
        && binding.type === bindingType
        && binding.key.toLowerCase() === rawKey.toLowerCase(),
    ),
    [bindingType, currentBindings, occupiedBinding, rawKey],
  );

  const handleConfirm = () => {
    if (!command.trim() || occupiedBinding) return;
    onConfirm({ key: rawKey, command: command.trim(), type: bindingType });
  };

  return (
    <BusinessDialog
      title={<>新增绑定<span className="ui-dialog-title-context"> · 物理键 {physicalKey}</span></>}
      description="选择修饰键层并填写 Allegro 命令，确认后仅生成 Apply Plan。"
      size="sm"
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn" onClick={onClose}>取消</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!command.trim() || Boolean(occupiedBinding)}
          >
            生成 Apply Plan
          </button>
        </>
      )}
    >
      <div className="ui-dialog-form">
        <div className="ui-dialog-field">
          <label htmlFor="add-hotkey-layer">修饰键层</label>
          <select
            id="add-hotkey-layer"
            value={selectedLayerIdx}
            onChange={(e) => setSelectedLayerIdx(Number(e.target.value))}
          >
            {LAYER_OPTIONS.map((opt, i) => (
              <option key={opt.label} value={i}>{opt.label}</option>
            ))}
          </select>
        </div>

        <fieldset className="ui-dialog-field">
          <legend className="ui-dialog-field-label">绑定类型</legend>
          <div className="ui-dialog-choice-group">
            <label className="ui-dialog-choice">
              <input
                type="radio"
                name="add-hotkey-type"
                checked={bindingType === 'funckey'}
                onChange={() => setBindingType('funckey')}
              />
              Funckey
            </label>
            <label className="ui-dialog-choice">
              <input
                type="radio"
                name="add-hotkey-type"
                checked={bindingType === 'alias'}
                onChange={() => setBindingType('alias')}
              />
              Alias
            </label>
          </div>
        </fieldset>

        <div className="ui-dialog-field ui-dialog-field--code">
          <label htmlFor="add-hotkey-command">原始命令</label>
          <HotkeyCommandAssist
            id="add-hotkey-command"
            value={command}
            onChange={setCommand}
            bindings={currentBindings}
            seedQuery={physicalKey.length === 1 ? physicalKey : ''}
            placeholder="例：move、add connect、zoom fit"
            initialFocus
          />
        </div>

        {occupiedBinding ? (
          <div className="ui-dialog-alert ui-dialog-alert--danger" role="alert">
            {displayKey} 已绑定到“{occupiedBinding.command}”。请更换修饰键层，或返回列表编辑原绑定。
          </div>
        ) : null}

        {!occupiedBinding && referenceConflict ? (
          <div className="ui-dialog-alert ui-dialog-alert--warning">
            {displayKey} 在“{referenceConflict.bindingSource}”中已有“{referenceConflict.command}”。仍可生成计划，但可能覆盖默认或参考配置。
          </div>
        ) : null}

        <div className="ui-dialog-alert ui-dialog-alert--info">
          <strong>使用建议</strong>
          <span>Funckey 适合物理键和组合键；Alias 适合命令行中的多字符缩写。复杂命令请先在 Allegro Command 窗口验证。</span>
        </div>

        <div className="ui-dialog-preview" aria-live="polite">
          <span>将绑定为</span>
          <code>
            {bindingType} {rawKey} {command ? (command.includes(' ') ? `"${command}"` : command) : '(等待输入命令)'}
          </code>
        </div>
      </div>
    </BusinessDialog>
  );
};

export default AddHotkeyDialog;
