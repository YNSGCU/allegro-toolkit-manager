/**
 * ATM - DRC 分组统计 Tab（按层 / 网络 / 规则 / 类型）
 */
import type { DrcGroupCount, DrcSummary } from '../../types/drc';

export type DrcGroupKey = 'layer' | 'net' | 'rule' | 'type';

interface DrcGroupTabsProps {
  groupKey: DrcGroupKey;
  summary: DrcSummary;
  activeName: string | null;
  onChange: (groupKey: DrcGroupKey) => void;
  onPick: (name: string) => void;
}

const GROUP_LABELS: Record<DrcGroupKey, string> = {
  layer: '按层',
  net: '按网络',
  rule: '按规则',
  type: '按类型',
};

function pickGroups(summary: DrcSummary, groupKey: DrcGroupKey): DrcGroupCount[] {
  switch (groupKey) {
    case 'layer':
      return summary.byLayer;
    case 'net':
      return summary.byNet;
    case 'rule':
      return summary.byRule;
    case 'type':
      return summary.byType;
  }
}

export default function DrcGroupTabs({
  groupKey,
  summary,
  activeName,
  onChange,
  onPick,
}: DrcGroupTabsProps) {
  const groups = pickGroups(summary, groupKey);
  const maxCount = Math.max(1, ...groups.map((group) => group.count));

  return (
    <div className="drc-group-panel">
      <div className="drc-group-tabs" role="tablist" aria-label="分组维度">
        {(Object.keys(GROUP_LABELS) as DrcGroupKey[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={groupKey === key}
            className={`drc-group-tab${groupKey === key ? ' active' : ''}`}
            onClick={() => onChange(key)}
          >
            {GROUP_LABELS[key]}
          </button>
        ))}
      </div>
      {groups.length === 0 ? (
        <div className="drc-group-empty">该维度暂无数据</div>
      ) : (
        <div className="drc-group-list">
          {groups.slice(0, 12).map((group) => {
            const active = activeName === group.name;
            const width = `${Math.round((group.count / maxCount) * 100)}%`;
            return (
              <button
                key={`${groupKey}:${group.name}`}
                type="button"
                className={`drc-group-row${active ? ' active' : ''}`}
                onClick={() => onPick(group.name)}
                title={active ? '再次点击取消筛选' : `筛选 ${group.name}`}
              >
                <span className="drc-group-name">{group.name}</span>
                <span className="drc-group-bar-track">
                  <span className="drc-group-bar" style={{ width }} />
                </span>
                <span className="drc-group-count">{group.count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
