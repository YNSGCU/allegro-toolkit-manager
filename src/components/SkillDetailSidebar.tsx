/**
 * ATM - Skill 详情侧边栏组件（V5.2 增强版）
 * 展示 Skill 的完整信息：使用关系树、配置文件、状态、入口命令、快捷键引用等
 */
import React, { useState, useEffect } from 'react';
import type {
  SkillFileItem, SkillCommandItem, SkillFunctionItem, HotkeyReference,
  MenuReference, SkillLoadStatus, SkillSourceType, SkillReferenceIssue,
  SkillMeta, SkillUsageInfo, UsageTreeNode, SkillConfigFile,
} from '../types/skill';
import { getLoadStatusDisplay, getSourceTypeLabel, USAGE_STATUS_DISPLAY } from '../types/skill';

interface SkillDetailSidebarProps {
  skill: SkillFileItem | null;
  loading?: boolean;
  onClose: () => void;
  onToggle: (skillPath: string, enabled: boolean) => void;
  onBindHotkey?: (commandName: string) => void;
  onAddMenu?: (commandName: string) => void;
  onAddToLoader?: (skillPath: string) => void;
  onOpenFileLocation?: (filePath: string) => void;
  onReParse?: (skillPath: string) => void;
  onMarkEntry?: (functionName: string) => void;
  onCopyCommand?: (commandName: string) => void;
  refIssues?: SkillReferenceIssue[];
  refStats?: { total: number; errors: number; warnings: number; infos: number };
  onNavigateToRefs?: () => void;
  meta?: SkillMeta | null;
  onEditNote?: (skill: SkillFileItem) => void;
  onReAnalyze?: (skill: SkillFileItem) => void;
  onCopySummary?: (text: string) => void;
  onClearAuto?: (skill: SkillFileItem) => void;
  onDelete?: (skill: SkillFileItem) => void;
  onJumpToHotkey?: (hotkeyKey: string) => void;
  onEditHotkey?: (hotkeyKey: string) => void;
  onDeleteHotkeyBinding?: (ref: HotkeyReference) => void;
  onViewEnvRawLine?: (source: string, lineNumber: number) => void;
  /** V5.2 使用状态信息 */
  usageInfo?: SkillUsageInfo;
  /** V5.2 使用关系树 */
  usageTree?: UsageTreeNode;
  /** V5.2 配置文件列表 */
  configFiles?: SkillConfigFile[];
  /** V5.2 生成 README */
  onGenerateReadme?: (skill: SkillFileItem) => void;
  /** V5.2 导出包 */
  onExportPackage?: (skill: SkillFileItem) => void;
}

