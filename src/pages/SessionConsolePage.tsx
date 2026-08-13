/**
 * ATM - Allegro 会话控制台页面
 *
 * 查看当前 Allegro 会话快照（版本 / 程序 / 设计 / 单位），
 * 执行 SKILL 命令并保留输出历史。写命令需二次确认。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Play, RefreshCw, Terminal } from 'lucide-react';
import type { SessionCommandResult, SessionCommandRisk, SessionSnapshot } from '../types/session';
import GlobalStatusBar from '../components/GlobalStatusBar';
import ConfirmDialog from '../components/common/ConfirmDialog';
import ToastContainer, { useToast } from '../components/common/Toast';
import { formatUserError, PageState, WorkspaceHeader, WorkspacePage } from '../shared/ui';
import './session-console-page.css';

/** 预置只读快捷命令（点击即执行，无需手敲 SKILL） */
const PRESET_COMMANDS: Array<{ label: string; code: string }> = [
  { label: '版本信息', code: "list(axlVersion('fullVersion) axlVersion('programName))" },
  { label: '当前设计', code: 'axlCurrentDesign()' },
  { label: '设计单位', code: 'axlDBGetDesignUnits()' },
  { label: 'DRC 数量', code: 'length(axlDBGetDesign()->drcs)' },
];

// 与 core/session/sessionCommand.ts 的 WRITE_APIS 保持同步（仅用于执行前二次确认提示）
const WRITE_KEYWORDS = [
  'axlDBChangeDesign', 'axlDBDeleteObject', 'axlDeleteObject', 'axlAddSimpleMove',
  'axlDBAddProp', 'axlDBChangeProp', 'axlDBDeleteProp', 'axlDBDefineAlias',
  'axlDBAddPin', 'axlDBCreateSymbol', 'axlDBPadstackChange', 'outfile', 'write(',
  'axlUIWPrint', 'axlDBSet', 'axlShell',
];

function detectWriteRisk(code: string): SessionCommandRisk {
  const normalized = code.toLowerCase();
  return WRITE_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase())) ? 'write' : 'readonly';
}

interface HistoryItem {
  id: string;
  code: string;
  result: SessionCommandResult & { risk: SessionCommandRisk };
}

const SessionConsolePage: React.FC = () => {
  const { toasts, addToast, removeToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [pendingWrite, setPendingWrite] = useState<string | null>(null);

  const probe = useCallback(async () => {
    setLoading(true);
    try {
      if (typeof window.atm === 'undefined') {
        throw new Error('未连接到 Electron 主进程，请在 ATM 桌面应用中打开。');
      }
      const result = await window.atm.sessionProbe();
      if (!result.success || !result.data) {
        setSnapshot({ connected: false, message: formatUserError(result.error, '探测会话失败') });
        return;
      }
      setSnapshot(result.data);
    } catch (err) {
      setSnapshot({ connected: false, message: formatUserError(err, '探测会话失败') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void probe();
  }, [probe]);

  const runCommand = useCallback(async (command: string) => {
    setBusy(true);
    try {
      const result = await window.atm.sessionCommand(command);
      if (!result.success || !result.data) {
        addToast('error', formatUserError(result.error, '执行命令失败'));
        return;
      }
      setHistory((prev) => [
        { id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, code: command, result: result.data! },
        ...prev,
      ].slice(0, 50));
    } catch (err) {
      addToast('error', formatUserError(err, '执行命令失败'));
    } finally {
      setBusy(false);
    }
  }, [addToast]);

  const handleRun = () => {
    const command = code.trim();
    if (!command) return;
    if (detectWriteRisk(command) === 'write') {
      setPendingWrite(command);
      return;
    }
    void runCommand(command);
    setCode('');
  };

  const statusItems = [
    {
      label: 'Bridge',
      value: snapshot?.connected ? '已连接' : '未连接',
      status: snapshot?.connected ? 'ok' as const : 'warning' as const,
      tooltip: snapshot?.message,
    },
    { label: '版本', value: snapshot?.fullVersion ?? '-', status: 'muted' as const },
    { label: '程序', value: snapshot?.programName ?? '-', status: 'muted' as const },
    { label: '设计', value: snapshot?.designName ?? '未打开', status: snapshot?.designName ? 'ok' as const : 'muted' as const },
    { label: '单位', value: snapshot?.designUnits ?? '-', status: 'muted' as const },
  ];

  return (
    <WorkspacePage className="session-console-page">
      <WorkspaceHeader
        eyebrow="Vibe Bridge"
        title="会话控制台"
        description="查看当前 Allegro 会话状态，执行 SKILL 命令并查看输出。"
        actions={
          <button type="button" className="btn" onClick={() => void probe()} disabled={busy || loading}>
            <RefreshCw aria-hidden="true" /> 刷新快照
          </button>
        }
      />
      <GlobalStatusBar items={statusItems} />

      {loading ? (
        <PageState kind="loading" title="正在探测会话" />
      ) : (
        <div className="session-console-grid">
          <section className="session-panel">
            <h2 className="session-panel-title">
              <Terminal aria-hidden="true" /> SKILL 命令
            </h2>
            <textarea
              className="session-input"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="例如：list(axlVersion('fullVersion) axlCurrentDesign())"
              rows={6}
              spellCheck={false}
            />
            <div className="session-presets">
              {PRESET_COMMANDS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="session-preset"
                  onClick={() => {
                    setCode(preset.code);
                    void runCommand(preset.code);
                  }}
                  disabled={busy}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="session-command-actions">
              <span className="session-command-hint">
                {detectWriteRisk(code) === 'write' ? '检测到可能修改设计的命令，执行前会二次确认。' : '只读命令，直接执行。'}
              </span>
              <button type="button" className="btn btn-primary" onClick={handleRun} disabled={busy || !code.trim()}>
                <Play aria-hidden="true" /> {busy ? '执行中…' : '执行'}
              </button>
            </div>
          </section>

          <section className="session-panel">
            <h2 className="session-panel-title">输出历史</h2>
            {history.length === 0 ? (
              <div className="session-history-empty">还没有执行过命令</div>
            ) : (
              <div className="session-history">
                {history.map((item) => (
                  <div key={item.id} className={`session-history-item session-history-item--${item.result.success ? 'ok' : 'error'}`}>
                    <div className="session-history-code">$ {item.code}</div>
                    <pre className="session-history-output">
                      {item.result.success ? item.result.output || '(无输出)' : item.result.error}
                    </pre>
                    <div className="session-history-meta">
                      <span className={`session-risk session-risk--${item.result.risk}`}>
                        {item.result.risk === 'write' ? '写命令' : '只读'}
                      </span>
                      <span>{item.result.durationMs} ms</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <ConfirmDialog
        open={pendingWrite !== null}
        title="确认执行写命令"
        message="该命令可能修改当前设计数据库，确定要执行吗？"
        detail={pendingWrite ?? ''}
        confirmLabel="执行"
        variant="danger"
        onConfirm={() => {
          if (pendingWrite) {
            void runCommand(pendingWrite);
            setCode('');
          }
          setPendingWrite(null);
        }}
        onCancel={() => setPendingWrite(null)}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </WorkspacePage>
  );
};

export default SessionConsolePage;
