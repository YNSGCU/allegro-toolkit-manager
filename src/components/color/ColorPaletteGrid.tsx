/**
 * ATM - 调色板可视化组件
 *
 * 展示 24/192 色调色板 + 背景色。点击色块后：
 *   1. 显示该颜色的 RGB / 十六进制值
 *   2. 列出使用该颜色的所有图层（回答"这个颜色在 Allegro 中对应哪块"）
 *   3. 可编辑该颜色（原生取色器 + 即时保存）
 */
import React, { useMemo, useState } from 'react';
import type { ColorLayerEntry, ColorPaletteEntry, ColorRgb } from '../../types/color';
import { rgbToHex } from '../../../core/color/colorPalette';

/** class 中文标注（帮助理解颜色在 Allegro 中对应的区域） */
const CLASS_LABELS: Record<string, string> = {
  ETCH: '走线/铜皮',
  PIN: '焊盘',
  'VIA CLASS': '过孔',
  'REF DES': '位号',
  'SILKSCREEN_TOP': '顶层丝印',
  'SILKSCREEN_BOTTOM': '底层丝印',
  'BOARD GEOMETRY': '板框/板体',
  'PACKAGE GEOMETRY': '封装图形',
  'PACKAGE KEEPIN': '封装限布区',
  'PACKAGE KEEPOUT': '封装禁布区',
  'ROUTE KEEPIN': '走线限布区',
  'ROUTE KEEPOUT': '走线禁布区',
  'VIA KEEPOUT': '过孔禁布区',
  'DRC ERROR CLASS': 'DRC 错误',
  'DRAWING FORMAT': '图纸格式',
  'MANUFACTURING': '制造标识',
  'CONSTRAINT REGION': '约束区域',
  'ANTI ETCH': '反蚀刻/分裂线',
  'ANALYSIS': '分析数据',
  'EMBEDDED GEOMETRY': '嵌入式图形',
  'RIGID FLEX': '软硬结合板',
  'SURFACE FINISHES': '表面处理',
  'USER PART NUMBER': '料号',
  'DEVICE TYPE': '器件类型',
  'COMPONENT VALUE': '器件值',
  'TOLERANCE': '公差标注',
};

function classLabel(className: string): string {
  return CLASS_LABELS[className] ?? className;
}

interface ColorPaletteGridProps {
  palette: ColorPaletteEntry[];
  background: ColorRgb;
  layers: ColorLayerEntry[];
  onPaletteChange?: (index: number, rgb: ColorRgb) => void;
  saving?: boolean;
}

const ColorPaletteGrid: React.FC<ColorPaletteGridProps> = ({
  palette,
  background,
  layers,
  onPaletteChange,
  saving = false,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);

  const layersByColor = useMemo(() => {
    const map = new Map<number, ColorLayerEntry[]>();
    for (const layer of layers) {
      const list = map.get(layer.colorIndex) ?? [];
      list.push(layer);
      map.set(layer.colorIndex, list);
    }
    return map;
  }, [layers]);

  const backgroundHex = rgbToHex(background);
  const selected = palette.find((entry) => entry.index === selectedIndex);
  const selectedLayers = selectedIndex !== null ? (layersByColor.get(selectedIndex) ?? []) : [];

  const handleEditConfirm = (hex: string) => {
    if (!selectedIndex || !onPaletteChange) return;
    const value = hex.replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(value)) return;
    const num = parseInt(value, 16);
    onPaletteChange(selectedIndex, {
      r: (num >> 16) & 0xff,
      g: (num >> 8) & 0xff,
      b: num & 0xff,
    });
    setEditing(false);
  };

  return (
    <div className="color-palette-panel">
      <div className="color-panel-title">
        <h3>调色板</h3>
        <span className="color-panel-subtitle">Allegro 颜色索引 1-{palette.length}</span>
      </div>

      <div className="color-palette-grid">
        {palette.map((entry) => {
          const hex = rgbToHex(entry.rgb);
          const isSelected = entry.index === selectedIndex;
          const usedCount = layersByColor.get(entry.index)?.length ?? 0;
          return (
            <button
              key={entry.index}
              type="button"
              className={`color-swatch${isSelected ? ' color-swatch--selected' : ''}`}
              style={{ backgroundColor: hex }}
              title={`#${entry.index} ${entry.name || ''} ${hex}${usedCount > 0 ? ` · ${usedCount} 个图层` : ''}`}
              onClick={() => {
                setSelectedIndex(isSelected ? null : entry.index);
                setEditing(false);
              }}
            >
              <span className="color-swatch-index">{entry.index}</span>
              {usedCount > 0 && <span className="color-swatch-count">{usedCount}</span>}
            </button>
          );
        })}

        <div
          className="color-swatch color-swatch--background"
          style={{ backgroundColor: backgroundHex }}
          title={`背景色 ${backgroundHex}`}
        >
          <span className="color-swatch-index">BG</span>
        </div>
      </div>

      <div className="color-detail-row">
        {selected ? (
          <>
            <span className="color-detail-swatch" style={{ backgroundColor: rgbToHex(selected.rgb) }} />
            <span>#{selected.index} {selected.name || ''}</span>
            <span>RGB {selected.rgb.r} {selected.rgb.g} {selected.rgb.b}</span>
            <code>{rgbToHex(selected.rgb)}</code>
          </>
        ) : (
          <>
            <span className="color-detail-swatch" style={{ backgroundColor: backgroundHex }} />
            <span>背景色</span>
            <span>RGB {background.r} {background.g} {background.b}</span>
            <code>{backgroundHex}</code>
          </>
        )}
      </div>

      {selected && (
        <div className="color-palette-selected-detail">
          <div className="color-palette-selected-head">
            <strong>颜色 #{selected.index} 在 Allegro 中用于：</strong>
            {onPaletteChange && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setEditing((v) => !v)}
                disabled={saving}
              >
                {saving ? '保存中…' : editing ? '取消编辑' : '编辑颜色'}
              </button>
            )}
          </div>

          {editing && (
            <div className="color-palette-editor">
              <input
                type="color"
                defaultValue={rgbToHex(selected.rgb)}
                onChange={(event) => handleEditConfirm(event.target.value)}
                aria-label="选择颜色"
              />
              <span>点击色块选择新颜色，即时保存</span>
            </div>
          )}

          {selectedLayers.length > 0 ? (
            <div className="color-palette-layers">
              {selectedLayers.slice(0, 40).map((layer) => (
                <span key={`${layer.className}/${layer.subclassName}`} className="color-palette-layer-tag">
                  {layer.className}/{layer.subclassName}
                  <em>{classLabel(layer.className)}</em>
                </span>
              ))}
              {selectedLayers.length > 40 && (
                <span className="color-palette-layer-more">…等共 {selectedLayers.length} 个图层</span>
              )}
            </div>
          ) : (
            <p className="color-palette-layers-empty">当前方案中没有图层使用该颜色。</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ColorPaletteGrid;