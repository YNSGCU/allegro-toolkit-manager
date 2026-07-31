/**
 * ATM - 閿洏鍗犵敤鎬昏锛圴2 淇グ閿眰 + 鍝嶅簲寮忥級
 *
 * 鑱岃矗锛? * - 灞曠ず鐗╃悊鎸夐敭鏄惁琚?funckey 鍗犵敤锛坅lias 涓嶆槧灏勭墿鐞嗛敭锛? * - 椤堕儴宸ュ叿鏍忓寘鍚細鍏ㄥ眬瑙嗗浘鍒囨崲 + 淇グ閿眰鍒囨崲
 * - Ctrl / Shift / Alt 浣滀负灞傜骇鍒囨崲鎸夐挳
 * - 褰撳墠灞傞珮浜搴斿揩鎹烽敭锛屽叾浣欓敭鍙樻殫
 * - 鍙犲姞妯″紡涓嬪吋瀹逛繚鐣欓敭鏄剧ず
 * - 閿洏鍝嶅簲寮忕瓑姣旂缉鏀? */
import React, { useMemo, useCallback, useState } from 'react';
import type { HotkeyBinding, Conflict } from '../types/hotkey';
import type { KeyboardKeyDef, KeyStatus } from './Keycap';
import KeyboardLayout, { KeyState } from './KeyboardLayout';
import KeyboardLegend from './KeyboardLegend';
import PhysicalKeyBindingPanel from './PhysicalKeyBindingPanel';
import { MODIFIER_LABELS } from '../utils/keyNormalizer';
import {
  BINDING_SRC_CONFIG,
  enrichWithPhysicalKey,
  filterHotkeysByKeyboardLayer,
  getBindingsByPhysicalKey,
  getLayerDisplayName,
  LAYER_CONFIG,
  normalizeHotkeyKey,
  type ActiveLayer,
} from '../utils/hotkeyItem';

export type KeyboardViewMode = 'my' | 'reserved' | 'overlay';
type KeyboardSourceMode = 'all' | 'skill';

interface HoverCardState {
  items: Array<{
    title: string;
    keyText: string;
    sourceText: string;
  }>;
  left: number;
  top: number;
  placement: 'above' | 'below';
}

const RESERVED_OCCUPANCY_SOURCES = new Set<HotkeyBinding['bindingSource']>([
  'allegro_default',
  'system_reserved',
  'install_default_env',
  'site_env',
  'company_env',
  'reference_env',
  'skill_direct',
  'menu_accelerator',
]);

type RowDef = (KeyboardKeyDef | 'gap' | 'fn_gap')[];

