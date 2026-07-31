import { useMemo, useState } from 'react';
import type { EnvRole, EnvSource } from '../../types/environment';
import type { HotkeyImportExportPanelProps } from './types';

function getProfileLabel(profileName: string | undefined, profileCount: number) {
  if (profileName) {
    return profileName;
  }

  if (profileCount > 0) {
    return '已加载方案';
  }

  return '未选择方案';
}

function getEnvRoleLabel(role: EnvRole) {
  switch (role) {
    case 'user_env':
      return '当前用户 env';
    case 'site_env':
      return '站点 env';
    case 'company_env':
      return '公司 env';
    case 'install_default_env':
      return '安装默认 env';
    case 'reference_env':
      return '参考 env';
    default:
      return '其他 env';
  }
}

function getEnvDisplayName(source: EnvSource) {
  if (source.role === 'install_default_env') {
    return '安装默认 env';
  }

  return source.displayName;
}

function getEnvAccessLabel(source: EnvSource) {
  if (!source.exists) {
    return '不存在';
  }

  return source.writable ? '可写' : '只读';
}

function getEnvPurposeLabel(source: EnvSource) {
  switch (source.role) {
    case 'install_default_env':
      return '基础参考层';
    case 'site_env':
    case 'company_env':
    case 'reference_env':
      return '参考来源';
    default:
      return null;
  }
}

function getEnvGuidanceLabel(source: EnvSource) {
  if (source.role === 'install_default_env') {
    return '文件可写，但不建议作为日常编辑目标';
  }

  return null;
}

function getShortPathLabel(fullPath: string) {
  const parts = fullPath.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 4) {
    return fullPath;
  }

  return `...\\${parts.slice(-4).join('\\')}`;
}

