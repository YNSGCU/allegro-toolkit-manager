/**
 * ATM - 图层颜色分配列表
 *
 * 按 class 分组展示每个 subclass 的颜色与可见性，
 * 直接对应 Allegro Color/Visibility 对话框的层级结构。
 * 每个图层可下拉修改颜色索引（即时保存）。
 */
import React, { useMemo, useState } from 'react';
import type { ColorLayerEntry, ColorPaletteEntry } from '../../types/color';
import { rgbToHex } from '../../../core/color/colorPalette';

interface ColorLayerListProps {
  layers: ColorLayerEntry[];
  palette: ColorPaletteEntry[];
  onLayerColorChange?: (className: string, subclassName: string, colorIndex: number) => void;
  saving?: boolean;
}

interface GroupInfo {
  className: string;
  entries: ColorLayerEntry[];
}

const ColorLayerList: React.FC<ColorLayerListProps> = ({
  layers,
  palette,
  onLayerColorChange,
  saving = false,
}) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');

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
      .sort((a, b) => a.className.localeCompare(b.className));
  }, [layers, search]);

  const visibleCount = layers.filter((layer) => layer.visible).length;
  const hiddenCount = layers.length - visibleCount;

  const paletteColor = (index: number): string => {
    const entry = palette.find((item) => item.index === index);
    if (!entry) return '#888888';
    return rgbToHex(entry.rgb);
  };

  const toggleGroup = (className: string) => {
    setCollapsed((prev) => ({ ...prev, [className]: !prev[className] }));
  };

  return (
    <div className="color-layers-panel">
      <div className="color-panel-title">
        <h3>图层颜色分配</h3>
        <span className="color-panel-subtitle">
          {layers.length} 个图层（{visibleCount} 可见 / {hiddenCount} 隐藏）
        </span>
      </div>

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
            const isCollapsed = collapsed[group.className];
            return (
              <div key={group.className} className="color-layer-group">
                <button
                  type="button"
                  className="color-layer-group-header"
                  onClick={() => toggleGroup(group.className)}
                >
                  <span className="color-layer-group-caret">{isCollapsed ? '▸' : '▾'}</span>
                  <span className="color-layer-group-name">{group.className}</span>
                  <span className="color-layer-group-count">{group.entries.length}</span>
                </button>

                {!isCollapsed && (
                  <div className="color-layer-rows">
                    {group.entries.map((layer, index) => (
                      <div key={`${layer.className}/${layer.subclassName}-${index}`} className="color-layer-row">
                        <span
                          className="color-layer-swatch"
                          style={{ backgroundColor: paletteColor(layer.colorIndex) }}
                          title={`颜色索引 #${layer.colorIndex}`}
                        />
                        <span className="color-layer-name">{layer.subclassName}</span>
                        {onLayerColorChange ? (
                          <select
                            className="color-layer-pick"
                            value={layer.colorIndex}
                            disabled={saving}
                            title="修改此图层的颜色索引"
                            onChange={(event) =>
                              onLayerColorChange(
                                layer.className,
                                layer.subclassName,
                                Number(event.target.value),
                              )
                            }
                          >
                            {palette.map((entry) => (
                              <option key={entry.index} value={entry.index}>
                                #{entry.index}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="color-layer-index">#{layer.colorIndex}</span>
                        )}
                        <span
                          className={`color-layer-visibility${layer.visible ? ' is-visible' : ''}`}
                        >
                          {layer.visible ? '可见' : '隐藏'}
                        </span>
                      </div>
                    ))}
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