const RAW_ROWS: RowDef[] = [
  [
    { label: 'Esc', names: ['Esc', 'Escape'], width: 1.5, type: 'special' },
    'fn_gap',
    { label: 'F1', names: ['F1'], width: 1, type: 'function' },
    { label: 'F2', names: ['F2'], width: 1, type: 'function' },
    { label: 'F3', names: ['F3'], width: 1, type: 'function' },
    { label: 'F4', names: ['F4'], width: 1, type: 'function' },
    'fn_gap',
    { label: 'F5', names: ['F5'], width: 1, type: 'function' },
    { label: 'F6', names: ['F6'], width: 1, type: 'function' },
    { label: 'F7', names: ['F7'], width: 1, type: 'function' },
    { label: 'F8', names: ['F8'], width: 1, type: 'function' },
    'fn_gap',
    { label: 'F9', names: ['F9'], width: 1, type: 'function' },
    { label: 'F10', names: ['F10'], width: 1, type: 'function' },
    { label: 'F11', names: ['F11'], width: 1, type: 'function' },
    { label: 'F12', names: ['F12'], width: 1, type: 'function' },
  ],
  [
    { label: '`~', names: ['`', '~'], width: 1, type: 'number' },
    { label: '1', names: ['1'], width: 1, type: 'number' },
    { label: '2', names: ['2'], width: 1, type: 'number' },
    { label: '3', names: ['3'], width: 1, type: 'number' },
    { label: '4', names: ['4'], width: 1, type: 'number' },
    { label: '5', names: ['5'], width: 1, type: 'number' },
    { label: '6', names: ['6'], width: 1, type: 'number' },
    { label: '7', names: ['7'], width: 1, type: 'number' },
    { label: '8', names: ['8'], width: 1, type: 'number' },
    { label: '9', names: ['9'], width: 1, type: 'number' },
    { label: '0', names: ['0'], width: 1, type: 'number' },
    { label: '-', names: ['-'], width: 1, type: 'number' },
    { label: '=', names: ['='], width: 1, type: 'number' },
    { label: 'Bksp', names: ['Backspace'], width: 2, type: 'special' },
  ],
  [
    { label: 'Tab', names: ['Tab'], width: 1.5, type: 'modifier' },
    { label: 'Q', names: ['q', 'Q'], width: 1, type: 'letter' },
    { label: 'W', names: ['w', 'W'], width: 1, type: 'letter' },
    { label: 'E', names: ['e', 'E', '~e', '~E'], width: 1, type: 'letter' },
    { label: 'R', names: ['r', 'R'], width: 1, type: 'letter' },
    { label: 'T', names: ['t', 'T'], width: 1, type: 'letter' },
    { label: 'Y', names: ['y', 'Y'], width: 1, type: 'letter' },
    { label: 'U', names: ['u', 'U'], width: 1, type: 'letter' },
    { label: 'I', names: ['i', 'I'], width: 1, type: 'letter' },
    { label: 'O', names: ['o', 'O'], width: 1, type: 'letter' },
    { label: 'P', names: ['p', 'P'], width: 1, type: 'letter' },
    { label: '[', names: ['['], width: 1, type: 'special' },
    { label: ']', names: [']'], width: 1, type: 'special' },
    { label: '\\', names: ['\\'], width: 1.5, type: 'special' },
  ],
  [
    { label: 'Caps', names: ['CapsLock'], width: 1.75, type: 'modifier' },
    { label: 'A', names: ['a', 'A'], width: 1, type: 'letter' },
    { label: 'S', names: ['s', 'S'], width: 1, type: 'letter' },
    { label: 'D', names: ['d', 'D'], width: 1, type: 'letter' },
    { label: 'F', names: ['f', 'F'], width: 1, type: 'letter' },
    { label: 'G', names: ['g', 'G'], width: 1, type: 'letter' },
    { label: 'H', names: ['h', 'H'], width: 1, type: 'letter' },
    { label: 'J', names: ['j', 'J'], width: 1, type: 'letter' },
    { label: 'K', names: ['k', 'K'], width: 1, type: 'letter' },
    { label: 'L', names: ['l', 'L'], width: 1, type: 'letter' },
    { label: ';', names: [';'], width: 1, type: 'special' },
    { label: "'", names: ["'"], width: 1, type: 'special' },
    { label: 'Enter', names: ['Enter'], width: 2.25, type: 'special' },
  ],
  [
    { label: 'Shift', names: ['Shift', 'LShift'], width: 2.25, type: 'modifier' },
    { label: 'Z', names: ['z', 'Z'], width: 1, type: 'letter' },
    { label: 'X', names: ['x', 'X'], width: 1, type: 'letter' },
    { label: 'C', names: ['c', 'C', '~C'], width: 1, type: 'letter' },
    { label: 'V', names: ['v', 'V', '~v', '~V'], width: 1, type: 'letter' },
    { label: 'B', names: ['b', 'B'], width: 1, type: 'letter' },
    { label: 'N', names: ['n', 'N'], width: 1, type: 'letter' },
    { label: 'M', names: ['m', 'M'], width: 1, type: 'letter' },
    { label: ',', names: [','], width: 1, type: 'special' },
    { label: '.', names: ['.'], width: 1, type: 'special' },
    { label: '/', names: ['/'], width: 1, type: 'special' },
    { label: 'Shift', names: ['RShift'], width: 2.75, type: 'modifier' },
  ],
  [
    { label: 'Ctrl', names: ['Ctrl', 'LCtrl'], width: 1.25, type: 'modifier' },
    { label: 'Win', names: ['Win', 'Meta'], width: 1, type: 'modifier' },
    { label: 'Alt', names: ['Alt', 'LAlt'], width: 1.25, type: 'modifier' },
    { label: '', names: [], width: 6, type: 'special' },
    { label: 'Alt', names: ['RAlt'], width: 1.25, type: 'modifier' },
    { label: 'Fn', names: [], width: 1, type: 'modifier' },
    { label: 'Ctrl', names: ['RCtrl'], width: 1.25, type: 'modifier' },
    'gap',
    { label: '↑', names: ['Up', 'ArrowUp'], width: 1, type: 'arrow' },
  ],
  [
    { label: '__spacer__', names: [], width: 12.75, type: 'special' },
    { label: '←', names: ['Left', 'ArrowLeft'], width: 1, type: 'arrow' },
    { label: '↓', names: ['Down', 'ArrowDown'], width: 1, type: 'arrow' },
    { label: '→', names: ['Right', 'ArrowRight'], width: 1, type: 'arrow' },
  ],
];

