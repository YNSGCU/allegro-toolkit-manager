/** ATM - 环境检测 */
import React, { useEffect, useState } from 'react';
import { FolderOpen, FolderPlus, RefreshCw, Trash2 } from 'lucide-react';
import type { AllegroEnvironmentWorkspace, EnvironmentInfo, EnvironmentRegistry } from '../types/environment';
import FileStatusCard from '../components/FileStatusCard';
import { formatUserError, PageState, StatusStrip, WorkspaceHeader, WorkspacePage } from '../shared/ui';
import ToastContainer, { useToast } from '../components/common/Toast';

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
  const { toasts, addToast, removeToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [envInfo, setEnvInfo] = useState<EnvironmentInfo | null>(null);
  const [envVars, setEnvVars] = useState<EnvVarMap>({});
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [registry, setRegistry] = useState<EnvironmentRegistry | null>(null);
  const [switchingEnvironment, setSwitchingEnvironment] = useState(false);
  const [runtimeVerification, setRuntimeVerification] = useState<string | null>(null);

  const loadWorkspaces = async (refresh = false, manualPath?: string) => {
    if (typeof window.atm === 'undefined' || typeof window.atm.listAllegroEnvironments !== 'function') return;
    const result = await window.atm.listAllegroEnvironments(refresh, manualPath);
    if (result.success && result.data) setRegistry(result.data);
  };

  const loadEnvironment = async (manualPath?: string) => {
    setLoading(true);
    setError(null);
    try {
      if (typeof window.atm === 'undefined') {
        throw new Error('未连接到 Electron 主进程，请在 ATM 桌面应用中打开。');
      }
      await loadWorkspaces(true, manualPath);
      const result = await window.atm.locateEnvironment();
      if (result.success && result.data) {
        setEnvInfo(result.data);
        if (result.data.warnings.length > 0) setError(result.data.warnings.join('；'));
      } else {
        setError(formatUserError(result.error, '环境检测失败'));
      }

      try {
        const varsResult: EnvVarResult = await window.atm.getEnvVars(envVarNames);
        if (varsResult.success && varsResult.data) setEnvVars(varsResult.data);
      } catch {
        // 环境变量只用于诊断展示，不阻塞主检测结果。
      }
    } catch (loadError) {
      setError(formatUserError(loadError, '环境检测失败'));
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
      setError(formatUserError(selectError, '选择环境文件失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddInstallRoot = async () => {
    try {
      const result = await window.atm.addAllegroInstallRoot();
      if (result.success && result.data) {
        setRegistry(result.data.registry);
        await loadEnvironment();
        addToast('success', `\u5df2\u6dfb\u52a0\u5b89\u88c5\u76ee\u5f55\uff1a${result.data.selectedRoot}`);
      }
    } catch (err) {
      addToast('error', formatUserError(err, '\u6dfb\u52a0\u5b89\u88c5\u76ee\u5f55\u5931\u8d25'));
    }
  };

  const handleRemoveInstallRoot = async (installRoot: string) => {
    try {
      const result = await window.atm.removeAllegroInstallRoot(installRoot);
      if (result.success && result.data) {
        setRegistry(result.data);
        await loadEnvironment();
        addToast('success', '\u5df2\u79fb\u9664\u5b89\u88c5\u76ee\u5f55');
      }
    } catch (err) {
      addToast('error', formatUserError(err, '\u79fb\u9664\u5b89\u88c5\u76ee\u5f55\u5931\u8d25'));
    }
  };

  const handleSwitchEnvironment = async (environmentId: string) => {
    if (!environmentId || !window.atm || typeof window.atm.setActiveAllegroEnvironment !== 'function') return;
    setSwitchingEnvironment(true);
    try {
      const result = await window.atm.setActiveAllegroEnvironment(environmentId);
      if (result.success && result.data?.environment) {
        setRegistry(result.data.registry);
        await loadEnvironment();
        setSelectedPath(result.data.environment.pcbenvPath);
      } else {
        setError(formatUserError(result.error, '切换 Allegro 环境失败'));
      }
    } finally {
      setSwitchingEnvironment(false);
    }
  };

  const handleVerifyRuntime = async () => {
    const environmentId = registry?.activeEnvironmentId;
    if (!environmentId || typeof window.atm.verifyAllegroRuntime !== 'function') return;
    setSwitchingEnvironment(true);
    const result = await window.atm.verifyAllegroRuntime(environmentId);
    setSwitchingEnvironment(false);
    setRuntimeVerification(result.success && result.data ? result.data.result.message : (result.error || '运行验证失败'));
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
            <button className="btn" onClick={() => void handleAddInstallRoot()} disabled={loading}>
              <FolderPlus aria-hidden="true" />
              添加安装目录
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

      <section className="environment-workspace-switcher" aria-label="Allegro 多版本环境">
        <div>
          <strong>当前 Allegro 环境</strong>
          <span className="environment-workspace-hint">所有扫描和写入都会针对所选环境</span>
        </div>
        <select
          value={registry?.activeEnvironmentId || ''}
          onChange={(event) => void handleSwitchEnvironment(event.target.value)}
          disabled={switchingEnvironment || !registry?.environments.length}
          aria-label="选择 Allegro 环境"
        >
          {!registry?.environments.length ? <option value="">未发现 Allegro 环境</option> : null}
          {registry?.environments.map((workspace: AllegroEnvironmentWorkspace) => (
            <option value={workspace.id} key={workspace.id}>
              {workspace.name}{workspace.allegroVersion ? ` · ${workspace.allegroVersion}` : ''} · {workspace.pcbenvPath}
            </option>
          ))}
        </select>
        {envInfo?.sharedEnvironmentIds?.length ? (
          <span className="environment-shared-warning">当前 pcbenv 还被其他 Allegro 版本共享，修改会同时生效</span>
        ) : null}
        <div className="environment-runtime-verification">
          <button className="btn btn-sm" onClick={() => void handleVerifyRuntime()} disabled={!registry?.activeEnvironmentId || switchingEnvironment}>???? Allegro ??</button>
          <span>{runtimeVerification || '??? Vibe Bridge ??????????????????'}</span>
        </div>

        {registry?.manualInstallRoots?.length ? (
          <div className="environment-manual-roots">
            <div className="environment-manual-roots-head">
              <strong>?????????</strong>
              <span className="environment-manual-roots-hint">???????????????????? SPB ???</span>
            </div>
            <ul className="environment-manual-roots-list">
              {registry.manualInstallRoots.map((root) => (
                <li key={root}>
                  <code>{root}</code>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => void handleRemoveInstallRoot(root)}
                    aria-label={`?? ${root}`}
                  >
                    <Trash2 aria-hidden="true" />
                    ??
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

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
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </WorkspacePage>
  );
};

export default EnvironmentPage;
