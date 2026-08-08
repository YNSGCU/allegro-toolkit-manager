/**
 * ATM - 配色应用预览弹窗
 *
 * 应用配色方案前展示目标板叠层与最终颜色映射：
 *  - ETCH 叠层按角色（顶层/底层/平面层/内部信号层）列出最终颜色
 *  - 非 ETCH 层按名称精确匹配
 *  - 将写入的调色板索引
 *  - 是否复制可见性
 *
 * 用户确认后才调用 color:apply，写入前自动保存当前板子快照用于撤销。
 */
import React from 'react';
import type { ColorApplyPreview } from '../../../core/color/vibeColorBridge';
import BusinessDialog from '../../shared/ui/overlays/BusinessDialog';

const ROLE_LABELS: Record<string, string> = {
  top: '顶层',
  bottom: '底层',
  plane: '平面层',
  inner: '信号层',
};

interface ColorApplyPreviewDialogProps {
  open: boolean;
  preview: ColorApplyPreview | null;
  schemeName: string;
  applying: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ColorApplyPreviewDialog: React.FC<ColorApplyPreviewDialogProps> = ({
  open,
  preview,
  schemeName,
  applying,
  onConfirm,
  onCancel,
}) => {
  return (
    <BusinessDialog
      open={open}
      title="应用配色方案"
      description={`将「${schemeName}」应用到当前板子，请确认最终颜色映射。`}
      onClose={() => {
        if (!applying) onCancel();
      }}
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel} disabled={applying}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={applying}
          >
            {applying ? '应用中…' : '确认应用'}
          </button>
        </>
      }
    >
      {!preview ? (
        <p className="color-preview-loading">正在查询目标板叠层…</p>
      ) : (
        <div className="color-preview-body">
          <p className="color-preview-note">
            目标板：顶层 {preview.targetTop ?? '—'} · 底层 {preview.targetBottom ?? '—'} · 调色板{' '}
            {preview.colorCount} 色
            {preview.applyVisibility ? ' · 同时复制可见性' : ' · 不复制可见性（只改颜色）'}
          </p>

          <div className="color-preview-section">
            <h4>ETCH 叠层（{preview.etchLayers.length} 层）</h4>
            <div className="color-preview-table">
              {preview.etchLayers.map((layer) => (
                <div key={layer.name} className="color-preview-row">
                  <span className="color-preview-role">{ROLE_LABELS[layer.role] ?? layer.role}</span>
                  <span className="color-preview-name">{layer.name}</span>
                  <span
                    className="color-preview-swatch"
                    style={{ backgroundColor: layer.hex ?? '#888888' }}
                    title={layer.hex ?? ''}
                  />
                  <span className="color-preview-color">
                    #{layer.colorIndex}
                    {layer.colorName ? ` · ${layer.colorName}` : ''}
                    {layer.hex ? ` · ${layer.hex}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {preview.otherLayers.length > 0 && (
            <div className="color-preview-section">
              <h4>辅助图形层（{preview.otherLayers.length} 个，按名称精确匹配）</h4>
              <div className="color-preview-table color-preview-table--compact">
                {preview.otherLayers.slice(0, 24).map((layer) => (
                  <div key={layer.name} className="color-preview-row">
                    <span className="color-preview-name">{layer.name}</span>
                    <span
                      className="color-preview-swatch"
                      style={{ backgroundColor: layer.hex ?? '#888888' }}
                      title={layer.hex ?? ''}
                    />
                    <span className="color-preview-color">
                      #{layer.colorIndex}
                      {layer.colorName ? ` · ${layer.colorName}` : ''}
                    </span>
                  </div>
                ))}
                {preview.otherLayers.length > 24 && (
                  <p className="color-preview-more">…等共 {preview.otherLayers.length} 个</p>
                )}
              </div>
            </div>
          )}

          <div className="color-preview-section">
            <h4>将写入调色板（{preview.paletteChanges.length} 色）</h4>
            <div className="color-preview-table color-preview-table--compact color-preview-palette">
              {preview.paletteChanges.slice(0, 24).map((entry) => (
                <div key={entry.index} className="color-preview-row">
                  <span
                    className="color-preview-swatch"
                    style={{ backgroundColor: entry.hex }}
                    title={entry.hex}
                  />
                  <span className="color-preview-color">
                    #{entry.index}
                    {entry.name ? ` · ${entry.name}` : ''} · {entry.hex}
                  </span>
                </div>
              ))}
              {preview.paletteChanges.length > 24 && (
                <p className="color-preview-more">…等共 {preview.paletteChanges.length} 色</p>
              )}
            </div>
          </div>

          <p className="color-preview-undo-note">
            应用前会自动保存当前板子配色快照，应用后可在页面顶部「撤销本次配色」。
          </p>
        </div>
      )}
    </BusinessDialog>
  );
};

export default ColorApplyPreviewDialog;
