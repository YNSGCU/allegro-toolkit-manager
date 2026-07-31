/** ATM - 环境检测 */
import React, { useEffect, useState } from 'react';
import { FolderOpen, RefreshCw } from 'lucide-react';
import type { EnvironmentInfo } from '../types/environment';
import FileStatusCard from '../components/FileStatusCard';
import { PageState, StatusStrip, WorkspaceHeader, WorkspacePage } from '../shared/ui';

type EnvVarMap = Record<string, string | null>;

interface EnvVarResult {
  success: boolean;
  data?: EnvVarMap;
  error?: string;
}

const envVarNames = ['HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'CDS_SITE', 'SKILL_PATH'];

function getDetectionModeText(mode: EnvironmentInfo['detectedMode']) {
  switch (mode) {
    case 'local': return '本地用户配置';
    case 'cloud_install_user_config': return '云端安装用户配置';
    default: return '尚未识别';
  }
}

const EnvironmentPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [envInfo, setEnvInfo] = useState<EnvironmentInfo | null>(null);
  const [envVars, setEnvVars] = useState<EnvVarMap>({});
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const loadEnvironment = async (manualPath?: string) => {
    setLoading(true);
    setError(null);
    try {
      if (typeof window.atm === 'undefined') {
        throw new Error('未连接到 Electron 主进程，请在 ATM 桌面应用中打开。');
      }
      const result = await window.atm.locateEnvironment(manualPath);
      if (result.success && result.data) {
        setEnvInfo(result.data);
        if (result.data.warnings.length > 0) setError(result.data.warnings.join('；'));
      } else {
        setError(result.error || '环境检测失败');
      }

      try {
        const varsResult: EnvVarResult = await window.atm.getEnvVars(envVarNames);
        if (varsResult.success && varsResult.data) setEnvVars(varsResult.data);
      } catch {
        // 环境变量只用于诊断展示，不阻塞主检测结果。
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEnvironment();
  }, []);

  const handleSelectPcbenv = async () => {
    try {
      setLoading(true);
      if (typeof window.atm === 'undefined') throw new Error('未连接到 Electron 主进程。');
      const result = await window.atm.selectPcbenv();
      if (result.success && result.data) {
        setSelectedPath(result.data);
        await loadEnvironment(result.data);
      }
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : String(selectError));
    } finally {
      setLoading(false);
    }
  };

  if (loading && !envInfo) {
    return (
      <WorkspacePage className="environment-page">
        <WorkspaceHeader eyebrow="运行基础" title="环境" description="正在定位 pcbenv、env 与 Allegro 启动文件。" />
        <PageState kind="loading" title="正在检测 Allegro 环境" description="检测过程不会修改任何配置文件。" />
      </WorkspacePage>
    );
  }

  if (error && !envInfo) {
    return (
      <WorkspacePage className="environment-page">
        <WorkspaceHeader eyebrow="运行基础" title="环境" description="确认路径、权限与配置来源。" />
        <PageState
          kind="error"
          title="环境检测未完成"
          description={error}
          action={<button className="btn btn-primary" onClick={() => void loadEnvironment()}>重新检测</button>}
        />
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage className="environment-page">
      <WorkspaceHeader
        eyebrow="运行基础"
        title="环境"
        description="确认 ATM 当前使用的配置目录、文件权限与 Windows 环境变量来源。"
        actions={(
          <>
            <button className="btn" onClick={() => void loadEnvironment()} disabled={loading}>
              <RefreshCw aria-hidden="true" />
              {loading ? '检测中…' : '自动检测'}
            </button>
            <button className="btn btn-primary" onClick={() => void handleSelectPcbenv()} disabled={loading}>
              <FolderOpen aria-hidden="true" />
              选择 pcbenv
            </button>
          </>
        )}
      />

      <StatusStrip
        label="环境检测摘要"
        items={[
          { label: '模式', value: envInfo ? getDetectionModeText(envInfo.detectedMode) : '尚未识别', tone: envInfo?.detectedMode === 'unknown' ? 'warning' : 'info' },
          { label: 'pcbenv', value: envInfo?.pcbenvExists ? '可用' : '缺失', tone: envInfo?.pcbenvExists ? 'ok' : 'error' },
          { label: 'env', value: envInfo?.envExists ? '可用' : '缺失', tone: envInfo?.envExists ? 'ok' : 'error' },
          { label: 'ilinit', value: envInfo?.ilinitExists ? '已存在' : '未创建', tone: envInfo?.ilinitExists ? 'ok' : 'muted' },
          { label: '警告', value: `${envInfo?.warnings.length ?? 0} 项`, tone: envInfo?.warnings.length ? 'warning' : 'ok' },
        ]}
      />

      {error ? <div className="message message-warning environment-inline-warning">{error}</div> : null}

      <div className="environment-primary-grid">
        <section className="ui-panel environment-detection-panel" aria-label="检测来源">
          <div className="ui-panel-header">
            <div><p className="ui-panel-eyebrow">路径解析</p><h2>检测来源与优先级</h2></div>
          </div>
          <ol className="environment-priority-list">
            <li><span>1</span><div><strong>用户手动选择</strong><code>{selectedPath || '本次未指定'}</code></div></li>
            <li><span>2</span><div><strong>HOME</strong><code>{envInfo?.homePath || envVars.HOME || '未设置'}</code></div></li>
            <li><span>3</span><div><strong>USERPROFILE</strong><code>{envVars.USERPROFILE || '未设置'}</code></div></li>
            <li><span>4</span><div><strong>HOMEDRIVE + HOMEPATH</strong><code>{`${envVars.HOMEDRIVE || ''}${envVars.HOMEPATH || ''}` || '未设置'}</code></div></li>
          </ol>
        </section>

        <section className="ui-panel environment-active-panel" aria-label="当前活动环境">
          <div className="ui-panel-header">
            <div><p className="ui-panel-eyebrow">当前结果</p><h2>{envInfo ? getDetectionModeText(envInfo.detectedMode) : '尚未识别'}</h2></div>
          </div>
          <dl className="environment-active-list">
            <div><dt>HOME</dt><dd>{envInfo?.homePath || '未定位'}</dd></div>
            <div><dt>pcbenv</dt><dd>{envInfo?.pcbenvPath || '未定位'}</dd></div>
            <div><dt>活动 env</dt><dd>{envInfo?.envFilePath || '未定位'}</dd></div>
          </dl>
        </section>
      </div>

      <section className="ui-panel environment-files" aria-label="文件状态">
        <div className="ui-panel-header"><div><p className="ui-panel-eyebrow">读写边界</p><h2>目录与文件状态</h2></div></div>
        <div className="ui-file-grid ui-file-grid--environment">
          <FileStatusCard title="HOME 目录" path={envInfo?.homePath || null} exists={Boolean(envInfo?.homePath)} />
          <FileStatusCard title="pcbenv 目录" path={envInfo?.pcbenvPath || null} exists={envInfo?.pcbenvExists || false} writable={envInfo?.pcbenvWritable} />
          <FileStatusCard title="env 文件" path={envInfo?.envFilePath || null} exists={envInfo?.envExists || false} readable={envInfo?.envReadable} writable={envInfo?.envWritable} />
          <FileStatusCard title="allegro.ilinit" path={envInfo?.ilinitFilePath || null} exists={envInfo?.ilinitExists || false} readable={envInfo?.ilinitReadable} writable={envInfo?.ilinitWritable} />
          <FileStatusCard title="atm_generated" path={envInfo?.atmGeneratedPath || null} exists={Boolean(envInfo?.atmGeneratedPath)} />
        </div>
      </section>

      <section className="ui-panel environment-vars" aria-label="Windows 环境变量">
        <div className="ui-panel-header"><div><p className="ui-panel-eyebrow">诊断参考</p><h2>Windows 环境变量</h2></div></div>
        <div className="environment-table-scroll">
          <table className="data-table environment-var-table">
            <thead><tr><th>变量名</th><th>当前值</th><th>状态</th></tr></thead>
            <tbody>
              {envVarNames.map((name) => (
                <tr key={name}>
                  <td><code>{name}</code></td>
                  <td className="path-display">{envVars[name] || '—'}</td>
                  <td><span className={`badge ${envVars[name] ? 'badge-success' : 'badge-warning'}`}>{envVars[name] ? '已设置' : '未设置'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </WorkspacePage>
  );
};

export default EnvironmentPage;