function getMatchingBindingsForPhysicalKey(bindings: HotkeyBinding[], physicalNames: string[]): HotkeyBinding[] {
  const seen = new Set<string>();
  const matches: HotkeyBinding[] = [];

  for (const name of physicalNames) {
    for (const binding of getBindingsByPhysicalKey(bindings, name)) {
      if (seen.has(binding.id)) {
        continue;
      }
      seen.add(binding.id);
      matches.push(binding);
    }
  }

  return matches;
}

const VIEW_OPTIONS: { key: KeyboardViewMode; label: string }[] = [
  { key: 'my', label: '我的快捷键' },
  { key: 'reserved', label: '默认/保留键' },
  { key: 'overlay', label: '全部叠加' },
];

const SOURCE_OPTIONS: { key: KeyboardSourceMode; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'skill', label: 'Skill' },
];

const HOVER_SOURCE_LABELS: Partial<Record<HotkeyBinding['bindingSource'], string>> = {
  user_env_original: '用户 env',
  atm_managed_block: 'ATM 托管',
  active_profile: '当前方案',
  imported_profile: '导入方案',
  generated: '自动生成',
  install_default_env: '安装默认 env',
  site_env: 'Site env',
  company_env: '公司 env',
  reference_env: '参考 env',
  allegro_default: 'Allegro 默认',
  system_reserved: '系统保留',
  skill_direct: 'Skill 直接注册',
  menu_accelerator: '菜单加速键',
  unknown: '未知来源',
};

