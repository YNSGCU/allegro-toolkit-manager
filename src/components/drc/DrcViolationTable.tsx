/**
 * ATM - DRC 违规明细表
 */
import type { DrcStatus, DrcViolation } from '../../types/drc';

interface DrcViolationTableProps {
  violations: DrcViolation[];
  onStatusChange: (violation: DrcViolation, status: DrcStatus) => void;
  onInspect: (violation: DrcViolation) => void;
}

const STATUS_LABELS: Record<DrcStatus, string> = {
  unresolved: '未处理',
  resolved: '已解决',
  ignored: '已忽略',
};

function formatLocation(violation: DrcViolation): string {
  if (!violation.location) return '-';
  const { x, y, units } = violation.location;
  return `${x.toFixed(2)} ${y.toFixed(2)}${units ? ` ${units}` : ''}`;
}

export default function DrcViolationTable({
  violations,
  onStatusChange,
  onInspect,
}: DrcViolationTableProps) {
  if (violations.length === 0) {
    return <div className="drc-table-empty">当前筛选条件下没有违规条目</div>;
  }

  return (
    <div className="drc-table-wrap">
      <table className="drc-table">
        <thead>
          <tr>
            <th>状态</th>
            <th>规则</th>
            <th>严重度</th>
            <th>层</th>
            <th>网络</th>
            <th>元件 / 引脚</th>
            <th>位置</th>
            <th>实际 / 期望</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          {violations.map((violation) => (
            <tr key={violation.id}>
              <td>
                <select
                  className="drc-status-select"
                  value={violation.status}
                  aria-label={`设置 ${violation.rule} 的状态`}
                  onChange={(event) => onStatusChange(violation, event.target.value as DrcStatus)}
                >
                  {(Object.keys(STATUS_LABELS) as DrcStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="drc-cell-rule">{violation.rule}</td>
              <td>
                <span className={`drc-severity drc-severity--${violation.severity}`}>
                  {violation.severity === 'error' ? '错误' : '警告'}
                </span>
              </td>
              <td>{violation.layer ?? '-'}</td>
              <td>{violation.net ?? '-'}</td>
              <td>
                {violation.component ?? '-'}
                {violation.pin ? ` / ${violation.pin}` : ''}
              </td>
              <td>
                <button
                  type="button"
                  className="drc-location-link"
                  onClick={() => onInspect(violation)}
                  title="查看原始报告对应位置"
                >
                  {formatLocation(violation)}
                </button>
              </td>
              <td>
                {violation.actual || violation.expected
                  ? `${violation.actual ?? '-'} / ${violation.expected ?? '-'}`
                  : '-'}
              </td>
              <td className="drc-cell-desc" title={violation.description}>
                {violation.description || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
