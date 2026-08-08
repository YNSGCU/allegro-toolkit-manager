/**
 * ATM - 图层颜色分配列表
 *
 * 按 class 分组展示每个 subclass 的颜色与可见性，
 * 直接对应 Allegro Color/Visibility 对话框的层级结构。
 * 每个图层可下拉修改颜色索引（即时保存）。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pipette } from 'lucide-react';
import type { ColorLayerEntry, ColorPaletteEntry } from '../../types/color';
import { rgbToHex } from '../../../core/color/colorPalette';

interface ColorLayerListProps {
  layers: ColorLayerEntry[];
  palette: ColorPaletteEntry[];
  onLayerColorChange?: (className: string, subclassName: string, colorIndex: number) => void;
  onLayerCustomColor?: (layer: ColorLayerEntry, hex: string) => boolean | Promise<boolean>;
  saving?: boolean;
}

interface GroupInfo {
  className: string;
  entries: ColorLayerEntry[];
}

const CLASS_LABELS: Record<string, string> = {
  ETCH: '实际铜层',
  'ANTI ETCH': '反蚀刻辅助层',
  PIN: '焊盘图形',
  'VIA CLASS': '过孔图形',
  'BOARD GEOMETRY': '板框与板级图形',
  'PACKAGE GEOMETRY': '封装图形',
  MANUFACTURING: '制造辅助图形',
  'DRC ERROR CLASS': 'DRC 标记',
};

const CLASS_PRIORITY = [
  'ETCH',
  'PIN',
  'VIA CLASS',
  'BOARD GEOMETRY',
  'PACKAGE GEOMETRY',
  'ANTI ETCH',
];

const CUSTOM_COLOR_VALUE = '__custom_color__';

function classSortIndex(className: string): number {
  const index = CLASS_PRIORITY.indexOf(className);
  return index === -1 ? CLASS_PRIORITY.length : index;
}

function isCollapsedByDefault(className: string): boolean {
  return className !== 'ETCH';
}

function layerTypeLabel(layerType?: string | null): string | null {
  if (layerType === 'CONDUCTOR') return '信号层';
  if (layerType === 'PLANE') return '平面层';
  return null;
}

const ColorLayerList: React.FC<ColorLayerListProps> = ({
  layers,
  palette,
  onLayerColorChange,
  onLayerCustomColor,
  saving = false,
}) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [customColorKey, setCustomColorKey] = useState<string | null>(null);
  const [customHex, setCustomHex] = useState('#000000');
  const [customColorError, setCustomColorError] = useState('');
  const customHexInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (customColorKey) customHexInputRef.current?.focus();
  }, [customColorKey]);

  const paletteByIndex = useMemo(
    () => new Map(palette.map((entry) => [entry.index, entry])),
    [palette],
  );

  const groups = useMemo<GroupInfo[]>(() => {
    const byClass = new Map<string, ColorLayerEntry[]>();
    const keyword = search.trim().toLowerCase();
    for (const layer of layers) {
      if (keyword && !`${layer.className} ${layer.subclassName}`.toLowerCase().includes(keyword)) {
        continue;
      }
      const list = byClass.get(layer.className) ?? [];
      list.push(layer);
      byClass.set(layer.className, list);
    }
    return [...byClass.entries()]
      .map(([className, entries]) => ({ className, entries }))
      .sort((a, b) => (
        classSortIndex(a.className) - classSortIndex(b.className) ||
        a.className.localeCompare(b.className)
      ));
  }, [layers, search]);

  const visibleCount = layers.filter((layer) => layer.visible).length;
  const hiddenCount = layers.length - visibleCount;

  const paletteColor = (index: number): string => {
    const entry = paletteByIndex.get(index);
    if (!entry) return '#888888';
    return rgbToHex(entry.rgb);
  };

  const paletteOptionLabel = (entry: ColorPaletteEntry): string => {
    const hex = rgbToHex(entry.rgb);
    return entry.name
      ? `#${entry.index} · ${entry.name} · ${hex}`
      : `#${entry.index} · ${hex}`;
  };

  const toggleGroup = (className: string) => {
    setCollapsed((prev) => {
      const current = prev[className] ?? isCollapsedByDefault(className);
      return { ...prev, [className]: !current };
    });
  };

  const openCustomColorEditor = (layer: ColorLayerEntry) => {
    const key = `${layer.className}/${layer.subclassName}`;
    setCustomColorKey(key);
    setCustomHex(paletteColor(layer.colorIndex));
    setCustomColorError('');
  };

  const closeCustomColorEditor = () => {
    setCustomColorKey(null);
    setCustomColorError('');
  };

  const saveCustomColor = async (layer: ColorLayerEntry) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(customHex)) {
      setCustomColorError('请输入完整的 6 位 Hex 色值，例如 #12ABEF');
      return;
    }
    if (!onLayerCustomColor) return;

    try {
      const ok = await onLayerCustomColor(layer, customHex.toUpperCase());
      if (ok) closeCustomColorEditor();
    } catch {
      setCustomColorError('保存自定义颜色失败，请重试');
    }
  };

  return (
    <div className="color-layers-panel">
      <div className="color-panel-title">
        <h3>图层颜色分配</h3>
        <span className="color-panel-subtitle">
          {layers.length} 个图层（{visibleCount} 可见 / {hiddenCount} 隐藏）
        </span>
      </div>

      <p className="color-layers-help">
        按 Allegro Class / Subclass 展示。ETCH 是实际板层；ANTI ETCH 等属于辅助图形类。
      </p>

      {layers.length > 0 && visibleCount === 0 && (
        <div className="color-layers-warning" role="status">
          当前方案的可见性全部为“隐藏”。颜色仍可正常使用；如需复制可见性，请从 Allegro 重新捕获一次。
        </div>
      )}

      <input
        type="text"
        className="color-layers-search"
        placeholder="搜索图层（如 ETCH / TOP）"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {groups.length === 0 ? (
        <div className="color-layers-empty">
          {search
            ? '没有匹配的图层'
            : '该方案暂无图层数据。请先从 Allegro 捕获，或通过 .col 导入调色板。'}
        </div>
      ) : (
        <div className="color-layers-groups">
          {groups.map((group) => {
            const isCollapsed = search.trim()
              ? false
              : (collapsed[group.className] ?? isCollapsedByDefault(group.className));
            const classLabel = CLASS_LABELS[group.className];
            return (
              <div key={group.className} className="color-layer-group">
                <button
                  type="button"
                  className="color-layer-group-header"
                  onClick={() => toggleGroup(group.className)}
                  aria-expanded={!isCollapsed}
                >
                  <span className="color-layer-group-caret">{isCollapsed ? '▸' : '▾'}</span>
                  <span className="color-layer-group-name">
                    <span>{group.className}</span>
                    {classLabel && <small>{classLabel}</small>}
                  </span>
                  <span className="color-layer-group-count">{group.entries.length}</span>
                </button>

                {!isCollapsed && (
                  <div className="color-layer-rows">
                    {group.entries.map((layer) => {
                      const typeLabel = layerTypeLabel(layer.layerType);
                      const currentColor = paletteByIndex.get(layer.colorIndex);
                      const layerKey = `${layer.className}/${layer.subclassName}`;
                      const isCustomizing = customColorKey === layerKey;
                      const validCustomHex = /^#[0-9a-fA-F]{6}$/.test(customHex);
                      return (
                        <div key={layerKey} className="color-layer-row-wrap">
                          <div className="color-layer-row">
                            <span
                              className="color-layer-swatch"
                              style={{ backgroundColor: paletteColor(layer.colorIndex) }}
                              title={currentColor ? paletteOptionLabel(currentColor) : `颜色索引 #${layer.colorIndex}`}
                            />
                            <span className="color-layer-name">
                              <span>{layer.subclassName}</span>
                              {typeLabel && <small>{typeLabel}</small>}
                            </span>
                            {onLayerColorChange ? (
                              <select
                                className="color-layer-pick"
                                value={layer.colorIndex}
                                disabled={saving}
                                aria-label={`${layer.className}/${layer.subclassName} 颜色`}
                                title="修改此图层的颜色"
                                onChange={(event) => {
                                  if (event.target.value === CUSTOM_COLOR_VALUE) {
                                    openCustomColorEditor(layer);
                                    return;
                                  }
                                  onLayerColorChange(
                                    layer.className,
                                    layer.subclassName,
                                    Number(event.target.value),
                                  );
                                }}
                              >
                                {onLayerCustomColor && (
                                  <option value={CUSTOM_COLOR_VALUE}>自定义颜色…</option>
                                )}
                                {palette.map((entry) => (
                                  <option key={entry.index} value={entry.index}>
                                    {paletteOptionLabel(entry)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="color-layer-index">
                                {currentColor ? paletteOptionLabel(currentColor) : `#${layer.colorIndex}`}
                              </span>
                            )}
                            {onLayerCustomColor && (
                              <button
                                type="button"
                                className="color-layer-custom-trigger"
                                onClick={() => openCustomColorEditor(layer)}
                                disabled={saving}
                                aria-label={`${layerKey} 自定义颜色`}
                                aria-expanded={isCustomizing}
                                title="输入 Hex 或使用取色器，仅修改此图层"
                              >
                                <Pipette aria-hidden="true" />
                                <span>自定义</span>
                              </button>
                            )}
                            <span
                              className={`color-layer-visibility${layer.visible ? ' is-visible' : ''}`}
                            >
                              {layer.visible ? '可见' : '隐藏'}
                            </span>
                          </div>

                          {isCustomizing && onLayerCustomColor && (
                            <div className="color-layer-custom-editor" role="group" aria-label={`${layerKey} 自定义颜色`}>
                              <label className="color-layer-custom-field">
                                <span>自定义 Hex</span>
                                <input
                                  ref={customHexInputRef}
                                  type="text"
                                  value={customHex}
                                  maxLength={7}
                                  aria-label={`${layerKey} 自定义 Hex`}
                                  aria-invalid={Boolean(customColorError)}
                                  onChange={(event) => setCustomHex(event.target.value)}
                                />
                              </label>
                              <label className="color-layer-custom-picker">
                                <span>选择颜色</span>
                                <input
                                  type="color"
                                  value={validCustomHex ? customHex : paletteColor(layer.colorIndex)}
                                  aria-label={`${layerKey} 颜色选择器`}
                                  onChange={(event) => {
                                    setCustomHex(event.target.value.toUpperCase());
                                    setCustomColorError('');
                                  }}
                                />
                              </label>
                              <div className="color-layer-custom-actions">
                                <button type="button" className="btn btn-sm" onClick={closeCustomColorEditor} disabled={saving}>
                                  取消
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => void saveCustomColor(layer)}
                                  disabled={saving || !validCustomHex}
                                >
                                  {saving ? '保存中…' : '仅应用到此图层'}
                                </button>
                              </div>
                              <p>系统会自动分配安全的调色板索引，不改变其他图层的当前颜色。</p>
                              {customColorError && <p className="color-layer-custom-error" role="alert">{customColorError}</p>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ColorLayerList;
