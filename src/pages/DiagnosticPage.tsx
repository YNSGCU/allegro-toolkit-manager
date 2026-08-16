/**
 * ATM - 设计体检页面
 *
 * 对当前打开的板子运行一批只读检查，快速查看叠层 / 网络 / 器件 / DRC 概况。
 */
import React, { useCallback, useState } from 'react';
import { Activity } from 'lucide-react';
import type { BoardDiagnosticSnapshot } from '../types/diagnostic';
import GlobalStatusBar from '../components/GlobalStatusBar';
import ToastContainer, { useToast } from '../components/common/Toast';
import { formatUserError, PageState, WorkspaceHeader, WorkspacePage } from '../shared/ui';
import './diagnostic-page.css';

const DiagnosticPage: React.FC = () => {
  const { toasts, addToast, removeToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [snapshot, setSnapshot] = useState<BoardDiagnosticSnapshot | null>(null);

  const run = useCallback(async () => {
    setBusy(true);
    try {
      const res = await window.atm.runDiagnostic();
      if (res.success && res.data) {
        setSnapshot(res.data);
      } else {
        addToast('error', formatUserError(res.error, '体检失败'));
      }
    } catch (err) {
      addToast('error', formatUserError(err, '体检失败'));
    } finally {
      setBusy(false);
    }
  }, [addToast]);

  const statusItems = [
    { label: 'Bridge', value: snapshot?.connected ? '已连接' : '未连接', status: snapshot?.connected ? 'ok' as const : 'warning' as const },
    { label: '设计', value: snapshot?.designName ?? '-', status: 'muted' as const },
    { label: '单位', value: snapshot?.designUnits ?? '-', status: 'muted' as const },
  ];

  return (
    <WorkspacePage className="diagnostic-page">
      <WorkspaceHeader
        eyebrow="Vibe Bridge"
        title="设计体检"
        description="对当前打开的板子运行一批只读检查，快速查看叠层 / 网络 / 器件 / DRC 概况。"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => void run()} disabled={busy}>
            <Activity aria-hidden="true" /> {busy ? '体检中…' : '运行体检'}
          </button>
        }
      />
      <GlobalStatusBar items={statusItems} />

      {!snapshot ? (
        <PageState kind="empty" title="尚未体检" description="点击「运行体检」查看当前板子的健康概况。" />
      ) : snapshot.connected ? (
        <div className="diagnostic-body">
          <div className="diagnostic-cards">
            <MetricCard label="ETCH 叠层" value={snapshot.layerCount} />
            <MetricCard label="网络" value={snapshot.netCount} />
            <MetricCard label="器件" value={snapshot.componentCount} />
            <MetricCard label="DRC" value={snapshot.drcCount} danger={snapshot.drcCount > 0} />
          </div>

          <section className="diagnostic-panel">
            <h2 className="diagnostic-panel-title">ETCH 叠层（{snapshot.layerNames.length}）</h2>
            {snapshot.layerNames.length === 0 ? (
              <div className="diagnostic-empty">未读取到叠层信息</div>
            ) : (
              <div className="diagnostic-layer-list">
                {snapshot.layerNames.map((name, index) => (
                  <span key={name} className="diagnostic-layer-chip">
                    <span className="diagnostic-layer-index">{index + 1}</span>
                    {name}
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <PageState kind="empty" title="体检未完成" description={snapshot.message || '未连接到 Allegro 会话。'} />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </WorkspacePage>
  );
};

function MetricCard({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className={`diagnostic-metric${danger ? ' diagnostic-metric--danger' : ''}`}>
      <div className="diagnostic-metric-value">{value}</div>
      <div className="diagnostic-metric-label">{label}</div>
    </div>
  );
}

export default DiagnosticPage;
