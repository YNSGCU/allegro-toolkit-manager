/**
 * ATM - 跨版本方案同步对话框（V6.4，M2/M4）
 *
 * 三屏：① 选择源/目标环境与同步内容 ② 差异清单（默认决策 + 可修改 + 原因）
 * ③ 结果（目标环境新方案已保存，引导到方案页应用）。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CrossVersionSyncItem,
  CrossVersionSyncPlan,
  SyncItemDecision,
  SyncItemKind,
  SyncDecisionsInput,
} from '../../types/sync';
import BusinessDialog from '../../shared/ui/overlays/BusinessDialog';
import ToastContainer, { useToast } from '../common/Toast';
import { formatUserError } from '../../shared/ui';
import './sync-dialog.css';

interface SyncEnvironmentOption {
  id: string;
  name: string;
  version: string;
  pcbenvPath?: string;
  homePath?: string;
}

interface SyncDialogProps {
  open: boolean;
  onClose: () => void;
}

const DECISION_LABELS: Record<SyncItemDecision, string> = {
  sync: '同步',
  user_force: '强制同步',
  skip_ver: '跳过（版本特有）',
  skip_unknown: '跳过（未知命令）',
  keep_target: '保留（目标独有）',
};

const KIND_LABELS: Record<SyncItemKind, string> = {
  hotkey: '快捷键',
  skill: 'Skill',
  menu: '菜单',
};

export const SyncDialog: React.FC<SyncDialogProps> = ({ open, onClose }) => {
  const { toasts, addToast, removeToast } = useToast();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [environments, setEnvironments] = useState<SyncEnvironmentOption[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [kinds, setKinds] = useState<SyncItemKind[]>(['hotkey', 'skill', 'menu']);
  const [plan, setPlan] = useState<CrossVersionSyncPlan | null>(null);
  const [overrides, setOverrides] = useState<Map<string, SyncItemDecision>>(new Map());
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Array<{ kind: string; name: string }>>([]);

  const loadEnvironments = useCallback(async () => {
    try {
      const res = await window.atm.syncEnvironments();
      if (res.success && res.data) {
        setEnvironments(res.data);
        const list = res.data;
        if (list.length >= 2) {
          const preferredSource = list.find((item) => item.version.includes('17.4')) ?? list[0];
          const preferredTarget =
            list.find((item) => item.id !== preferredSource.id && item.version !== preferredSource.version) ??
            list.find((item) => item.id !== preferredSource.id) ??
            list[0];
          setSourceId(preferredSource.id);
          setTargetId(preferredTarget.id);
        } else if (list.length === 1) {
          setSourceId(list[0].id);
        }
      } else {
        addToast('error', res.error || '加载环境列表失败');
      }
    } catch (err) {
      addToast('error', formatUserError(err, '加载环境列表失败'));
    }
  }, [addToast]);

  useEffect(() => {
    if (open) {
      setStep(0);
      setPlan(null);
      setOverrides(new Map());
      setSaved([]);
      void loadEnvironments();
    }
  }, [open, loadEnvironments]);

  const source = useMemo(() => environments.find((item) => item.id === sourceId), [environments, sourceId]);
  const target = useMemo(() => environments.find((item) => item.id === targetId), [environments, targetId]);

  const toggleKind = (kind: SyncItemKind) => {
    setKinds((current) =>
      current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind],
    );
  };

  const handleBuildPlan = async () => {
    if (!sourceId || !targetId) {
      addToast('warning', '请选择源与目标环境');
      return;
    }
    if (kinds.length === 0) {
      addToast('warning', '请至少选择一种同步内容');
      return;
    }
    setBusy(true);
    try {
      const pairRes = await window.atm.syncCheckEnvPair(sourceId, targetId);
      if (!pairRes.success || !pairRes.data) throw new Error(pairRes.error || '环境校验失败');
      if (!pairRes.data.ok) {
        addToast('error', pairRes.data.issues.join('；'));
        return;
      }
      const res = await window.atm.syncBuildPlan({
        sourceEnvironmentId: sourceId,
        targetEnvironmentId: targetId,
        kinds,
      });
      if (!res.success || !res.data) throw new Error(res.error || '生成同步计划失败');
      setPlan(res.data);
      setOverrides(new Map());
      setStep(1);
    } catch (err) {
      addToast('error', formatUserError(err, '生成同步计划失败'));
    } finally {
      setBusy(false);
    }
  };

  const updateDecision = (item: CrossVersionSyncItem, decision: SyncItemDecision) => {
    setOverrides((current) => {
      const next = new Map(current);
      if (decision === item.decision) {
        next.delete(`${item.kind}:${item.ref}`);
      } else {
        next.set(`${item.kind}:${item.ref}`, decision);
      }
      return next;
    });
  };

  const collectDecisions = (): SyncDecisionsInput[] => {
    if (!plan || overrides.size === 0) return [];
    return plan.items
      .filter((item) => overrides.has(`${item.kind}:${item.ref}`))
      .map((item) => ({
        kind: item.kind,
        ref: item.ref,
        decision: overrides.get(`${item.kind}:${item.ref}`) ?? item.decision,
      }));
  };

  const handleApply = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      const res = await window.atm.syncApply({
        sourceEnvironmentId: plan.source.environmentId,
        targetEnvironmentId: plan.target.environmentId,
        kinds,
        decisions: collectDecisions(),
        nameSuffix: '（同步）',
      });
      if (!res.success || !res.data) throw new Error(res.error || '执行同步失败');
      setSaved(res.data.saved);
      setStep(2);
    } catch (err) {
      addToast('error', formatUserError(err, '执行同步失败'));
    } finally {
      setBusy(false);
    }
  };

  const groupedItems = useMemo(() => {
    if (!plan) return [];
    const order: SyncItemKind[] = ['hotkey', 'skill', 'menu'];
    return order.flatMap((kind) => plan.items.filter((item) => item.kind === kind));
  }, [plan]);

  const decisionIcon = (decision: SyncItemDecision): string => {
    switch (decision) {
      case 'sync': return '✓';
      case 'user_force': return '↗';
      case 'keep_target': return '◉';
      case 'skip_ver': return '⊘';
      case 'skip_unknown': return '?';
    }
  };

  return (
    <>
      <BusinessDialog
        open={open}
        title="跨版本同步"
        description={
          step === 0
            ? '选择源与目标环境，把方案的通用命令双向对齐、版本特有命令自动隔离'
            : step === 1
              ? `核对差异清单：「${source?.name ?? '源'}」→「${target?.name ?? '目标'}」`
              : '同步完成'
        }
        onClose={onClose}
        dismissDisabled={busy}
        footer={
          <>
            {step === 1 && (
              <button type="button" className="btn" onClick={() => setStep(0)} disabled={busy}>
                返回
              </button>
            )}
            {step === 0 ? (
              <button type="button" className="btn btn-primary" onClick={() => void handleBuildPlan()} disabled={busy}>
                {busy ? '校验并生成清单…' : '生成差异清单'}
              </button>
            ) : step === 1 ? (
              <button type="button" className="btn btn-primary" onClick={() => void handleApply()} disabled={busy || !plan}>
                {busy ? '同步中…' : '同步到目标环境'}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={onClose}>
                完成
              </button>
            )}
            {step !== 2 && (
              <button type="button" className="btn" onClick={onClose} disabled={busy}>
                取消
              </button>
            )}
          </>
        }
      >
        {step === 0 && (
          <div className="sync-config">
            <label className="sync-field">
              <span>源环境（要复制哪个版本的方案）</span>
              <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
                {environments.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}（{item.version}）</option>
                ))}
              </select>
            </label>
            <label className="sync-field">
              <span>目标环境（同步到哪个版本）</span>
              <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
                {environments.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}（{item.version}）</option>
                ))}
              </select>
            </label>
            <div className="sync-kinds">
              <span className="sync-kinds-label">同步内容</span>
              {(['hotkey', 'skill', 'menu'] as SyncItemKind[]).map((kind) => (
                <label key={kind} className="sync-kind-check">
                  <input
                    type="checkbox"
                    checked={kinds.includes(kind)}
                    onChange={() => toggleKind(kind)}
                  />
                  <span>{KIND_LABELS[kind]}</span>
                </label>
              ))}
            </div>
            <p className="sync-note">
              同步会为目标环境生成新的「（同步）」方案，不覆盖现有方案；
              版本特有的命令默认跳过并列出原因，可在差异清单中手动调整。
            </p>
          </div>
        )}

        {step === 1 && plan && (
          <div className="sync-plan">
            <p className="sync-plan-summary">
              待同步 {plan.stats.sync + plan.stats.user_force} 项 · 版本特有跳过 {plan.stats.skip_ver} 项 ·
              未知 {plan.stats.skip_unknown} 项 · 目标独有保留 {plan.stats.keep_target} 项
            </p>
            {plan.notes && plan.notes.length > 0 && (
              <div className="sync-plan-notes">
                {plan.notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            )}
            <ul className="sync-plan-list">
              {groupedItems.map((item, index) => {
                const effective = overrides.get(`${item.kind}:${item.ref}`) ?? item.decision;
                const options: SyncItemDecision[] =
                  item.decision === 'keep_target'
                    ? ['keep_target']
                    : ['sync', 'user_force', 'skip_ver', 'skip_unknown'];
                return (
                  <li key={`${item.kind}:${item.ref}-${index}`} className={`sync-plan-item is-${effective}`}>
                    <span className="sync-plan-kind">{KIND_LABELS[item.kind]}</span>
                    <span className="sync-plan-ref">{item.ref}</span>
                    {item.command ? <code className="sync-plan-command">{item.command}</code> : null}
                    <select
                      aria-label={`决策 ${item.ref}`}
                      value={effective}
                      onChange={(event) => updateDecision(item, event.target.value as SyncItemDecision)}
                      disabled={item.decision === 'keep_target' || busy}
                    >
                      {options.map((option) => (
                        <option key={option} value={option}>
                          {DECISION_LABELS[option]}
                        </option>
                      ))}
                    </select>
                    <span className="sync-plan-icon">{decisionIcon(effective)}</span>
                    {item.reason ? <span className="sync-plan-reason">{item.reason}</span> : null}
                    {item.askConfirm ? <span className="sync-plan-ask">需确认</span> : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {step === 2 && (
          <div className="sync-result">
            <p className="sync-result-title">已完成，目标环境新增以下方案：</p>
            <ul className="sync-result-list">
              {saved.map((item) => (
                <li key={`${item.kind}-${item.name}`}>{`${KIND_LABELS[item.kind as SyncItemKind] ?? item.kind}：「${item.name}」`}</li>
              ))}
            </ul>
            <p className="sync-result-note">
              新方案已保存但尚未写入配置文件。请到对应页面或工作区绑定新方案后，
              按 Skill → 菜单 → 快捷键顺序「应用此方案」，写入仍走 Apply Plan 确认与备份回滚。
            </p>
          </div>
        )}
      </BusinessDialog>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
};

export default SyncDialog;
