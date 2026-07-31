/**
 * ATM - Env 来源标签（V3.0 多 env）
 *
 * 显示快捷键绑定来自哪个 env 文件的小标签。
 * 颜色按角色区分：
 *   用户 env → 绿色
 *   安装默认 env → 蓝灰色
 *   站点 env → 橙色
 *   公司 env → 紫色
 *   参考 env → 灰色
 */
import React from 'react';
import type { EnvRole } from '../types/environment';

interface EnvSourceTagProps {
  envRole?: string | null;
  envSourcePath?: string | null;
  displayName?: string | null;
  compact?: boolean;
}

const ENV_ROLE_CONFIG: Record<string, { label: string; className: string; icon: string }> = {
  user_env: { label: '用户 env', className: 'env-source-tag--user', icon: '📝' },
  install_default_env: { label: '默认 env', className: 'env-source-tag--default', icon: '⚙️' },
  site_env: { label: '站点 env', className: 'env-source-tag--site', icon: '🏢' },
  company_env: { label: '公司 env', className: 'env-source-tag--company', icon: '🏛️' },
  reference_env: { label: '参考 env', className: 'env-source-tag--reference', icon: '📄' },
};

const DEFAULT_CONFIG = { label: '未知来源', className: 'env-source-tag--unknown', icon: '❓' };

const EnvSourceTag: React.FC<EnvSourceTagProps> = ({
  envRole,
  envSourcePath,
  displayName,
  compact,
}) => {
  const config = ENV_ROLE_CONFIG[envRole || ''] || DEFAULT_CONFIG;

  const tooltip = envSourcePath
    ? `来源: ${displayName || config.label}\n路径: ${envSourcePath}`
    : `来源: ${displayName || config.label}`;

  return (
    <span
      className={`env-source-tag ${config.className}`}
      title={tooltip}
    >
      {!compact && <span style={{ marginRight: 2 }}>{config.icon}</span>}
      {compact ? '' : (displayName || config.label)}
    </span>
  );
};

export default EnvSourceTag;