function prettifyCommandLabel(command: string): string {
  return command
    .replace(/^["']|["']$/g, '')
    .replace(/[;]$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getHoverSourceLabel(binding: HotkeyBinding): string {
  const skillName = binding.skillName?.trim();
  const directLabel = HOVER_SOURCE_LABELS[binding.bindingSource];
  if (directLabel) {
    if (binding.bindingSource === 'skill_direct' && skillName) {
      return `${directLabel} · ${skillName}`;
    }
    return directLabel;
  }

  if (binding.commandSource === 'user_skill') {
    return skillName ? `用户 Skill · ${skillName}` : '用户 Skill';
  }
  if (binding.commandSource === 'company_skill') {
    return skillName ? `公司 Skill · ${skillName}` : '公司 Skill';
  }
  if (binding.commandSource === 'atm_managed_skill') {
    return skillName ? `ATM 托管 Skill · ${skillName}` : 'ATM 托管 Skill';
  }

  return BINDING_SRC_CONFIG[binding.bindingSource]?.label || '未知来源';
}

function getHoverTitle(binding: HotkeyBinding): string {
  if (binding.chineseName?.trim()) {
    return binding.chineseName.trim();
  }

  if (binding.description?.trim()) {
    return binding.description.trim();
  }

  if (binding.bindingSource === 'skill_direct' && binding.skillName?.trim()) {
    return binding.skillName.trim();
  }

  const prettyCommand = prettifyCommandLabel(binding.command);
  if (prettyCommand.length > 26 && binding.skillName?.trim()) {
    return binding.skillName.trim();
  }

  return prettyCommand || binding.command;
}

interface KeyboardOccupancyProps {
  bindings: HotkeyBinding[];
  reservedBindings?: HotkeyBinding[];
  conflicts: Conflict[];
  selectedKey: string | null;
  onSelectKey: (keyLabel: string | null) => void;
  viewMode?: 'my' | 'reserved' | 'overlay';
  onViewModeChange?: (mode: KeyboardViewMode) => void;
  activeLayer?: ActiveLayer;
  onLayerChange?: (layer: ActiveLayer) => void;
  allPhysicalKeyBindings?: HotkeyBinding[];
  onEditBinding?: (binding: HotkeyBinding) => void;
  onDeleteBinding?: (binding: HotkeyBinding) => void;
  onAdoptBinding?: (binding: HotkeyBinding) => void;
  onOverrideSource?: (binding: HotkeyBinding) => void;
  onAddBinding?: (physicalKey: string) => void;
}

const KeyboardOccupancy: React.FC<KeyboardOccupancyProps> = ({
  bindings,
  reservedBindings = [],
  conflicts,
  selectedKey,
  onSelectKey,
  viewMode = 'my',
  onViewModeChange,
  activeLayer = 'normal',
  onLayerChange,
  allPhysicalKeyBindings: allPhysicalKeyBindingsProp,
  onEditBinding,
  onDeleteBinding,
  onAdoptBinding,
  onOverrideSource: onOverrideSourceProp,
  onAddBinding,
}) => {
  const [hoverCard, setHoverCard] = useState<HoverCardState | null>(null);
  const [sourceMode, setSourceMode] = useState<KeyboardSourceMode>('all');

  const mergedBindings = useMemo(() => {
    const seen = new Set<string>();
    const result: HotkeyBinding[] = [];

    for (const binding of [...bindings, ...reservedBindings]) {
      if (seen.has(binding.id)) {
        continue;
      }
      seen.add(binding.id);
      result.push(binding);
    }

    return result;
  }, [bindings, reservedBindings]);

  const layerVisibleBindings = useMemo(
    () => filterHotkeysByKeyboardLayer(mergedBindings, activeLayer),
    [activeLayer, mergedBindings],
  );

  const isReadonlyOccupancyBinding = useCallback((binding: HotkeyBinding) => {
    return (
      binding.editable === false ||
      binding.status === 'reserved' ||
      RESERVED_OCCUPANCY_SOURCES.has(binding.bindingSource)
    );
  }, []);

  const getBindingsForCurrentView = useCallback(
    (matchingBindings: HotkeyBinding[]) => {
      const userBindings = matchingBindings.filter(
        (binding) => !isReadonlyOccupancyBinding(binding) && binding.visibleInUserMap !== false,
      );
      const readonlyBindings = matchingBindings.filter(
        (binding) => isReadonlyOccupancyBinding(binding) && binding.visibleInReservedMap !== false,
      );

      if (viewMode === 'reserved') {
        return readonlyBindings;
      }

      if (viewMode === 'overlay') {
        return [...userBindings, ...readonlyBindings];
      }

      return userBindings.length > 0 ? userBindings : readonlyBindings;
    },
    [isReadonlyOccupancyBinding, viewMode],
  );

  const isSkillRelatedBinding = useCallback((binding: HotkeyBinding) => {
    return (
      binding.bindingSource === 'skill_direct' ||
      binding.commandSource === 'user_skill' ||
      binding.commandSource === 'company_skill' ||
      binding.commandSource === 'atm_managed_skill'
    );
  }, []);

  const getBindingsForKeyboardSource = useCallback(
    (matchingBindings: HotkeyBinding[]) => {
      if (sourceMode === 'skill') {
        return matchingBindings.filter(isSkillRelatedBinding);
      }

      return getBindingsForCurrentView(matchingBindings);
    },
    [getBindingsForCurrentView, isSkillRelatedBinding, sourceMode],
  );

  const buildHoverCard = useCallback((matchingBindings: HotkeyBinding[]) => {
    if (matchingBindings.length === 0) {
      return null;
    }

    return {
      items: matchingBindings.map((binding) => {
        const sourceLabel = getHoverSourceLabel(binding);
        const keyLabel =
          binding.displayKey ||
          normalizeHotkeyKey(binding.key, binding.type).displayKey;

        return {
          title: getHoverTitle(binding),
          keyText: `键位: ${keyLabel}`,
          sourceText: `来源: ${sourceLabel}`,
        };
      }),
    };
  }, []);

  const keyStateMap = useMemo(() => {
    const map = new Map<string, KeyState>();

    for (const row of RAW_ROWS) {
      for (const cell of row) {
        if (cell === 'gap' || cell === 'fn_gap') {
          continue;
        }
        if (cell.label === '__spacer__') {
          continue;
        }
        if (MODIFIER_LABELS.has(cell.label)) {
          continue;
        }

        const allMatchingBindings = getMatchingBindingsForPhysicalKey(layerVisibleBindings, cell.names);
        const matchingBindings = getBindingsForKeyboardSource(allMatchingBindings);
        const funckeyBindings = matchingBindings.filter((binding) => binding.type === 'funckey');
        const aliasBindings = matchingBindings.filter((binding) => binding.type === 'alias');
        const matchingConflicts = conflicts.filter((conflict) =>
          conflict.bindings.some((conflictBinding) =>
            matchingBindings.some((binding) => binding.id === conflictBinding.id),
          ),
        );

        const hasErrorConflict = matchingConflicts.some((conflict) => conflict.severity === 'error');
        const hasWarningConflict = matchingConflicts.some((conflict) => conflict.severity === 'warning');
        const uniqueKeys = new Set(matchingBindings.map((binding) => binding.key));
        let status: KeyStatus = 'empty';
        if (matchingBindings.length > 0) {
          if (hasErrorConflict) {
            status = 'conflict';
          } else if (hasWarningConflict) {
            status = 'warning';
          } else {
            status = 'normal';
          }
        }

        const hoverBindings = sourceMode === 'skill' ? matchingBindings : allMatchingBindings;

        map.set(cell.label, {
          def: cell,
          status,
          hasFunckey: funckeyBindings.length > 0,
          hasAlias: aliasBindings.length > 0,
          hoverCard: buildHoverCard(hoverBindings),
          bindingCount: uniqueKeys.size,
        });
      }
    }

    return map;
  }, [
    buildHoverCard,
    conflicts,
    getBindingsForKeyboardSource,
    isReadonlyOccupancyBinding,
    layerVisibleBindings,
    sourceMode,
    viewMode,
  ]);

  const rows = useMemo(
    () =>
      RAW_ROWS.map((row) =>
        row.map((cell) => {
          if (cell === 'gap') {
            return {
              def: { label: '__gap__', names: [], width: 0.5, type: 'special' as const },
              status: 'empty' as KeyStatus,
              hasFunckey: false,
              hasAlias: false,
              hoverCard: null,
            };
          }

          if (cell === 'fn_gap') {
            return {
              def: { label: '__fn_gap__', names: [], width: 0, type: 'special' as const },
              status: 'empty' as KeyStatus,
              hasFunckey: false,
              hasAlias: false,
              hoverCard: null,
            };
          }

          if (cell.label === '__spacer__') {
            return {
              def: cell,
              status: 'empty' as KeyStatus,
              hasFunckey: false,
              hasAlias: false,
              hoverCard: null,
            };
          }

          if (MODIFIER_LABELS.has(cell.label)) {
            const layerModifiers = LAYER_CONFIG[activeLayer]?.modifiers || [];
            const isActive = layerModifiers.includes(cell.label);
            return {
              def: cell,
              status: isActive ? ('selected' as KeyStatus) : ('empty' as KeyStatus),
              hasFunckey: false,
              hasAlias: false,
              hoverCard: null,
              isModifier: true,
              isActiveModifier: isActive,
            };
          }

          return (
            keyStateMap.get(cell.label) || {
              def: cell,
              status: 'empty' as KeyStatus,
              hasFunckey: false,
              hasAlias: false,
              hoverCard: null,
            }
          );
        }),
      ),
    [activeLayer, keyStateMap],
  );

  const handleKeyClick = useCallback(
    (keyState: KeyState) => {
      if (keyState.def.label === '__spacer__' || keyState.def.label.startsWith('__')) {
        return;
      }

      if (keyState.isModifier && onLayerChange) {
        let targetLayer: ActiveLayer | null = null;
        if (keyState.def.label === 'Ctrl') {
          targetLayer = 'ctrl';
        } else if (keyState.def.label === 'Alt') {
          targetLayer = 'alt';
        } else if (keyState.def.label === 'Shift') {
          targetLayer = 'special';
        }

        if (targetLayer) {
          onLayerChange(targetLayer);
        }
        return;
      }

      onSelectKey(keyState.def.label === selectedKey ? null : keyState.def.label);
    },
    [onLayerChange, onSelectKey, selectedKey],
  );

  const handleKeyHoverStart = useCallback(
    (
      keyState: KeyState,
      event: React.MouseEvent<HTMLDivElement> | React.FocusEvent<HTMLDivElement>,
    ) => {
      if (!keyState.hoverCard) {
        setHoverCard(null);
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      const cardWidth = 260;
      const nextLeft = Math.min(
        Math.max(rect.left + rect.width / 2, 24 + cardWidth / 2),
        window.innerWidth - 24 - cardWidth / 2,
      );
      const placement = rect.top < 190 ? 'below' : 'above';
      const nextTop = placement === 'below' ? rect.bottom + 8 : Math.max(rect.top - 8, 16);

      setHoverCard({
        ...keyState.hoverCard,
        left: nextLeft,
        top: nextTop,
        placement,
      });
    },
    [],
  );

  const handleKeyHoverEnd = useCallback(() => {
    setHoverCard(null);
  }, []);

  const findKeyDef = useCallback((label: string): KeyboardKeyDef | null => {
    for (const row of RAW_ROWS) {
      for (const cell of row) {
        if (typeof cell === 'object' && cell.label === label) {
          return cell;
        }
      }
    }
    return null;
  }, []);

  const physicalKeyBindings = useMemo(() => {
    const baseBindings = allPhysicalKeyBindingsProp || bindings;
    const seen = new Set<string>();
    const result: HotkeyBinding[] = [];

    for (const binding of [...baseBindings, ...reservedBindings]) {
      if (seen.has(binding.id)) {
        continue;
      }
      seen.add(binding.id);
      result.push(binding);
    }

    return filterHotkeysByKeyboardLayer(result, activeLayer);
  }, [activeLayer, allPhysicalKeyBindingsProp, bindings, reservedBindings]);
  const selectedDetail = useMemo(() => {
    if (!selectedKey) {
      return null;
    }

    const keyDef = findKeyDef(selectedKey);
    if (!keyDef) {
      return null;
    }

    const selectedBindings = getBindingsForKeyboardSource(
      getMatchingBindingsForPhysicalKey(physicalKeyBindings, keyDef.names),
    );
    const selectedConflicts = conflicts.filter((conflict) =>
      conflict.bindings.some((conflictBinding) =>
        selectedBindings.some((binding) => binding.id === conflictBinding.id),
      ),
    );

    return { bindings: selectedBindings, conflicts: selectedConflicts };
  }, [conflicts, findKeyDef, getBindingsForKeyboardSource, physicalKeyBindings, selectedKey]);

  const layerDisplayName = getLayerDisplayName(activeLayer);
  const layerButtons: { key: ActiveLayer; label: string }[] = [
    { key: 'normal', label: '普通' },
    { key: 'uppercase', label: '大写' },
    { key: 'ctrl', label: 'Ctrl' },
    { key: 'alt', label: 'Alt' },
    { key: 'special', label: '特殊' },
  ];

  return (
    <div className="card keyboard-visualizer">
      <div className="kv-toolbar">
        <div className="kv-view-tabs">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.key}
              className={`kv-view-tab ${viewMode === option.key ? 'kv-view-tab--active' : ''}`}
              onClick={() => {
                onViewModeChange?.(option.key);
                onSelectKey(null);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="kv-layer-label">
          当前层：<strong>{layerDisplayName}</strong>
        </span>
        <div className="kv-layer-buttons">
          {layerButtons.map((button) => {
            const isActive = activeLayer === button.key;
            return (
              <button
                key={button.key}
                className={`kv-layer-btn ${isActive ? 'kv-layer-btn--active' : ''}`}
                onClick={() => onLayerChange?.(isActive ? 'normal' : button.key)}
              >
                {button.label}
              </button>
            );
          })}
        </div>
        <div className="kv-layer-buttons kv-layer-buttons--source">
          {SOURCE_OPTIONS.map((option) => {
            const isActive = sourceMode === option.key;
            return (
              <button
                key={option.key}
                className={`kv-layer-btn ${isActive ? 'kv-layer-btn--active' : ''}`}
                onClick={() => {
                  setSourceMode(option.key);
                  onSelectKey(null);
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="keyboard-wrapper">
        <div className="keyboard-board keyboard-board--overflow-safe">
          <KeyboardLayout
            rows={rows}
            dimFn={() => false}
            onKeyClick={handleKeyClick}
            onKeyHoverStart={handleKeyHoverStart}
            onKeyHoverEnd={handleKeyHoverEnd}
          />
        </div>
      </div>

      {hoverCard ? (
        <div
          className={`kv-hover-card kv-hover-card--${hoverCard.placement}`}
          style={{ left: `${hoverCard.left}px`, top: `${hoverCard.top}px` }}
        >
          {hoverCard.items.map((item, index) => (
            <div
              key={`${item.title}-${item.keyText}-${index}`}
              className={`kv-hover-card__item ${index > 0 ? 'kv-hover-card__item--split' : ''}`}
            >
              <div className="kv-hover-card__title">{item.title}</div>
              <div className="kv-hover-card__meta">{item.keyText}</div>
              <div className="kv-hover-card__meta">{item.sourceText}</div>
            </div>
          ))}
        </div>
      ) : null}

      <KeyboardLegend />

      {selectedDetail ? (
        <PhysicalKeyBindingPanel
          selectedKey={selectedKey!}
          bindings={selectedDetail.bindings.map(enrichWithPhysicalKey)}
          conflicts={selectedDetail.conflicts}
          activeLayer={activeLayer}
          onClose={() => onSelectKey(null)}
          onEdit={onEditBinding || (() => {})}
          onDelete={onDeleteBinding || (() => {})}
          onAdopt={onAdoptBinding || (() => {})}
          onOverrideSource={onOverrideSourceProp || (() => {})}
          onAddBinding={onAddBinding || (() => {})}
        />
      ) : null}
    </div>
  );
};

export default KeyboardOccupancy;
