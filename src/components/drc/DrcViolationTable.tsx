/**
 * ATM - DRC 违规明细表（窗口化渲染）
 */
import { useEffect, useRef, useState } from 'react';
import type { DrcStatus, DrcViolation } from '../../types/drc';
import { computeDrcWindow } from './drcVirtualize';

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

const ROW_HEIGHT = 48;
const OVERSCAN = 10;

function formatLocation(violation: DrcViolation): string {
  if (!violation.location) return '-';
  const { x, y, units } = violation.location;
  return x.toFixed(2) + ' ' + y.toFixed(2) + (units ? ' ' + units : '');
}

export default function DrcViolationTable({
  violations,
  onStatusChange,
  onInspect,
}: DrcViolationTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewHeight, setViewHeight] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setViewHeight(el.clientHeight || 0);
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
    return undefined;
  }, []);

  if (violations.length === 0) {
    return <div className="drc-table-empty">当前筛选条件下没有违规条目</div>;
  }

  const headerHeight = theadRef.current?.offsetHeight ?? 0;
  const win = computeDrcWindow(violations.length, scrollTop, viewHeight, headerHeight, ROW_HEIGHT, OVERSCAN);
  const visible = violations.slice(win.start, win.end);

  return (
    <div
      className="drc-table-wrap"
      ref={containerRef}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <table className="drc-table drc-table--virtualized">
        <thead ref={theadRef}>
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
          {win.topPad > 0 && <tr style={{ height: win.topPad }} aria-hidden="true" />}
          {visible.map((violation) => (
            <tr key={violation.id}>
              <td>
                <select
                  className="drc-status-select"
                  value={violation.status}
                  aria-label={'设置 ' + violation.rule + ' 的状态'}
                  onChange={(event) => onStatusChange(violation, event.target.value as DrcStatus)}
                >
                  {(Object.keys(STATUS_LABELS) as DrcStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="drc-cell-rule">
                {violation.rule}
                {(violation.waived || violation.fixed) && (
                  <span className="drc-allegro-badges">
                    {violation.waived && <span className="drc-badge drc-badge--waived">waived</span>}
                    {violation.fixed && <span className="drc-badge drc-badge--fixed">fixed</span>}
                  </span>
                )}
              </td>
              <td>
                <span className={'drc-severity drc-severity--' + violation.severity}>
                  {violation.severity === 'error' ? '错误' : '警告'}
                </span>
              </td>
              <td>{violation.layer ?? '-'}</td>
              <td>{violation.net ?? '-'}</td>
              <td>
                {violation.component ?? '-'}
                {violation.pin ? ' / ' + violation.pin : ''}
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
                  ? (violation.actual ?? '-') + ' / ' + (violation.expected ?? '-')
                  : '-'}
              </td>
              <td className="drc-cell-desc" title={violation.description}>
                {violation.description || '-'}
              </td>
            </tr>
          ))}
          {win.bottomPad > 0 && <tr style={{ height: win.bottomPad }} aria-hidden="true" />}
        </tbody>
      </table>
    </div>
  );
}
