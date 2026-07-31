/**
 * ATM - 快捷键方案导入预览对话框（V2.2）
 *
 * 从 JSON 文件导入方案时的预览弹窗。
 * 显示方案概要、冲突检测，提供导入为新方案 / 导入并预览应用两种操作。
 */
import React from 'react';

/** 导入预览数据 */
export interface ImportPreviewData {
  /** 方案名称 */
  profileName: string;
  /** 方案描述 */
  profileDescription: string;
  /** 原始 JSON 中的方案 ID */
  profileId: string;
  /** 快捷键总数 */
  totalHotkeys: number;
  /** funckey 数量 */
  funckeyCount: number;
  /** alias 数量 */
  aliasCount: number;
  /** 当前已存在的同名方案 */
  sameNameProfiles: string[];
  /** 与当前 env 绑定的冲突数量（相同按键） */
  envConflictCount: number;
  /** 覆盖默认/保留键的数量 */
  reservedOverrideCount: number;
  /** 转换后的绑定数组（用于保存） */
  bindings: Array<{
    key: string;
    command: string;
    type: 'funckey' | 'alias';
    chineseName?: string;
    enabled: boolean;
  }>;
  /** 原始 JSON 完整内容 */
  rawJson: string;
}

interface ImportPreviewDialogProps {
  data: ImportPreviewData;
  onClose: () => void;
  onImportAsNew: (data: ImportPreviewData) => void;
  onImportAndPreview: (data: ImportPreviewData) => void;
}

const ImportPreviewDialog: React.FC<ImportPreviewDialogProps> = ({
  data,
  onClose,
  onImportAsNew,
  onImportAndPreview,
}) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520 }}
      >
        {/* ── Header ── */}
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: 15 }}>
            导入快捷键方案
          </h3>
          <button className="btn btn-sm" onClick={onClose}>关闭</button>
        </div>

        {/* ── Body ── */}
        <div className="modal-body" style={{ padding: '16px 0' }}>
          {/* 方案概要 */}
          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                <tr>
                  <td style={{ padding: '4px 8px', color: 'var(--text-muted)', width: 120 }}>方案名称</td>
                  <td style={{ padding: '4px 8px', fontWeight: 600 }}>{data.profileName}</td>
                </tr>
                {data.profileDescription && (
                  <tr>
                    <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>描述</td>
                    <td style={{ padding: '4px 8px' }}>{data.profileDescription}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>快捷键数量</td>
                  <td style={{ padding: '4px 8px' }}>
                    {data.totalHotkeys}
                    &nbsp;(F: {data.funckeyCount} / A: {data.aliasCount})
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 冲突检测 */}
          <div style={{ fontSize: 13, marginBottom: 12 }}>
            {/* 同名方案警告 */}
            {data.sameNameProfiles.length > 0 && (
              <div style={{ padding: '8px 12px', marginBottom: 8, background: 'var(--bg-warning-bg, #fff3cd)', borderRadius: 'var(--radius)', color: 'var(--text-warning, #856404)' }}>
                已存在同名方案：
                {data.sameNameProfiles.map((name) => (
                  <code key={name} style={{ margin: '0 4px' }}>{name}</code>
                ))}
                ，导入后会自动追加"副本"。
              </div>
            )}

            {/* env 冲突警告 */}
            {data.envConflictCount > 0 && (
              <div style={{ padding: '8px 12px', marginBottom: 8, background: 'var(--bg-warning-bg, #fff3cd)', borderRadius: 'var(--radius)', color: 'var(--text-warning, #856404)' }}>
                与当前 env 中的 {data.envConflictCount} 个快捷键按键冲突。
              </div>
            )}

            {/* 覆盖保留键警告 */}
            {data.reservedOverrideCount > 0 && (
              <div style={{ padding: '8px 12px', marginBottom: 8, background: 'var(--bg-warning-bg, #fff3cd)', borderRadius: 'var(--radius)', color: 'var(--text-warning, #856404)' }}>
                {data.reservedOverrideCount} 个快捷键会覆盖默认/保留键。
              </div>
            )}

            {/* 无冲突提示 */}
            {data.sameNameProfiles.length === 0 &&
             data.envConflictCount === 0 &&
             data.reservedOverrideCount === 0 && (
              <div style={{ padding: '8px 12px', background: 'var(--bg-info-bg, #d1ecf1)', borderRadius: 'var(--radius)', color: 'var(--text-info, #0c5460)' }}>
                方案检查通过，无冲突。
              </div>
            )}
          </div>

          {/* 提示 */}
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            导入不会直接修改 env 文件。
          </p>
        </div>

        {/* ── Footer ── */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn" onClick={() => onImportAsNew(data)}>
            导入为新方案
          </button>
          <button className="btn btn-primary" onClick={() => onImportAndPreview(data)}>
            导入并预览应用
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportPreviewDialog;
