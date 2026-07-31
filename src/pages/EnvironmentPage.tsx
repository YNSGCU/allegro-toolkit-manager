/**
 * ATM - 环境检测页面
 */
import React, { useEffect, useState } from 'react';
import type { EnvironmentInfo } from '../types/environment';
import MinimalSurface from '../components/MinimalSurface';
import FileStatusCard from '../components/FileStatusCard';
import { getPageSurface } from '../config/pageSurfaces';

/** Windows 环境变量键值对 */
type EnvVarMap = Record<string, string | null>;

interface EnvVarResult {
  success: boolean;
  data?: EnvVarMap;
  error?: string;
}

const EnvironmentPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [envInfo, setEnvInfo] = useState<EnvironmentInfo | null>(null);
  const [envVars, setEnvVars] = useState<EnvVarMap>({});
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  useEffect(() => {
    loadEnvironment();
  }, []);

  const loadEnvironment = async (manualPath?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.atm.locateEnvironment(manualPath);
      if (result.success && result.data) {
        setEnvInfo(result.data);
        if (result.data.warnings.length > 0) {
          setError(result.data.warnings.join('; '));
        }
      } else {
        setError(result.error || '环境检测失败');
      }

      // 获取环境变量供 UI 显示
      try {
        const varsResult: EnvVarResult = await window.atm.getEnvVars(
          ['HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'CDS_SITE', 'SKILL_PATH']
        );
        if (varsResult.success && varsResult.data) {
          setEnvVars(varsResult.data);
        }
      } catch {
        // env vars 加载失败不阻塞页面
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPcbenv = async () => {
    try {
      setLoading(true);
      const result = await window.atm.selectPcbenv();
      if (result.success && result.data) {
        setSelectedPath(result.data);
        await loadEnvironment(result.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const getDetectionModeText = (mode: string) => {
    switch (mode) {
      case 'local': return '本地用户配置';
      case 'cloud_install_user_config': return '云端安装用户配置';
      default: return '未知';
    }
  };

  if (loading && !envInfo) {
    return <div className="loading">正在检测 Allegro 配置环境...</div>;
  }

  const environmentSurface = getPageSurface('environment');
  const environmentSummaryLine = [
    envInfo ? getDetectionModeText(envInfo.detectedMode) : '检测模式未知',
    envInfo?.envExists ? 'env 已检测' : 'env 缺失',
    envInfo?.pcbenvExists ? 'pcbenv 可用' : 'pcbenv 缺失',
  ];

  return (
    <div className="workspace-page utility-page">
      <MinimalSurface
        title={environmentSurface.title}
        subtitle={environmentSurface.subtitle}
        prompt={environmentSurface.prompt}
        summaryLine={environmentSummaryLine}
        cards={environmentSurface.actions.map((action) => ({
          id: action.id,
          title: action.label,
          meta: action.meta,
        }))}
      />

      {error && (
        <div className="message message-warning">
          {error}
        </div>
      )}

      {/* 检测路径 */}
      <div className="card">
        <div className="card-header">检测优先级</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <div>① 用户手动选择（最高优先级）</div>
          <div>② HOME 环境变量: <code style={{ color: 'var(--accent-cyan)' }}>{envInfo?.homePath || '未设置'}</code></div>
          <div>③ USERPROFILE: <code style={{ color: 'var(--accent-cyan)' }}>{envVars.USERPROFILE || '未设置'}</code></div>
          <div>④ HOMEDRIVE+HOMEPATH: <code style={{ color: 'var(--accent-cyan)' }}>{(envVars.HOMEDRIVE || '') + (envVars.HOMEPATH || '未设置')}</code></div>
        </div>
      </div>

      {/* 文件状态 */}
      <div className="card">
        <div className="card-header">文件状态</div>
        <div className="grid-2">
          <FileStatusCard
            title="HOME 目录"
            path={envInfo?.homePath || null}
            exists={!!envInfo?.homePath}
          />
          <FileStatusCard
            title="pcbenv 目录"
            path={envInfo?.pcbenvPath || null}
            exists={envInfo?.pcbenvExists || false}
            writable={envInfo?.pcbenvWritable}
          />
          <FileStatusCard
            title="env 文件"
            path={envInfo?.envFilePath || null}
            exists={envInfo?.envExists || false}
            readable={envInfo?.envReadable}
            writable={envInfo?.envWritable}
          />
          <FileStatusCard
            title="allegro.ilinit"
            path={envInfo?.ilinitFilePath || null}
            exists={envInfo?.ilinitExists || false}
            readable={envInfo?.ilinitReadable}
            writable={envInfo?.ilinitWritable}
          />
          <FileStatusCard
            title="atm_generated（托管目录）"
            path={envInfo?.atmGeneratedPath || null}
            exists={!!envInfo?.atmGeneratedPath}
          />
        </div>
      </div>

      {/* 模式识别 */}
      {envInfo && (
        <div className="card">
          <div className="card-header">检测模式</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`status-dot ${envInfo.detectedMode === 'unknown' ? 'warning' : 'ok'}`} />
            <span>{getDetectionModeText(envInfo.detectedMode)}</span>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="card">
        <div className="card-header">操作</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleSelectPcbenv}>
            手动选择 pcbenv 目录
          </button>
          <button className="btn" onClick={() => loadEnvironment()}>
            自动检测
          </button>
          {selectedPath && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
              已选择: {selectedPath}
            </span>
          )}
        </div>
      </div>

      {/* 环境变量参考 */}
      <div className="card">
        <div className="card-header">Windows 环境变量</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>变量名</th>
              <th>当前值</th>
            </tr>
          </thead>
          <tbody>
            {['HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'CDS_SITE', 'SKILL_PATH'].map((name) => (
              <tr key={name}>
                <td style={{ fontWeight: 500 }}>{name}</td>
                <td className="path-display">
                  {envVars[name] || <span style={{ color: 'var(--text-muted)' }}>未设置</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EnvironmentPage;
