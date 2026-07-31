/**
 * ATM - Apply Plan 中文映射工具函数（V5.3）
 */

/** ApplyPlanStepType → 中文标签 */
export const STEP_TYPE_LABELS: Record<string, { icon: string; label: string; color: string }> = {
  backup_file: { icon: '💾', label: '备份文件', color: 'var(--accent-green)' },
  backup: { icon: '💾', label: '备份文件', color: 'var(--accent-green)' },
  modify_line: { icon: '✏️', label: '修改行', color: 'var(--accent-blue)' },
  append_line: { icon: '➕', label: '追加行', color: 'var(--accent-cyan)' },
  comment_line: { icon: '💬', label: '注释行', color: 'var(--accent-yellow)' },
  write_file: { icon: '📄', label: '写入文件', color: 'var(--accent-blue)' },
  create_file: { icon: '📄', label: '创建文件', color: 'var(--accent-green)' },
  delete_file: { icon: '🗑️', label: '删除文件', color: 'var(--accent-red)' },
  archive_file: { icon: '📁', label: '归档文件', color: 'var(--accent-orange)' },
  update_json: { icon: '⚙️', label: '更新配置', color: 'var(--accent-blue)' },
  generate_loader: { icon: '🔧', label: '生成加载器', color: 'var(--accent-purple)' },
  generate_menu: { icon: '📋', label: '生成菜单', color: 'var(--accent-purple)' },
  ensure_bootstrap: { icon: '🚀', label: '写入启动脚本', color: 'var(--accent-green)' },
  record_history: { icon: '📜', label: '记录历史', color: 'var(--text-muted)' },
  create_directory: { icon: '📁', label: '创建目录', color: 'var(--accent-yellow)' },
  move_file: { icon: '📦', label: '移动文件', color: 'var(--accent-orange)' },
  write_skill_loader: { icon: '🔧', label: '生成加载器', color: 'var(--accent-purple)' },
  write_bootstrap: { icon: '🚀', label: '写入启动脚本', color: 'var(--accent-green)' },
  modify_ilinit: { icon: '🔧', label: '修改加载入口', color: 'var(--accent-purple)' },
};

export function getStepLabel(type: string): { icon: string; label: string; color: string } {
  return STEP_TYPE_LABELS[type] || { icon: '➡️', label: type, color: 'var(--text-muted)' };
}

/** 风险等级样式 */
export const RISK_STYLES: Record<string, { icon: string; bg: string; border: string; color: string }> = {
  error: {
    icon: '❌',
    bg: 'rgba(247, 118, 142, 0.08)',
    border: 'rgba(247, 118, 142, 0.3)',
    color: 'var(--accent-red)',
  },
  warning: {
    icon: '⚠️',
    bg: 'rgba(224, 175, 104, 0.08)',
    border: 'rgba(224, 175, 104, 0.3)',
    color: 'var(--accent-yellow)',
  },
  info: {
    icon: 'ℹ️',
    bg: 'rgba(122, 162, 247, 0.08)',
    border: 'rgba(122, 162, 247, 0.3)',
    color: 'var(--accent-blue)',
  },
};

export function getRiskStyle(severity: string) {
  return RISK_STYLES[severity] || RISK_STYLES.info;
}
