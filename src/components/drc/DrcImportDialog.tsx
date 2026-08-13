/**
 * ATM - DRC 导入预览确认弹窗
 */
import { BusinessDialog } from '../../shared/ui';
import type { DrcParseFileResult } from '../../types/drc';

interface DrcImportDialogProps {
  preview: DrcParseFileResult | null;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function DrcImportDialog({
  preview,
  busy,
  onConfirm,
  onClose,
}: DrcImportDialogProps) {
  if (!preview) return null;
  const { fileName, byteSize, parsed } = preview;
  const sizeText = byteSize >= 1024 * 1024
    ? `${(byteSize / 1024 / 1024).toFixed(2)} MB`
    : `${Math.max(1, Math.round(byteSize / 1024))} KB`;

  return (
    <BusinessDialog
      open
      title="导入 DRC 报告"
      description={`${fileName}（${sizeText}）解析完成，确认后保存到本地。`}
      onClose={busy ? () => undefined : onClose}
      dismissDisabled={busy}
      size="lg"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={busy}>
            {busy ? '正在导入…' : '确认导入'}
          </button>
        </>
      }
    >
      <div className="drc-import-preview">
        <dl className="drc-import-meta">
          <div><dt>格式</dt><dd>{parsed.format === 'rpt-text' ? 'Allegro 文本报告' : parsed.format === 'extracta-csv' ? 'Extracta CSV' : parsed.format === 'bridge' ? 'Vibe Bridge 在线抓取' : '无法识别'}</dd></div>
          <div><dt>设计</dt><dd>{parsed.designName || '-'}</dd></div>
          <div><dt>Allegro 版本</dt><dd>{parsed.allegroVersion || '-'}</dd></div>
          <div><dt>单位</dt><dd>{parsed.units || '-'}</dd></div>
          <div><dt>错误</dt><dd>{parsed.summary.errors}</dd></div>
          <div><dt>警告</dt><dd>{parsed.summary.warnings}</dd></div>
        </dl>
        {parsed.parseWarnings.length > 0 ? (
          <div className="drc-import-warnings">
            <p>解析提示：</p>
            <ul>
              {parsed.parseWarnings.slice(0, 8).map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </BusinessDialog>
  );
}
