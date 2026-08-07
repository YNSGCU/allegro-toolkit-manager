/** Main / preload / renderer 运行版本诊断。 */
import React, { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, RefreshCw } from 'lucide-react';
import type { RuntimeInfo, VersionCheckResult } from '../../types/runtime';
import ApplicationUpdatePanel from './ApplicationUpdatePanel';

interface VersionInfoPanelProps {
  defaultExpanded?: boolean;
}

const VersionInfoPanel: React.FC<VersionInfoPanelProps> = ({ defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [versionCheck, setVersionCheck] = useState<VersionCheckResult | null>(null);

  const checkVersionConsistency = (info: RuntimeInfo) => {
    const missingHandlers = info.registeredIpcHandlers.filter((handler) => !handler.registered).map((handler) => handler.channel);
    setVersionCheck({
      consistent: missingHandlers.length === 0,
      mainBuildTime: info.mainBuildTime,
      preloadBuildTime: info.preloadBuildTime,
      rendererBuildTime: (window as typeof window & { __ATM_RENDERER_BUILD_TIME__?: string }).__ATM_RENDERER_BUILD_TIME__ || '未知',
      missingHandlers,
      warnings: missingHandlers.length
        ? [`检测到 ${missingHandlers.length} 个 IPC handler 未注册，请重新构建 Electron 主进程后重启应用。`]
        : [],
    });
  };

  const loadRuntimeInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      if (typeof window.atm === 'undefined') throw new Error('未连接到 Electron 主进程。');
      const result = await window.atm.getRuntimeInfo();
      if (!result.success || !result.data) throw new Error(result.error || '获取版本信息失败');
      setRuntimeInfo(result.data);
      checkVersionConsistency(result.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRuntimeInfo();
  }, []);

  const formatTime = (iso: string) => {
    if (!iso) return '未知';
    try {
      return new Date(iso).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    } catch {
      return iso;
    }
  };

  const unregisteredCount = runtimeInfo?.registeredIpcHandlers.filter((handler) => !handler.registered).length ?? 0;
  const StatusIcon = error ? AlertCircle : unregisteredCount > 0 ? AlertTriangle : CheckCircle2;
  const statusLabel = loading ? '加载中…' : error ? '读取失败' : unregisteredCount > 0 ? `${unregisteredCount} 个 handler 缺失` : '版本一致';

  return (
    <div className="ui-runtime-stack">
      <ApplicationUpdatePanel />
    <section className="ui-runtime-panel" aria-label="运行版本信息">
      <button
        type="button"
        className="ui-runtime-trigger"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
      >
        <span className="ui-runtime-title">运行版本信息</span>
        <span className={`ui-runtime-status ui-runtime-status--${error ? 'error' : unregisteredCount > 0 ? 'warning' : 'ok'}`}>
          <StatusIcon aria-hidden="true" />
          {statusLabel}
          <ChevronDown className={expanded ? 'is-expanded' : ''} aria-hidden="true" />
        </span>
      </button>

      {expanded ? (
        <div className="ui-runtime-content">
          {loading ? <p className="ui-runtime-note">正在读取 Main、Preload 与 IPC 注册状态…</p> : null}
          {error ? (
            <div className="ui-runtime-error" role="alert">
              <AlertCircle aria-hidden="true" />
              <div><strong>获取版本信息失败</strong><p>{error}</p></div>
              <button className="btn btn-sm" onClick={() => void loadRuntimeInfo()}><RefreshCw aria-hidden="true" />重试</button>
            </div>
          ) : null}

          {versionCheck && !versionCheck.consistent ? (
            <div className="ui-runtime-warning">
              <AlertTriangle aria-hidden="true" />
              <div>
                <strong>Electron 主进程与前端版本不一致</strong>
                <p>请执行 <code>npm run build:electron</code>，重启应用；若仍未恢复，再执行完整构建。</p>
              </div>
            </div>
          ) : null}

          {runtimeInfo ? (
            <>
              <dl className="ui-runtime-grid">
                <div><dt>应用版本</dt><dd>{runtimeInfo.appVersion}</dd></div>
                <div><dt>Node.js</dt><dd>{runtimeInfo.nodeVersion}</dd></div>
                <div><dt>Electron</dt><dd>{runtimeInfo.electronVersion}</dd></div>
                <div><dt>平台</dt><dd>{runtimeInfo.platform}</dd></div>
                <div><dt>Main 启动时间</dt><dd>{formatTime(runtimeInfo.mainBuildTime)}</dd></div>
                <div><dt>Preload API</dt><dd>{runtimeInfo.preloadApiVersion || '未知'}</dd></div>
                <div><dt>IPC Handler</dt><dd>{runtimeInfo.registeredIpcHandlers.length - unregisteredCount}/{runtimeInfo.registeredIpcHandlers.length} 已注册</dd></div>
              </dl>
              {unregisteredCount > 0 ? (
                <details className="ui-runtime-handlers">
                  <summary>查看 Handler 明细</summary>
                  <div>
                    {runtimeInfo.registeredIpcHandlers.map((handler) => (
                      <span key={handler.channel} className={handler.registered ? 'is-ok' : 'is-missing'}>
                        {handler.channel}<small>{handler.registered ? '已注册' : '缺失'}</small>
                      </span>
                    ))}
                  </div>
                </details>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </section>
    </div>
  );
};

export default VersionInfoPanel;
