/**
 * ATM - Symphony 协同模式兼容检查弹窗（V5.7）
 *
 * 展示 Symphony 兼容体检结果：
 *   - 命令登记状态（symphony_skill.txt）
 *   - 未支持（U 类）AXL 函数调用
 *   - ATM 菜单触发器状态
 * 并允许选择 rw（读写）命令后生成登记 Apply Plan。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileCog,
  Info,
  RefreshCw,
} from 'lucide-react';
import type { SkillApplyPlan } from '../types/skill';
import type {
  AxlCallUsage,
  SymphonyCompatibilityIssue,
  SymphonyCompatibilityResult,
} from '../types/symphony';
import { BusinessDialog } from '../shared/ui';
import './symphony-dialog.css';

interface SymphonyDialogProps {
  open: boolean;
  onClose: () => void;
  onPlanReady: (plan: SkillApplyPlan) => void;
}

/** IPC 调用超时时间，避免主进程繁忙/无响应时弹窗永久卡住 */
const IPC_TIMEOUT_MS = 15000;

/** 给 Promise 加超时，超时后按错误处理 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label}超时（${Math.round(ms / 1000)} 秒），请重试或检查主进程状态`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

const severityLabels: Record<string, string> = {
  error: '错误',
  warning: '警告',
  info: '提示',
};

const issueIcons: Record<string, React.ReactNode> = {
  error: <AlertCircle size={14} aria-hidden="true" />,
  warning: <AlertTriangle size={14} aria-hidden="true" />,
  info: <Info size={14} aria-hidden="true" />,
};

const SymphonyDialog: React.FC<SymphonyDialogProps> = ({ open, onClose, onPlanReady }) => {
  const [result, setResult] = useState<SymphonyCompatibilityResult | null>(null);
  const [tableInfo, setTableInfo] = useState<{ version: string; size: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rwSelected, setRwSelected] = useState<Set<string>>(new Set());
  const [syncSite, setSyncSite] = useState(false);
  const [showUnregisteredOnly, setShowUnregisteredOnly] = useState(true);
  const [showUnsupportedOnly, setShowUnsupportedOnly] = useState(true);
  /** 弹窗已关闭标识：关闭后忽略仍在途的 IPC 回调，避免误触 ApplyPlan 弹窗 */
  const cancelledRef = useRef(false);

  const runCheck = useCallback(async () => {
    cancelledRef.current = false;
    setLoading(true);
    setError(null);
    try {
      const checkRes = await withTimeout(
        window.atm.symphonyCheck(),
        IPC_TIMEOUT_MS,
        'Symphony 兼容体检',
      );
      if (cancelledRef.current) return;
      if (!checkRes.success) {
        setError(checkRes.error || 'Symphony 兼容体检失败');
        return;
      }
      const checked = checkRes.data as SymphonyCompatibilityResult;
      setResult(checked);
      // 默认 rw 勾选：当前已登记为 rw 的命令
      const defaultRw = (checked.commandStatuses || [])
        .filter((c) => c.registered && c.rw)
        .map((c) => c.commandName);
      setRwSelected(new Set(defaultRw));

      // 支持表只是展示信息，单独加载：失败或超时不阻塞体检结果与登记按钮。
      try {
        const tableRes = await withTimeout(
          window.atm.symphonyTableInfo(),
          8000,
          '读取支持表',
        );
        if (!cancelledRef.current && tableRes.success && tableRes.data) {
          setTableInfo(tableRes.data);
        }
      } catch (err) {
        if (!cancelledRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      cancelledRef.current = false;
      runCheck();
    }
  }, [open, runCheck]);

  const handleClose = useCallback(() => {
    cancelledRef.current = true;
    onClose();
  }, [onClose]);

  const toggleRw = (commandName: string) => {
    setRwSelected((prev) => {
      const next = new Set(prev);
      if (next.has(commandName)) next.delete(commandName);
      else next.add(commandName);
      return next;
    });
  };

  const handleGenerate = async () => {
    if (!result) return;
    cancelledRef.current = false;
    setGenerating(true);
    setError(null);
    try {
      const res = await withTimeout(
        window.atm.symphonyGeneratePlan(
          JSON.stringify({
            rwCommandNames: [...rwSelected],
            syncSite,
          }),
        ),
        20000,
        '生成登记计划',
      );
      if (cancelledRef.current) return;
      if (res.success && res.data) {
        onPlanReady(res.data as SkillApplyPlan);
      } else {
        setError(res.error || '生成登记计划失败');
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (!cancelledRef.current) setGenerating(false);
    }
  };

  const visibleCommands = result?.commandStatuses.filter(
    (c) => !showUnregisteredOnly || !c.registered,
  ) || [];

  const visibleUnsupported = result?.unsupportedCalls.filter(
    (c) => showUnsupportedOnly && c.category === 'U',
  ) || result?.unsupportedCalls || [];

  const issuesBySeverity = (severity: string) =>
    result?.issues.filter((i) => i.severity === severity) || [];

  return (
    <BusinessDialog
      title="Symphony 协同模式兼容检查"
      description="Symphony（Team Design）下 SKILL 命令默认全部禁用，需登记到 symphony_skill.txt 才能运行。检查命令登记、未支持函数与菜单恢复能力。"
      size="lg"
      onClose={handleClose}
      dismissDisabled={false}
      footer={(
        <>
          <button type="button" className="btn" onClick={handleClose}>
            关闭
          </button>
          <button
            type="button"
            className="btn"
            onClick={runCheck}
            disabled={loading || generating}
          >
            <RefreshCw size={14} aria-hidden="true" /> 重新检查
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={loading || generating || !result}
          >
            <FileCog size={14} aria-hidden="true" />
            {generating ? '正在生成计划…' : '生成登记计划'}
          </button>
        </>
      )}
    >
      <div className="ui-dialog-form">
        {loading ? (
          <div className="ui-dialog-alert ui-dialog-alert--info" role="status">
            正在扫描 Skill 与 Symphony 配置…
          </div>
        ) : null}

        {error ? (
          <div className="ui-dialog-alert ui-dialog-alert--danger" role="alert">
            {error}
          </div>
        ) : null}

        {result && !loading ? (
          <>
            {/* 统计条 */}
            <section className="ui-dialog-stack" aria-label="Symphony 体检统计">
              <div className="symphony-stats">
                <div className="symphony-stat">
                  <span className="symphony-stat-value">{result.stats.totalCommands}</span>
                  <span className="symphony-stat-label">入口命令</span>
                </div>
                <div className="symphony-stat">
                  <span className="symphony-stat-value">{result.stats.registeredCommands}</span>
                  <span className="symphony-stat-label">已登记</span>
                </div>
                <div className="symphony-stat symphony-stat--warn">
                  <span className="symphony-stat-value">{result.stats.unregisteredCommands}</span>
                  <span className="symphony-stat-label">未登记</span>
                </div>
                <div className="symphony-stat">
                  <span className="symphony-stat-value">{result.stats.rwCommands}</span>
                  <span className="symphony-stat-label">rw 命令</span>
                </div>
                <div className="symphony-stat symphony-stat--danger">
                  <span className="symphony-stat-value">{result.stats.unsupportedAxCalls}</span>
                  <span className="symphony-stat-label">U 类函数</span>
                </div>
              </div>
              <div className="ui-dialog-note">
                支持表：{tableInfo ? `Cadence ${tableInfo.version} · ${tableInfo.size} 个 AXL 函数` : '…'} ·
                symphony_skill.txt：{result.symphonyFile.exists ? `${result.symphonyFile.commandCount} 条命令（rw ${result.symphonyFile.rwCount}）` : '不存在'}
                {result.symphonyFile.path ? ` · ${result.symphonyFile.path}` : ''}
              </div>
            </section>

            {/* 命令登记列表 */}
            <section className="ui-dialog-stack" aria-label="命令登记">
              <div className="symphony-section-head">
                <h3 className="ui-dialog-section-title">命令登记</h3>
                <label className="symphony-toggle-label">
                  <input
                    type="checkbox"
                    checked={showUnregisteredOnly}
                    onChange={(e) => setShowUnregisteredOnly(e.target.checked)}
                  />
                  仅显示未登记
                </label>
              </div>
              {visibleCommands.length === 0 ? (
                <div className="ui-dialog-note">全部入口命令已登记。</div>
              ) : (
                <div className="symphony-command-list">
                  {visibleCommands.map((cmd) => (
                    <div className="symphony-command-row" key={`${cmd.skillId}-${cmd.commandName}`}>
                      <code className="symphony-command-name">{cmd.commandName}</code>
                      <span className="symphony-command-skill">{cmd.skillName}</span>
                      <span className={`symphony-badge ${cmd.registered ? 'is-ok' : 'is-warn'}`}>
                        {cmd.registered ? '已登记' : '未登记'}
                      </span>
                      <label className="symphony-rw-toggle">
                        <input
                          type="checkbox"
                          checked={rwSelected.has(cmd.commandName)}
                          onChange={() => toggleRw(cmd.commandName)}
                          title="勾选后登记为 rw（读写）：数据库变更会广播到 Symphony 服务器"
                        />
                        rw
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 未支持函数 */}
            <section className="ui-dialog-stack" aria-label="未支持函数">
              <div className="symphony-section-head">
                <h3 className="ui-dialog-section-title">未支持 AXL 函数</h3>
                <label className="symphony-toggle-label">
                  <input
                    type="checkbox"
                    checked={showUnsupportedOnly}
                    onChange={(e) => setShowUnsupportedOnly(e.target.checked)}
                  />
                  仅显示 U 类
                </label>
              </div>
              {visibleUnsupported.length === 0 ? (
                <div className="ui-dialog-note">未检测到 U 类（不支持）AXL 函数调用。</div>
              ) : (
                <div className="symphony-command-list">
                  {visibleUnsupported.map((call: AxlCallUsage, idx) => (
                    <div className="symphony-command-row" key={`${call.functionName}-${idx}`}>
                      <code className="symphony-command-name">{call.functionName}</code>
                      <span className="symphony-command-skill">{call.skillName}</span>
                      <span className="symphony-badge is-danger">U</span>
                      <small className="symphony-source-line">
                        {call.sourceFile}:{call.lineNumber}
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 问题列表 */}
            {result.issues.length > 0 ? (
              <section className="ui-dialog-stack" aria-label="体检问题">
                <h3 className="ui-dialog-section-title">体检问题（{result.issues.length}）</h3>
                {(['error', 'warning', 'info'] as const).map((severity) => {
                  const issues = issuesBySeverity(severity);
                  if (issues.length === 0) return null;
                  return (
                    <div key={severity} className="symphony-issue-group">
                      <h4 className={`symphony-issue-group-title is-${severity}`}>
                        {issueIcons[severity]} {severityLabels[severity]}（{issues.length}）
                      </h4>
                      {issues.map((issue: SymphonyCompatibilityIssue) => (
                        <div
                          className={`symphony-issue-row is-${severity}`}
                          key={issue.id}
                        >
                          <strong>{issue.title}</strong>
                          <span>{issue.description}</span>
                          {issue.suggestedActions.length > 0 ? (
                            <ul className="symphony-suggestions">
                              {issue.suggestedActions.map((action) => (
                                <li key={action}>{action}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </section>
            ) : (
              <div className="ui-dialog-alert ui-dialog-alert--ok" role="status">
                <CheckCircle2 size={14} aria-hidden="true" /> 体检通过：命令登记完整，未发现不支持的函数。
              </div>
            )}

            {/* 生成选项 */}
            <section className="ui-dialog-stack" aria-label="生成选项">
              <label className="symphony-toggle-label symphony-toggle-label--block">
                <input
                  type="checkbox"
                  checked={syncSite}
                  onChange={(e) => setSyncSite(e.target.checked)}
                />
                同时同步到站点级 CDS_SITE/PCB（全公司共享，需管理员权限）
              </label>
              <div className="ui-dialog-note">
                勾选 rw 表示允许该命令的数据库更新广播到 Symphony 服务器；未勾选的命令按只读登记，
                其数据库变更不会被发送（可能造成本地与服务器失步）。仅对确认在 Symphony 下工作的写命令勾选 rw。
              </div>
            </section>
          </>
        ) : null}
      </div>
    </BusinessDialog>
  );
};

export default SymphonyDialog;
