/**
 * ATM - 键盘布局组件
 * 渲染所有按键行列
 */
import React from 'react';
import Keycap, { KeyboardKeyDef, KeyStatus } from './Keycap';

export interface KeyState {
  def: KeyboardKeyDef;
  status: KeyStatus;
  hasFunckey: boolean;
  hasAlias: boolean;
  bindingCount?: number;
  isModifier?: boolean;
  isActiveModifier?: boolean;
  hoverCard?: {
    items: Array<{
      title: string;
      keyText: string;
      sourceText: string;
    }>;
  } | null;
}

interface KeyboardLayoutProps {
  rows: KeyState[][];
  dimFn: (ks: KeyState) => boolean;
  onKeyClick: (ks: KeyState) => void;
  onKeyHoverStart?: (ks: KeyState, event: React.MouseEvent<HTMLDivElement> | React.FocusEvent<HTMLDivElement>) => void;
  onKeyHoverEnd?: () => void;
}

/** 键之间的小间距分隔块 */
const RowGap: React.FC<{ size?: number }> = ({ size = 0.5 }) => (
  <div style={{ width: `calc(var(--key-unit) * ${size})`, flexShrink: 0 }} />
);

/** F 键组间的稍大间距 */
const FnBlockGap: React.FC = () => (
  <div className="fn-block-gap" />
);

const KeyboardLayout: React.FC<KeyboardLayoutProps> = ({ rows, dimFn, onKeyClick, onKeyHoverStart, onKeyHoverEnd }) => {
  return (
    <div className="keyboard-body">
      {rows.map((row, ri) => (
        <div className="keyboard-row" key={ri}>
          {row.map((ks, ki) => {
            if (ks.def.label === '__gap__') {
              return <RowGap key={ki} size={ks.def.width} />;
            }
            if (ks.def.label === '__fn_gap__') {
              return <FnBlockGap key={ki} />;
            }
            if (ks.def.label === '__spacer__') {
              return (
                <div
                  key={ki}
                  className="keyboard-spacer"
                  style={{ width: `calc(var(--key-unit) * ${ks.def.width} + 4px * (${ks.def.width} - 1))` }}
                />
              );
            }
            return (
              <Keycap
                key={`${ri}-${ki}-${ks.def.label}`}
                keyDef={ks.def}
                status={ks.status}
                hasFunckey={ks.hasFunckey}
                hasAlias={ks.hasAlias}
                dimmed={dimFn(ks)}
                onClick={() => onKeyClick(ks)}
                onHoverStart={(event) => onKeyHoverStart?.(ks, event)}
                onHoverEnd={onKeyHoverEnd}
                bindingCount={ks.bindingCount}
                isModifier={ks.isModifier}
                isActiveModifier={ks.isActiveModifier}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default React.memo(KeyboardLayout);
