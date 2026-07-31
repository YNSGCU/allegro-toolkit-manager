import React from 'react';

export interface KeyboardKeyDef {
  label: string;
  names: string[];
  width: number;
  type: 'letter' | 'number' | 'function' | 'modifier' | 'special' | 'arrow';
}

export type KeyStatus = 'empty' | 'normal' | 'warning' | 'conflict' | 'selected';

interface KeycapProps {
  keyDef: KeyboardKeyDef;
  status: KeyStatus;
  hasFunckey: boolean;
  hasAlias: boolean;
  dimmed: boolean;
  onClick: () => void;
  onHoverStart?: (event: React.MouseEvent<HTMLDivElement> | React.FocusEvent<HTMLDivElement>) => void;
  onHoverEnd?: () => void;
  bindingCount?: number;
  isModifier?: boolean;
  isActiveModifier?: boolean;
}

const STATUS_CLASS: Record<KeyStatus, string> = {
  empty: 'key-empty',
  normal: 'key-normal',
  warning: 'key-warning',
  conflict: 'key-conflict',
  selected: 'key-selected',
};

const Keycap: React.FC<KeycapProps> = ({
  keyDef,
  status,
  dimmed,
  onClick,
  onHoverStart,
  onHoverEnd,
  bindingCount,
  isModifier,
  isActiveModifier,
}) => {
  const modifierClass = isModifier
    ? (isActiveModifier ? 'key-modifier-active' : 'key-modifier-inactive')
    : '';
  const modifierContentClass = `keycap-modifier-stack${isActiveModifier ? ' keycap-modifier-stack--active' : ''}`;

  return (
    <div
      className={`keycap ${STATUS_CLASS[status]} ${dimmed ? 'key-dimmed' : ''} key-${keyDef.type} ${modifierClass}`}
      style={{ width: `calc(var(--key-unit) * ${keyDef.width} + 4px * (${keyDef.width} - 1))` }}
      onClick={onClick}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onFocus={onHoverStart}
      onBlur={onHoverEnd}
      tabIndex={isModifier ? -1 : 0}
    >
      {isModifier ? (
        <span className={modifierContentClass}>
          <span className="keycap-label">{keyDef.label}</span>
          {isActiveModifier ? <span className="keycap-modifier-indicator">•</span> : null}
        </span>
      ) : (
        <span className="keycap-label">{keyDef.label}</span>
      )}
      {!isModifier && bindingCount !== undefined && bindingCount > 0 ? (
        <span className="keycap-binding-count">{bindingCount}</span>
      ) : null}
    </div>
  );
};

export default React.memo(Keycap);
