/**
 * ATM - DRC 报告列表（左栏）
 */
import type { DrcReportSummary } from '../../types/drc';

interface DrcReportListProps {
  reports: DrcReportSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatImportedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

export default function DrcReportList({
  reports,
  selectedId,
  onSelect,
  onDelete,
}: DrcReportListProps) {
  if (reports.length === 0) {
    return (
      <div className="drc-list-empty">
        <p>还没有 DRC 报告</p>
        <span>点击上方「导入报告」，选择 Allegro 导出的 .rpt / CSV 文件。</span>
      </div>
    );
  }

  return (
    <ul className="drc-list">
      {reports.map((item) => {
        const active = item.id === selectedId;
        return (
          <li
            key={item.id}
            className={`drc-list-item${active ? ' active' : ''}`}
            onClick={() => onSelect(item.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(item.id);
              }
            }}
          >
            <div className="drc-list-item-head">
              <span className="drc-list-item-name" title={item.name}>
                {item.name}
              </span>
              <button
                type="button"
                className="drc-list-item-delete"
                aria-label={`删除报告 ${item.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(item.id);
                }}
              >
                删除
              </button>
            </div>
            {item.designName ? (
              <div className="drc-list-item-meta" title={item.designName}>
                {item.designName}
              </div>
            ) : null}
            <div className="drc-list-item-stats">
              <span className="drc-stat-error">错误 {item.summary.errors}</span>
              <span className="drc-stat-warning">警告 {item.summary.warnings}</span>
              <span>总数 {item.summary.total}</span>
            </div>
            <div className="drc-list-item-time">{formatImportedAt(item.importedAt)}</div>
          </li>
        );
      })}
    </ul>
  );
}
