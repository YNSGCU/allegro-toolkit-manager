/**
 * ATM - DRC 导出格式选择弹窗
 */
import { BusinessDialog } from '../../shared/ui';
import type { DrcExportFormat } from '../../types/drc';

interface DrcExportDialogProps {
  open: boolean;
  count: number;
  busy: boolean;
  onExport: (format: DrcExportFormat) => void;
  onClose: () => void;
}

const FORMAT_OPTIONS: Array<{ format: DrcExportFormat; label: string; description: string }> = [
  { format: 'markdown', label: 'Markdown', description: '适合粘贴到文档 / 知识库' },
  { format: 'html', label: 'HTML', description: '带样式的表格页，适合浏览器查看' },
  { format: 'csv', label: 'CSV', description: '适合 Excel / 脚本二次处理' },
];

export default function DrcExportDialog({
  open,
  count,
  busy,
  onExport,
  onClose,
}: DrcExportDialogProps) {
  return (
    <BusinessDialog
      open={open}
      title="导出 DRC 报告"
      description={`将导出当前筛选结果（${count} 条违规）为单文件。`}
      onClose={busy ? () => undefined : onClose}
      dismissDisabled={busy}
      size="sm"
      footer={
        <button type="button" className="btn" onClick={onClose} disabled={busy}>
          取消
        </button>
      }
    >
      <div className="drc-export-options">
        {FORMAT_OPTIONS.map((option) => (
          <button
            key={option.format}
            type="button"
            className="drc-export-option"
            onClick={() => onExport(option.format)}
            disabled={busy || count === 0}
          >
            <span className="drc-export-option-label">{option.label}</span>
            <span className="drc-export-option-desc">{option.description}</span>
          </button>
        ))}
      </div>
    </BusinessDialog>
  );
}