const SkillDetailSidebar: React.FC<SkillDetailSidebarProps> = ({
  skill,
  loading = false,
  onClose,
  onToggle,
  onBindHotkey,
  onAddMenu,
  onAddToLoader,
  onOpenFileLocation,
  onReParse,
  onMarkEntry,
  onCopyCommand,
  refIssues,
  refStats,
  onNavigateToRefs,
  meta,
  onEditNote,
  onReAnalyze,
  onCopySummary,
  onClearAuto,
  onDelete,
  onJumpToHotkey,
  onEditHotkey,
  onDeleteHotkeyBinding,
  onViewEnvRawLine,
  usageInfo,
  usageTree,
  configFiles,
  onGenerateReadme,
  onExportPackage,
}) => {
  const [showInternals, setShowInternals] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'commands' | 'files' | 'maintenance'>('overview');

  useEffect(() => {
    setActiveDetailTab('overview');
    setShowInternals(false);
  }, [skill?.id]);

  if (loading) {
    return (
      <div className="skill-detail-sidebar">
        <div className="skill-detail-sidebar-content">
          <div className="loading" style={{ padding: 40 }}>加载详情中...</div>
        </div>
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="skill-detail-sidebar">
        <div className="skill-detail-sidebar-content">
          <div className="detail-empty-state">
            <div>
              <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.4 }}>←</div>
              <div style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                从列表中选择一个 Skill 查看详情
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.8' }}>
                详情面板将显示：<br />
                基本信息 · 入口命令 · 内部函数 · 使用关系<br />
                引用检查 · 配置文件 · 健康度
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const loadDisplay = getLoadStatusDisplay(skill.loadStatus);
  const isCompany = skill.tier === 'company';
  const fileSizeStr = skill.fileSize
    ? skill.fileSize > 1024 * 1024
      ? `${(skill.fileSize / 1024 / 1024).toFixed(1)} MB`
      : `${(skill.fileSize / 1024).toFixed(0)} KB`
    : '未知';
  const lastModifiedStr = skill.lastModified
    ? new Date(skill.lastModified).toLocaleString('zh-CN')
    : '未知';

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  // 渲染使用关系树
  const renderUsageTreeNode = (node: UsageTreeNode, depth: number = 0) => {
    const indent = depth * 16;
    switch (node.type) {
      case 'skill':
        return (
          <div key={node.name} className="usage-tree-node usage-tree-skill">
            <span className="usage-tree-icon">Skill</span>
            <span className="usage-tree-name">{node.name}</span>
            {node.children && node.children.length > 0 && (
              <div className="usage-tree-children">
                {node.children.map((child) => renderUsageTreeNode(child, depth + 1))}
              </div>
            )}
          </div>
        );
      case 'command':
        return (
          <div key={node.name} className="usage-tree-node usage-tree-command">
            <span className="usage-tree-icon">键位</span>
            <code className="usage-tree-name">{node.name}</code>
            {node.detail && <span className="usage-tree-detail">{node.detail}</span>}
            {node.conflictStatus === 'duplicate_command' && (
              <span className="usage-tree-warning">冲突</span>
            )}
            {node.children && node.children.length > 0 && (
              <div className="usage-tree-children">
                {node.children.map((child) => renderUsageTreeNode(child, depth + 1))}
              </div>
            )}
          </div>
        );
      case 'hotkey':
        return (
          <div key={`${node.name}-${depth}`} className="usage-tree-node usage-tree-hotkey">
            <span className="usage-tree-icon">
              {node.hasConflict ? '冲突' : node.isStale ? '失效' : '键位'}
            </span>
            <code className="usage-tree-key">{node.name}</code>
            <span className="usage-tree-arrow">→</span>
            <span className="usage-tree-detail">{node.detail}</span>
            {node.source && (
              <span className="usage-tree-source" title={node.source}>来源</span>
            )}
            {node.lineNumber && (
              <span className="usage-tree-line">L{node.lineNumber}</span>
            )}
            <div className="usage-tree-actions">
              {onJumpToHotkey && (
                <button className="btn btn-sm" onClick={() => onJumpToHotkey(node.name)} title="跳转" style={{ fontSize: 10, padding: '1px 5px' }}>
                  跳转
                </button>
              )}
              {onEditHotkey && (
                <button className="btn btn-sm" onClick={() => onEditHotkey(node.name)} title="编辑" style={{ fontSize: 10, padding: '1px 5px' }}>
                  编辑
                </button>
              )}
            </div>
          </div>
        );
      case 'menu':
        return (
          <div key={`${node.name}-${depth}`} className="usage-tree-node usage-tree-menu">
            <span className="usage-tree-icon">菜单</span>
            <span className="usage-tree-name">{node.name}</span>
            <span className="usage-tree-detail">{node.detail}</span>
          </div>
        );
      case 'empty':
        return (
          <div key="empty" className="usage-tree-node usage-tree-empty">
            <span className="usage-tree-icon">无</span>
            <span className="usage-tree-name" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {node.name}
            </span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="skill-detail-sidebar">
      <div className="skill-detail-sidebar-header">
        <div className="skill-detail-sidebar-title">
          <h3>{skill.name}</h3>
        </div>
        <button className="btn btn-sm" onClick={onClose}>关闭</button>
      </div>

      <div className="skill-detail-tabs" role="tablist" aria-label="Skill 详情分类">
        {([
          ['overview', '概览'],
          ['commands', '命令与引用'],
          ['files', '文件与加载'],
          ['maintenance', '维护'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeDetailTab === key}
            className={activeDetailTab === key ? 'is-active' : ''}
            onClick={() => setActiveDetailTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="skill-detail-sidebar-content">
        {activeDetailTab === 'overview' && <>
        {/* 基本状态 */}
        <section className="skill-detail-section">
          <div className="skill-detail-status-bar">
            <span className="skill-status-tag" style={{ background: loadDisplay.color + '22', color: loadDisplay.color }}>
              {loadDisplay.icon} {loadDisplay.label}
            </span>
            <span className="skill-status-tag" style={{
              background: skill.enabled ? 'rgba(158, 206, 106, 0.15)' : 'rgba(108, 108, 138, 0.15)',
              color: skill.enabled ? 'var(--accent-green)' : 'var(--text-muted)',
            }}>
              {skill.enabled ? '已启用' : '未启用'}
            </span>
            {skill.readonly && (
              <span className="skill-status-tag" style={{ background: 'rgba(187, 154, 247, 0.15)', color: 'var(--accent-purple)' }}>
                只读
              </span>
            )}
          </div>
        </section>

        {/* V5.2 综合使用状态 + 健康度 */}
        {usageInfo && (
          <section className="skill-detail-section">
            <div className="skill-detail-section-title">综合状态</div>
            <div className="skill-usage-summary">
              <div className="skill-usage-status-row" style={{ color: USAGE_STATUS_DISPLAY[usageInfo.status]?.color || 'var(--text-primary)' }}>
                {USAGE_STATUS_DISPLAY[usageInfo.status]?.icon} {USAGE_STATUS_DISPLAY[usageInfo.status]?.label}
              </div>
              <div className="skill-usage-reasons">
                {usageInfo.reasons.map((r, i) => (
                  <div key={i} className="skill-usage-reason-item">{r}</div>
                ))}
              </div>
              <div className="skill-health-row">
                <span className="skill-health-score" style={{ color: usageInfo.healthScore >= 70 ? 'var(--accent-green)' : usageInfo.healthScore >= 50 ? 'var(--accent-yellow)' : 'var(--accent-red)' }}>
                  健康度：{usageInfo.healthScore} / 100
                </span>
                {usageInfo.healthDeductions.filter(d => d.points > 0).length > 0 && (
                  <details style={{ marginTop: 4 }}>
                    <summary style={{ fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      扣分明细 ({usageInfo.healthDeductions.filter(d => d.points > 0).length})
                    </summary>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, paddingLeft: 8 }}>
                      {usageInfo.healthDeductions.filter(d => d.points > 0).map((d, i) => (
                        <div key={i} style={{ padding: '2px 0' }}>— {d.reason} (-{d.points})</div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          </section>
        )}

        {/* 基本信息 */}
        <section className="skill-detail-section">
          <div className="skill-detail-section-title">基本信息</div>
          <table className="skill-detail-table">
            <tbody>
              <tr><td className="skill-detail-label">路径</td><td className="skill-detail-value path-display" title={skill.path}>{skill.path}</td></tr>
              <tr><td className="skill-detail-label">来源</td><td className="skill-detail-value">{getSourceTypeLabel(skill.sourceType)}</td></tr>
              <tr><td className="skill-detail-label">层级</td><td className="skill-detail-value">{skill.tier === 'company' ? '公司' : skill.tier === 'user' ? '用户' : 'ATM'}</td></tr>
              <tr><td className="skill-detail-label">可写</td><td className="skill-detail-value">{skill.writable ? '是' : '否'}</td></tr>
              <tr><td className="skill-detail-label">文件大小</td><td className="skill-detail-value">{fileSizeStr}</td></tr>
              <tr><td className="skill-detail-label">修改时间</td><td className="skill-detail-value">{lastModifiedStr}</td></tr>
              <tr><td className="skill-detail-label">解析状态</td><td className="skill-detail-value">
                {skill.parseStatus === 'ok' ? <span style={{ color: 'var(--accent-green)' }}>解析成功</span>
                  : skill.parseStatus === 'warning' ? <span style={{ color: 'var(--accent-yellow)' }}>部分解析</span>
                  : <span style={{ color: 'var(--accent-red)' }}>解析失败</span>}
              </td></tr>
              {skill.parseError && <tr><td className="skill-detail-label">错误信息</td><td className="skill-detail-value" style={{ color: 'var(--accent-red)' }}>{skill.parseError}</td></tr>}
              {skill.hasPackageJson && <tr><td className="skill-detail-label">依赖</td><td className="skill-detail-value">{skill.dependencies.length > 0 ? skill.dependencies.join(', ') : '无依赖'}</td></tr>}
            </tbody>
          </table>
        </section>

        {/* V5.0 说明区域 */}
        <section className="skill-detail-section">
          <div className="skill-detail-section-title">
            说明
            <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
              {onEditNote && <button className="btn btn-sm" onClick={() => onEditNote(skill)} title="编辑备注" style={{ fontSize: 11 }}>编辑备注</button>}
              {onReAnalyze && <button className="btn btn-sm" onClick={() => onReAnalyze(skill)} title="重新自动分析" style={{ fontSize: 11 }}>重新分析</button>}
            </div>
          </div>
          {!meta ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>
              暂无说明
              {onReAnalyze && <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => onReAnalyze(skill)}>自动分析</button>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              {/* V5.3: 原始名称 — 永远显示 */}
              <div className="skill-meta-row">
                <span className="skill-detail-label" style={{ minWidth: 60 }}>原始名称</span>
                <code style={{ fontWeight: 600 }}>{meta.originalName || skill.name}</code>
              </div>
              {/* 中文名称：userName > displayName > autoName */}
              {(meta.userName || meta.displayName || meta.autoName) && (
                <div className="skill-meta-row">
                  <span className="skill-detail-label" style={{ minWidth: 60 }}>中文名称</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>
                    {meta.userName || meta.displayName || meta.autoName}
                  </span>
                  {meta.userName && meta.autoName && meta.userName !== meta.autoName && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>(自动: {meta.autoName})</span>
                  )}
                </div>
              )}
              {/* 自动简介 */}
              {meta.autoSummary && (
                <div className="skill-meta-row">
                  <span className="skill-detail-label" style={{ minWidth: 60 }}>自动简介</span>
                  <span style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {meta.autoSummary}
                    {onCopySummary && <button className="btn btn-sm" style={{ marginLeft: 6, fontSize: 10 }} onClick={() => onCopySummary(meta.autoSummary || '')} title="复制说明">复制</button>}
                  </span>
                </div>
              )}
              {/* 用户备注 */}
              {meta.userNote && (
                <div className="skill-meta-row">
                  <span className="skill-detail-label" style={{ minWidth: 60 }}>用户备注</span>
                  <span style={{ color: 'var(--accent-cyan)', lineHeight: 1.5 }}>{meta.userNote}</span>
                </div>
              )}
              {/* 分类 */}
              {(meta.userCategory || meta.autoCategory) && (
                <div className="skill-meta-row">
                  <span className="skill-detail-label" style={{ minWidth: 60 }}>分类</span>
                  <span>{meta.userCategory || meta.autoCategory}</span>
                  {meta.userCategory && meta.autoCategory && meta.userCategory !== meta.autoCategory && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>(自动: {meta.autoCategory})</span>
                  )}
                </div>
              )}
              {/* 标签 */}
              {meta.tags && meta.tags.length > 0 && (
                <div className="skill-meta-row">
                  <span className="skill-detail-label" style={{ minWidth: 60 }}>标签</span>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {meta.tags.map((tag, i) => <span key={i} className="skill-meta-tag">{tag}</span>)}
                  </div>
                </div>
              )}
              {/* 可信度 + 分析时间 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                {meta.confidence && <span>可信度: <span style={{ color: meta.confidence === 'high' ? 'var(--accent-green)' : meta.confidence === 'medium' ? 'var(--accent-yellow)' : 'var(--accent-red)' }}>
                  {meta.confidence === 'high' ? '高' : meta.confidence === 'medium' ? '中' : '低'}
                </span></span>}
                {meta.generatedAt && <span>分析时间: {new Date(meta.generatedAt).toLocaleString('zh-CN')}</span>}
              </div>
            </div>
          )}
        </section>
        </>}

        {/* V5.2 使用关系树 */}
        {activeDetailTab === 'commands' && <section className="skill-detail-section">
          <div className="skill-detail-section-title">
            使用关系
            <span className="skill-detail-count">
              {skill.hotkeyRefs.length} 快捷键 · {skill.menuRefs.length} 菜单
            </span>
          </div>
          {usageTree ? (
            <div className="usage-tree-container">
              {renderUsageTreeNode(usageTree)}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>
              {skill.hotkeyRefs.length === 0 && skill.menuRefs.length === 0
                ? '暂无引用'
                : <div>
                    {skill.hotkeyRefs.map((ref, idx) => (
                      <div key={idx} className="skill-detail-ref-row" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', borderBottom: idx < skill.hotkeyRefs.length - 1 ? '1px solid var(--border-color)' : 'none', flexWrap: 'wrap' }}>
                        <code className="skill-detail-ref-key" style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{ref.key}</code>
                        <span className="skill-detail-ref-arrow" style={{ color: 'var(--text-muted)' }}>→</span>
                        <code className="skill-detail-ref-cmd">{ref.command}</code>
                        <span className="skill-detail-ref-type" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{ref.type}</span>
                        <span className="skill-detail-ref-source" style={{ fontSize: 10, color: 'var(--text-muted)' }}>({ref.source}, 行 {ref.lineNumber})</span>
                        <div className="skill-detail-ref-actions" style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
                          {onJumpToHotkey && <button className="btn btn-sm" onClick={() => onJumpToHotkey(ref.key)} title="跳转" style={{ fontSize: 10, padding: '2px 6px' }}>跳转</button>}
                          {onEditHotkey && <button className="btn btn-sm" onClick={() => onEditHotkey(ref.key)} title="编辑" style={{ fontSize: 10, padding: '2px 6px' }}>编辑</button>}
                          {onDeleteHotkeyBinding && <button className="btn btn-sm" onClick={() => onDeleteHotkeyBinding(ref)} title="删除" style={{ fontSize: 10, padding: '2px 6px', color: 'var(--accent-red)' }}>删除</button>}
                          {onViewEnvRawLine && <button className="btn btn-sm" onClick={() => onViewEnvRawLine(ref.source, ref.lineNumber)} title="查看 env 原始行" style={{ fontSize: 10, padding: '2px 6px' }}>原文</button>}
                        </div>
                      </div>
                    ))}
                    {skill.menuRefs.map((ref, idx) => (
                      <div key={`menu-${idx}`} className="skill-detail-ref-row" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0' }}>
                        <span style={{ fontSize: 11 }}>菜单</span>
                        <span className="skill-detail-menu-path" style={{ fontSize: 12 }}>{ref.path}</span>
                        <code className="skill-detail-ref-cmd" style={{ fontSize: 11 }}>{ref.command}</code>
                      </div>
                    ))}
                  </div>
              }
            </div>
          )}
        </section>}

        {/* V5.2 配置文件 */}
        {activeDetailTab === 'files' && (
          <section className="skill-detail-section">
            <div className="skill-detail-section-title">
              配置文件
              <span className="skill-detail-count">{configFiles?.length || 0} 个</span>
            </div>
            {configFiles && configFiles.length > 0 ? <div className="config-files-list">
              {configFiles.map((cf, idx) => (
                <div key={idx} className="config-file-row">
                  <span className="config-file-icon">文件</span>
                  <span className="config-file-name">{cf.fileName}</span>
                  <span className="config-file-status" style={{
                    color: cf.exists ? 'var(--accent-green)' : 'var(--text-muted)',
                  }}>
                    {cf.exists ? '存在' : '不存在'}
                  </span>
                  {cf.size && (
                    <span className="config-file-size">{cf.size > 1024 ? `${(cf.size / 1024).toFixed(1)} KB` : `${cf.size} B`}</span>
                  )}
                  {cf.isReadonly && <span className="badge badge-info" style={{ fontSize: 9 }}>只读</span>}
                </div>
              ))}
            </div> : <div className="skill-detail-placeholder">未发现配套配置文件。</div>}
            <div className="skill-file-summary">
              <div><span>Skill 文件</span><code title={skill.path}>{skill.path}</code></div>
              <div><span>加载状态</span><strong style={{ color: loadDisplay.color }}>{loadDisplay.label}</strong></div>
              <div><span>文件大小</span><strong>{fileSizeStr}</strong></div>
              <div><span>最后修改</span><strong>{lastModifiedStr}</strong></div>
            </div>
          </section>
        )}

        {activeDetailTab === 'commands' && <>
        {/* 函数统计 */}
        <section className="skill-detail-section">
          <div className="skill-detail-section-title">
            函数统计
            <span className="skill-detail-count">{skill.totalFunctionCount} 个函数</span>
          </div>
          <div className="skill-detail-stat-cards">
            <div className="skill-detail-stat-card">
              <div className="skill-detail-stat-value" style={{ color: 'var(--accent-green)' }}>{skill.entryCommands.length}</div>
              <div className="skill-detail-stat-label">入口命令</div>
            </div>
            <div className="skill-detail-stat-card">
              <div className="skill-detail-stat-value" style={{ color: 'var(--accent-yellow)' }}>{skill.internalFunctions.length}</div>
              <div className="skill-detail-stat-label">内部函数</div>
            </div>
            <div className="skill-detail-stat-card">
              <div className="skill-detail-stat-value" style={{ color: 'var(--accent-blue)' }}>{skill.totalFunctionCount}</div>
              <div className="skill-detail-stat-label">总计</div>
            </div>
          </div>
        </section>

        {/* 入口命令列表 */}
        {skill.entryCommands.length > 0 && (
          <section className="skill-detail-section">
            <div className="skill-detail-section-title">
              入口命令
              <span className="skill-detail-count">{skill.entryCommands.length} 个</span>
            </div>
            <div className="skill-detail-command-list">
              {skill.entryCommands.map((cmd, idx) => (
                <div key={idx} className="skill-detail-command-row">
                  <div className="skill-detail-command-info">
                    <code className="skill-detail-command-name">{cmd.name}</code>
                    <span className={`badge ${cmd.commandKind === 'axl_registered' ? 'badge-success' : 'badge-info'}`}>
                      {cmd.commandKind === 'axl_registered' ? 'axl注册' : cmd.commandKind}
                    </span>
                    {cmd.handlerFunction && (
                      <span className="skill-detail-handler-hint" style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
                        → 执行函数: {cmd.handlerFunction}
                      </span>
                    )}
                    {cmd.conflictStatus === 'duplicate_command' && (
                      <span className="badge badge-error" style={{ fontSize: 10 }}>冲突</span>
                    )}
                    {cmd.hotkeys.length > 0 && (
                      <span className="skill-detail-hotkey-hint">键位：{cmd.hotkeys.join(', ')}</span>
                    )}
                  </div>
                  <div className="skill-detail-command-actions">
                    {onCopyCommand && <button className="btn btn-sm" onClick={() => onCopyCommand(cmd.name)} title="复制命令名">复制</button>}
                    {onBindHotkey && <button className="btn btn-sm" onClick={() => onBindHotkey(cmd.name)} title="绑定快捷键">绑定</button>}
                    {onAddMenu && <button className="btn btn-sm" onClick={() => onAddMenu(cmd.name)} title="添加菜单入口">菜单</button>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 内部函数列表 */}
        {skill.internalFunctions.length > 0 && (
          <section className="skill-detail-section">
            <details>
              <summary className="skill-detail-section-title" style={{ cursor: 'pointer' }}
                onClick={(e) => { e.preventDefault(); setShowInternals(!showInternals); }}>
                内部函数
                <span className="skill-detail-count">{skill.internalFunctions.length} 个</span>
              </summary>
              {showInternals && <div className="skill-detail-function-list">
                {skill.internalFunctions.slice(0, 20).map((fn, idx) => (
                  <div key={idx} className="skill-detail-function-row">
                    <code className="skill-detail-function-name">{fn.name}</code>
                    <span className="badge badge-info" style={{ fontSize: 10 }}>{fn.type}</span>
                    <span className="skill-detail-line">L{fn.lineNumber}</span>
                    <span className="skill-detail-reason" title={fn.reason}>{fn.reason}</span>
                  </div>
                ))}
                {skill.internalFunctions.length > 20 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 0' }}>
                    ... 还有 {skill.internalFunctions.length - 20} 个内部函数
                  </div>
                )}
              </div>}
            </details>
          </section>
        )}

        {/* 引用检查结果 */}
        <section className="skill-detail-section">
          <div className="skill-detail-section-title">
            引用检查
            <span className="skill-detail-count">{refIssues ? `${refIssues.length} 个问题` : '—'}</span>
          </div>
          {!refIssues || refIssues.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>无相关问题</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {refStats && (
                <div style={{ display: 'flex', gap: 12, fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--accent-red)' }}>错误 {refStats.errors}</span>
                  <span style={{ color: 'var(--accent-yellow)' }}>警告 {refStats.warnings}</span>
                  <span style={{ color: 'var(--accent-cyan)' }}>信息 {refStats.infos}</span>
                </div>
              )}
              {refIssues.slice(0, 5).map((issue) => (
                <div key={issue.id} style={{
                  padding: '6px 8px', background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  borderLeft: `3px solid ${issue.severity === 'error' ? 'var(--accent-red)' : issue.severity === 'warning' ? 'var(--accent-yellow)' : 'var(--accent-cyan)'}`,
                  borderRadius: 'var(--radius-sm)', fontSize: 12, opacity: issue.ignored ? 0.4 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>{issue.severity === 'error' ? '错误' : issue.severity === 'warning' ? '警告' : '信息'}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.title}</span>
                  </div>
                  {issue.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{issue.description}</div>}
                </div>
              ))}
              {refIssues.length > 5 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 0' }}>
                  还有 {refIssues.length - 5} 个问题
                  {onNavigateToRefs && <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={onNavigateToRefs}>查看全部</button>}
                </div>
              )}
            </div>
          )}
        </section>
        </>}

        {/* 操作按钮 */}
        {activeDetailTab === 'maintenance' && <section className="skill-detail-section skill-maintenance-section">
          <div className="skill-detail-section-title">操作</div>
          <p className="skill-detail-maintenance-hint">所有文件写入操作都必须先生成 Apply Plan，并在确认后执行。</p>
          <div className="skill-detail-actions">
            {!isCompany && (
              <button className="btn btn-primary btn-sm" onClick={() => onToggle(skill.path, !skill.enabled)}>
                {skill.enabled ? '禁用' : '启用'}
              </button>
            )}
            {onBindHotkey && <button className="btn btn-sm" onClick={() => onBindHotkey('')}>绑定快捷键</button>}
            {onAddMenu && <button className="btn btn-sm" onClick={() => onAddMenu('')}>添加菜单入口</button>}
            {onAddToLoader && !skill.enabled && <button className="btn btn-sm" onClick={() => onAddToLoader(skill.path)}>加入 Loader</button>}
            {onOpenFileLocation && <button className="btn btn-sm" onClick={() => onOpenFileLocation(skill.path)}>打开文件位置</button>}
            {onReParse && <button className="btn btn-sm" onClick={() => onReParse(skill.path)}>重新解析</button>}
            {onGenerateReadme && <button className="btn btn-sm" onClick={() => onGenerateReadme(skill)}>生成说明</button>}
            {onExportPackage && <button className="btn btn-sm" onClick={() => onExportPackage(skill)}>导出包</button>}
          </div>
          {onDelete && !isCompany && (
            <div className="skill-danger-zone">
              <div><strong>危险操作</strong><span>删除前将先分析快捷键和菜单引用。</span></div>
              <button className="btn btn-sm atm-btn-danger" onClick={() => onDelete(skill)}>删除 Skill</button>
            </div>
          )}
        </section>}
      </div>
    </div>
  );
};

export default SkillDetailSidebar;
