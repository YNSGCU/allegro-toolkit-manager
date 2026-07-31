/**
 * ATM - 运行版本信息面板（V5.4）
 *
 * 显示 main/preload/renderer 三层版本信息，用于版本一致性诊断。
 * 如果 IPC handler 缺失，显示明确的中文提示和重建建议。
 */
import React, { useEffect, useState } from 'react';
import type { RuntimeInfo, VersionCheckResult } from '../../types/runtime';
import ErrorPanel from './ErrorPanel';

interface VersionInfoPanelProps {
  /** 是否默认展开 */
  defaultExpanded?: boolean;
}

const VersionInfoPanel: React.FC<VersionInfoPanelProps> = ({ defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [versionCheck, setVersionCheck] = useState<VersionCheckResult | null>(null);

  useEffect(() => {
    loadRuntimeInfo();
  }, []);

  const loadRuntimeInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.atm.getRuntimeInfo();
      if (result.success && result.data) {
        setRuntimeInfo(result.data);
        checkVersionConsistency(result.data);
      } else {
        setError(result.error || '获取版本信息失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const checkVersionConsistency = (info: RuntimeInfo) => {
    const missingHandlers = info.registeredIpcHandlers
      .filter((h) => !h.registered)
      .map((h) => h.channel);

    const warnings: string[] = [];
    if (missingHandlers.length > 0) {
      warnings.push(
        '检测到 ' + missingHandlers.length + ' 个 IPC handler 未注册。' +
        '这表明当前运行的 Electron 主进程可能是旧版本构建。' +
        '请执行 npm run build:electron 重新构建，然后重启 Electron 应用。'
      );
    }

    const rendererBuildTime = (window as any).__ATM_RENDERER_BUILD_TIME__;
    setVersionCheck({
      consistent: missingHandlers.length === 0,
      mainBuildTime: info.mainBuildTime,
      preloadBuildTime: info.preloadBuildTime,
      rendererBuildTime: rendererBuildTime || '未知',
      missingHandlers,
      warnings,
    });
  };

  const formatTime = (iso: string) => {
    if (!iso) return '未知';
    try {
      const d = new Date(iso);
      return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    } catch {
      return iso;
    }
  };

  const unregisteredCount = runtimeInfo
    ? runtimeInfo.registeredIpcHandlers.filter((h) => !h.registered).length
    : 0;

  const btnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    fontSize: 16,
    padding: '0 4px',
  };

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div
        className="card-header"
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onClick={() => setExpanded(!expanded)}
      >
        <span>{(String.fromCharCode(0x1f504))} 运行版本信息</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          {loading ? '加载中...' : (
            <>
              {unregisteredCount > 0
                ? (String.fromCharCode(0x26a0)) + ' ' + unregisteredCount + ' 个 handler 缺失'
                : (String.fromCharCode(0x2705)) + ' 版本一致'}
              <span style={{ marginLeft: 8 }}>{expanded ? (String.fromCharCode(0x25b2)) : (String.fromCharCode(0x25bc))}</span>
            </>
          )}
        </span>
      </div>

      {expanded && (
        <div style={{ padding: '12px 0' }}>
          {loading && <div className="loading" style={{ padding: 20 }}>正在获取版本信息...</div>}

          {error && (
            <ErrorPanel
              title="获取版本信息失败"
              message={error}
              suggestion="请确认 Electron 主进程已正确启动。如果是开发模式，请运行 npm run build:electron 重新构建。"
              onRetry={loadRuntimeInfo}
            />
          )}

          {versionCheck && !versionCheck.consistent && (
            <div
              style={{
                background: '#3a1a1a',
                border: '1px solid #e74c3c',
                borderRadius: 6,
                padding: 10,
                marginBottom: 12,
              }}
            >
              <div style={{ color: '#e88', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                {(String.fromCharCode(0x26a0))} 版本不一致 - 当前 Electron 主进程可能过旧
              </div>
              <div style={{ color: '#ccc', fontSize: 12, lineHeight: 1.5 }}>
                <p>
                  检测到以下 IPC 处理器未注册，这说明当前运行的 Electron 主进程(
                  {formatTime(versionCheck.mainBuildTime)})
                  版本与前端代码不一致。
                </p>
                <ul style={{ margin: '6px 0', paddingLeft: 20 }}>
                  {versionCheck.missingHandlers.slice(0, 10).map((h) => (
                    <li key={h} style={{ color: '#e88', fontSize: 12 }}>{h}</li>
                  ))}
                  {versionCheck.missingHandlers.length > 10 && (
                    <li style={{ color: '#888', fontSize: 12 }}>
                      ...还有其他 {versionCheck.missingHandlers.length - 10} 个
                    </li>
                  )}
                </ul>
                <p style={{ color: '#da7', marginTop: 6 }}>
                  {'💡 解决方案：'}<br />
                  {'1. 在终端中执行 npm run build:electron'}<br />
                  {'2. 重启 Electron 应用'}<br />
                  {'3. 如果问题依旧，执行完整构建 npm run build'}
                </p>
              </div>
            </div>
          )}

          {runtimeInfo && (
            <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.6 }}>
              <div className="version-grid" style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '4px 12px' }}>
                <span style={{ color: '#888' }}>{(String.fromCharCode(0x5e94, 0x7528, 0x7248, 0x672c))}</span>
                <span>{runtimeInfo.appVersion}</span>

                <span style={{ color: '#888' }}>Node.js 版本</span>
                <span>{runtimeInfo.nodeVersion}</span>

                <span style={{ color: '#888' }}>Electron 版本</span>
                <span>{runtimeInfo.electronVersion}</span>

                <span style={{ color: '#888' }}>平台</span>
                <span>{runtimeInfo.platform}</span>

                <span style={{ color: '#888' }}>Main 启动时间</span>
                <span>{formatTime(runtimeInfo.mainBuildTime)}</span>

                <span style={{ color: '#888' }}>Preload API 版本</span>
                <span>{runtimeInfo.preloadApiVersion || '未知'}</span>

                <span style={{ color: '#888' }}>Handler 状态</span>
                <span>
                  <span style={{ color: unregisteredCount > 0 ? '#e88' : '#8e8' }}>
                    {runtimeInfo.registeredIpcHandlers.filter((h) => h.registered).length}/
                    {runtimeInfo.registeredIpcHandlers.length} 已注册
                  </span>
                  {unregisteredCount > 0 && (
                    <span style={{ color: '#e88', marginLeft: 8 }}>
                      ({unregisteredCount} 个缺失)
                    </span>
                  )}
                </span>
              </div>

              {unregisteredCount > 0 && (
                <div style={{ marginTop: 12 }}>
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: 'pointer', color: '#888', fontSize: 12 }}>
                      显示所有 {runtimeInfo.registeredIpcHandlers.length} 个 Handler
                    </summary>
                    <div
                      style={{
                        maxHeight: 300,
                        overflow: 'auto',
                        marginTop: 8,
                        background: '#111',
                        borderRadius: 4,
                        padding: 8,
                      }}
                    >
                      {runtimeInfo.registeredIpcHandlers.map((h) => (
                        <div
                          key={h.channel}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '2px 0',
                            fontSize: 11,
                          }}
                        >
                          <span>{h.registered ? (String.fromCharCode(0x2705)) : (String.fromCharCode(0x274c))}</span>
                          <span style={{ color: h.registered ? '#8e8' : '#e88' }}>
                            {h.channel}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VersionInfoPanel;
