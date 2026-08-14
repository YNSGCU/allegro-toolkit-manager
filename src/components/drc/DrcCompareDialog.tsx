/**
 * ATM - DRC 多报告对比弹窗
 *
 * 基线 = 当前选中的报告；对比目标 = 下拉选择的另一份报告。
 * 按稳定 id 匹配，展示 新增 / 已解决 / 持续 三类差异。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { DrcCompareResult, DrcReport, DrcReportSummary, DrcViolation } from '../../types/drc';
import { compareDrcReports } from '../../../core/drc/drcCompare';
import { BusinessDialog, formatUserError } from '../../shared/ui';

interface DrcCompareDialogProps {
  open: boolean;
  baseline: DrcReport | null;
  reports: DrcReportSummary[];
  onClose: () => void;
}

const KIND_LABELS = { added: '新增', resolved: '已解决', persistent: '持续' } as const;

export default function DrcCompareDialog({ open, baseline, reports, onClose }: DrcCompareDialogProps) {
  const candidates = useMemo(() => reports.filter((r) => r.id !== baseline?.id), [reports, baseline]);
  const [targetId, setTargetId] = useState('');
  const [target, setTarget] = useState<DrcReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && candidates.length > 0 && !candidates.some((c) => c.id === targetId)) {
      setTargetId(candidates[0].id);
    }
  }, [open, candidates, targetId]);

  const loadTarget = useCallback(async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await window.atm.drcGetReport(id);
      if (res.success && res.data) setTarget(res.data);
      else setError(res.error || '加载对比报告失败');
    } catch (err) {
      setError(formatUserError(err, '加载对比报告失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && targetId) void loadTarget(targetId);
  }, [open, targetId, loadTarget]);

  const result = useMemo<DrcCompareResult | null>(() => {
    if (!baseline || !target) return null;
    return compareDrcReports(baseline, target);
  }, [baseline, target]);

  return (
    <BusinessDialog
      open={open}
      title="对比 DRC 报告"
      description="基线为当前选中的报告；选择另一份报告对比，快速查看修复后新增 / 已解决 / 持续存在的问题。"
      onClose={onClose}
      size="lg"
      footer={<button type="button" className="btn" onClick={onClose}>关闭</button>}
    >
      {baseline && candidates.length === 0 ? (
        <div className="drc-compare-empty">至少需要两份报告才能对比，请先导入更多报告。</div>
      ) : (
        <>
          <div className="drc-compare-head">
            <label className="drc-compare-picker">
              <span>对比目标</span>
              <select value={targetId} onChange={(event) => setTargetId(event.target.value)} disabled={loading}>
                {candidates.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
            {result && (
              <div className="drc-compare-summary">
                <span className="drc-compare-sum--added">新增 {result.summary.added}</span>
                <span className="drc-compare-sum--resolved">已解决 {result.summary.resolved}</span>
                <span className="drc-compare-sum--persistent">持续 {result.summary.persistent}</span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="drc-compare-empty">正在加载对比报告…</div>
          ) : error ? (
            <div className="drc-compare-empty">{error}</div>
          ) : result ? (
            <div className="drc-compare-list">
              {result.added.map((v) => <Row key={v.id} v={v} kind="added" />)}
              {result.resolved.map((v) => <Row key={v.id} v={v} kind="resolved" />)}
              {result.persistent.map((v) => <Row key={v.id} v={v} kind="persistent" />)}
            </div>
          ) : null}
        </>
      )}
    </BusinessDialog>
  );
}

function Row({ v, kind }: { v: DrcViolation; kind: keyof typeof KIND_LABELS }) {
  return (
    <div className={`drc-compare-row drc-compare-row--${kind}`}>
      <span className={`drc-compare-kind drc-compare-kind--${kind}`}>{KIND_LABELS[kind]}</span>
      <span className="drc-compare-rule">{v.rule}</span>
      <span className="drc-compare-meta">{v.layer ?? '-'}{v.net ? ` / ${v.net}` : ''}</span>
      <span className="drc-compare-desc" title={v.description}>{v.description || '-'}</span>
    </div>
  );
}
