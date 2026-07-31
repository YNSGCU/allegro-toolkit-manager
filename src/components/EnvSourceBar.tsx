/**
 * ATM - Env 来源状态栏（V3.0 多 env）
 *
 * 快捷键页顶部显示：
 *   - 当前编辑 env 路径 + 可写状态
 *   - 参考 env 数量
 *   - 层级说明
 *   - [管理 env 来源] 按钮
 */
import React from 'react';
import type { EnvSourceList } from '../types/environment';

interface EnvSourceBarProps {
  envSources: EnvSourceList | null;
  onOpenManagement: () => void;
}

const EnvSourceBar: React.FC<EnvSourceBarProps> = ({ envSources, onOpenManagement }) => {
  if (!envSources) return null;

  const activeSource = envSources.activeEnvId
    ? envSources.sources.find((s) => s.id === envSources.activeEnvId)
    : null;

  const referenceCount = envSources.sources.filter((s) => s.isReference && s.exists).length;
  const totalSources = envSources.sources.filter((s) => s.exists).length;

  return (
    <div className="env-source-bar">
      <div className="env-source-bar__main">
        {activeSource ? (
          <>
            <span className="env-source-bar__label">当前编辑 env：</span>
            <code className="env-source-bar__path">{activeSource.path}</code>
            <span className={`env-source-bar__status ${activeSource.writable ? 'status--ok' : 'status--readonly'}`}>
              {activeSource.writable ? '可写' : '只读'}
            </span>
          </>
        ) : (
          <span className="env-source-bar__label" style={{ color: 'var(--accent-yellow)' }}>
            未设置活动 env
          </span>
        )}
      </div>

      <div className="env-source-bar__info">
        {totalSources > 0 && (
          <span className="env-source-bar__count">
            共 {totalSources} 个 env 来源
            {referenceCount > 0 && `（${referenceCount} 个参考）`}
          </span>
        )}
        <span className="env-source-bar__layer">
          最终层级：用户 env &gt; 参考 env &gt; 默认/保留库
        </span>
        <button
          className="btn btn-sm"
          onClick={onOpenManagement}
          title="管理 env 来源"
        >
          管理 env 来源
        </button>
      </div>
    </div>
  );
};

export default EnvSourceBar;