export default function HotkeyImportExportPanel({
  sharedState,
  actions,
}: HotkeyImportExportPanelProps) {
  const [openFolderError, setOpenFolderError] = useState<string | null>(null);
  const activeProfile = sharedState.profiles.find((profile) => profile.id === sharedState.activeProfileId) ?? null;
  const activeEnvPath = sharedState.envInfo?.envFilePath ?? '未检测到 env 文件';
  const envSourceCount = sharedState.envSources?.sources.length ?? 0;
  const previewState = sharedState.envImportPreview ? '已生成 env 导入预览' : '等待选择导入文件';

  const activeEnvSource = useMemo(() => {
    const fromSources = sharedState.envSources?.sources.find((source) => source.selectedAsActive) ?? null;
    if (fromSources) {
      return fromSources;
    }

    if (!sharedState.envInfo?.envFilePath) {
      return null;
    }

    return {
      id: 'active-env-fallback',
      path: sharedState.envInfo.envFilePath,
      role: 'user_env' as const,
      readable: true,
      writable: !!sharedState.envInfo.envWritable,
      exists: !!sharedState.envInfo.envExists,
      priority: 0,
      selectedAsActive: true,
      isReference: false,
      displayName: '用户配置 env',
    };
  }, [sharedState.envInfo, sharedState.envSources]);

  const extraEnvSources = useMemo(
    () =>
      (sharedState.envSources?.sources ?? []).filter(
        (source) => source.exists && !source.selectedAsActive,
      ),
    [sharedState.envSources],
  );

  const handleOpenFolder = async (sourcePath: string) => {
    if (typeof window.atm.openEnvSourceFolder !== 'function') {
      setOpenFolderError('当前版本不支持打开 env 所在文件夹');
      return;
    }

    setOpenFolderError(null);
    const result = await window.atm.openEnvSourceFolder(sourcePath);
    if (!result.success) {
      setOpenFolderError(result.error || '打开文件夹失败');
    }
  };

  return (
    <section className="hotkey-import-export-panel" aria-label="导入导出">
      <header className="workspace-section-header">
        <div>
          <h1>导入导出</h1>
          <p>把 env、方案、速查表和变更历史拆成同一条操作带，减少来回切页。</p>
        </div>
      </header>

      <div className="hotkey-io-actions" role="group" aria-label="导入导出操作">
        <button className="btn btn-primary" onClick={actions.handleEnvImportClick}>
          导入 env
        </button>
        <button className="btn" onClick={actions.handleImportProfileClick}>
          导入方案
        </button>
        <button className="btn" onClick={() => void actions.handleExportProfile()} disabled={!sharedState.activeProfileId}>
          导出方案
        </button>
        <button className="btn" onClick={() => actions.setShowExportDialog(true)} disabled={sharedState.bindings.length === 0}>
          导出速查表
        </button>
        <button className="btn" onClick={() => actions.setShowChangeHistory(true)} disabled={!sharedState.envInfo?.pcbenvPath}>
          变更历史
        </button>
      </div>

      <div className="hotkey-io-inline-status" aria-label="导入导出状态">
        <span>当前 env：{activeEnvPath}</span>
        <span>当前方案：{getProfileLabel(activeProfile?.name, sharedState.profiles.length)}</span>
        <span>env 来源：{envSourceCount} 个</span>
        <span>导入预览：{previewState}</span>
      </div>

      <div className="hotkey-io-env-panel" aria-label="env 方案列表">
        <div className="hotkey-io-env-panel-header">
          <h2>env 方案</h2>
          <span>{extraEnvSources.length > 0 ? `额外来源 ${extraEnvSources.length} 个` : '当前仅使用 1 个 env'}</span>
        </div>

        {activeEnvSource ? (
          <div className="hotkey-io-env-active">
            <div className="hotkey-io-env-copy">
              <div className="hotkey-io-env-active-header">
                <span className="hotkey-io-env-kicker">当前生效</span>
                <span className="hotkey-io-env-active-badge">已生效</span>
              </div>
              <strong>{getEnvDisplayName(activeEnvSource)}</strong>
              <span>{getEnvRoleLabel(activeEnvSource.role)} · {getEnvAccessLabel(activeEnvSource)}</span>
              <code title={activeEnvSource.path}>{getShortPathLabel(activeEnvSource.path)}</code>
            </div>
            <button
              className="btn btn-sm"
              onClick={() => void handleOpenFolder(activeEnvSource.path)}
              aria-label={`打开 ${getEnvDisplayName(activeEnvSource)} 所在文件夹`}
            >
              打开文件夹
            </button>
          </div>
        ) : null}

        {extraEnvSources.length > 0 ? (
          <div className="hotkey-io-env-list">
            <div className="hotkey-io-env-list-title">其他 env 来源</div>
            {extraEnvSources.map((source) => {
              const purposeLabel = getEnvPurposeLabel(source);
              const guidanceLabel = getEnvGuidanceLabel(source);

              return (
                <article key={source.id} className="hotkey-io-env-item">
                  <div className="hotkey-io-env-copy">
                    <strong>{getEnvDisplayName(source)}</strong>
                    <span>{getEnvRoleLabel(source.role)} · {getEnvAccessLabel(source)}</span>
                    {purposeLabel ? (
                      <span className="hotkey-io-env-note">{purposeLabel}</span>
                    ) : null}
                    {guidanceLabel ? (
                      <span className="hotkey-io-env-note">{guidanceLabel}</span>
                    ) : null}
                    <code title={source.path}>{getShortPathLabel(source.path)}</code>
                  </div>
                  <button
                    className="btn btn-sm"
                    onClick={() => void handleOpenFolder(source.path)}
                    aria-label={`打开 ${getEnvDisplayName(source)} 所在文件夹`}
                  >
                    打开文件夹
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="hotkey-io-env-empty">没有额外 env 方案，当前页仍会继续显示导入预览与方案导出状态。</div>
        )}
      </div>

      <div className="hotkey-io-notes">
        <p>方案导入只写 ATM 配置，不会直接覆盖用户 env。</p>
        <p>env 导入会先预览冲突，高风险写入仍通过 Apply Plan 执行。</p>
      </div>

      {openFolderError ? (
        <div className="message message-error">{openFolderError}</div>
      ) : null}

      {sharedState.error ? (
        <div className="message message-error">{sharedState.error}</div>
      ) : null}
    </section>
  );
}
