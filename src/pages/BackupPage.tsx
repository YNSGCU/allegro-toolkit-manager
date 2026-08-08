/**
 * ATM - 备份与恢复页面（V5.7）
 *
 * 功能：
 *   1. 将软件设置（快捷键 / Skill / 菜单方案、收藏、命令来源修正、配色方案、
 *      已应用状态、界面偏好等）打包为 .atmbak 文件
 *   2. 在新电脑 / 下一块板子上选择备份文件，预览后恢复
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Archive, DatabaseBackup, FolderOpen, RefreshCw, RotateCcw, Save } from 'lucide-react';
import type { EnvironmentInfo } from '../types/environment';
import type { BackupRestoreResult, BackupSectionId, BackupSummary } from '../types/backup';
import ConfirmDialog from '../components/common/ConfirmDialog';
import ToastContainer, { useToast } from '../components/common/Toast';
import { formatUserError, PageState, WorkspaceHeader, WorkspacePage } from '../shared/ui';
import './backup-page.css';

const UI_PREF_PREFIX = 'atm_';

/** 收集渲染进程中的界面偏好（localStorage 中 atm_ 前缀的键） */
function collectUiPreferences(): Record<string, string> {
  const prefs: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(UI_PREF_PREFIX)) {
        prefs[key] = localStorage.getItem(key) || '';
      }
    }
  } catch {
    // localStorage 不可用时静默跳过
  }
  return prefs;
}

/** 将备份中的界面偏好写回 localStorage */
function applyUiPreferences(prefs: Record<string, string>): void {
  try {
    for (const [key, value] of Object.entries(prefs)) {
      localStorage.setItem(key, value);
    }
  } catch {
    // 写回失败不影响主流程
  }
}

const SECTION_LABELS: Record<BackupSectionId, string> = {
  pcbenv: '板子配置',
  app: '应用级配置',
  ui: '界面偏好',
};

const BackupPage: React.FC = () => {
  const { toasts, addToast, removeToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [envInfo, setEnvInfo] = useState<EnvironmentInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [selectedSections, setSelectedSections] = useState<Record<BackupSectionId, boolean>>({
    pcbenv: true,
    app: true,
    ui: true,
  });
  const [includeEnvironments, setIncludeEnvironments] = useState(false);
  const [includeUpdateSettings, setIncludeUpdateSettings] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restored, setRestored] = useState<BackupRestoreResult | null>(null);

  const loadEnvironment = useCallback(async () => {
    setLoading(true);
    try {
      if (typeof window.atm === 'undefined') {
        throw new Error('未连接到 Electron 主进程，请在 ATM 桌面应用中打开。');
      }
      const result = await window.atm.locateEnvironment();
      if (result.success && result.data) {
        setEnvInfo(result.data);
      }
    } catch (loadError) {
      addToast('error', formatUserError(loadError, '加载环境信息失败'));
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void loadEnvironment();
  }, [loadEnvironment]);

  const handleCreateBackup = async () => {
    setBusy(true);
    try {
      let appVersion = 'unknown';
      try {
        const runtime = await window.atm.getRuntimeInfo();
        const rt = runtime as unknown as { data?: { appVersion?: string }; appVersion?: string };
        appVersion = rt?.data?.appVersion || rt?.appVersion || appVersion;
      } catch {
        // 版本信息缺失不阻塞备份
      }
      const result = await window.atm.createSettingsBackup(
        JSON.stringify(collectUiPreferences()),
        appVersion,
      );
      if (result.success && result.data) {
        addToast('success', `备份已保存：${result.data.filePath}`);
      } else if (result.success && !result.data) {
        addToast('info', result.info || '已取消保存');
      } else {
        addToast('error', result.error || '创建备份失败');
      }
    } catch (err) {
      addToast('error', formatUserError(err, '创建备份失败'));
    } finally {
      setBusy(false);
    }
  };

  const handleOpenBackup = async () => {
    try {
      const opened = await window.atm.openSettingsBackup();
      if (!opened.success) {
        addToast('error', opened.error || '打开备份文件失败');
        return;
      }
      if (!opened.data) {
        addToast('info', opened.info || '已取消选择');
        return;
      }
      setSelectedBackup(opened.data);
      setRestored(null);
      const inspected = await window.atm.inspectSettingsBackup(opened.data);
      if (inspected.success && inspected.data) {
        setSummary(inspected.data.summary);
      } else {
        setSummary(null);
        addToast('error', inspected.error || '无法解析备份文件');
      }
    } catch (err) {
      addToast('error', formatUserError(err, '打开备份文件失败'));
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup) return;
    setBusy(true);
    setConfirmOpen(false);
    try {
      const options = {
        sections: (Object.keys(selectedSections) as BackupSectionId[]).filter((id) => selectedSections[id]),
        includeEnvironments,
        includeUpdateSettings,
      };
      const result = await window.atm.restoreSettingsBackup(selectedBackup, JSON.stringify(options));
      if (result.success && result.data) {
        if (result.data.uiPreferences) {
          applyUiPreferences(result.data.uiPreferences);
        }
        setRestored(result.data);
        const windowRestored = result.data.restoredFiles.some((f) => f.toLowerCase().endsWith('window_state.json'));
        addToast('success', windowRestored ? '设置已恢复，当前窗口布局已同步还原；建议在快捷键/Skill/菜单页重新扫描确认。' : '设置已恢复；建议在快捷键/Skill/菜单页重新扫描确认。');
      } else {
        addToast('error', result.error || '恢复失败');
      }
    } catch (err) {
      addToast('error', formatUserError(err, '恢复失败'));
    } finally {
      setBusy(false);
    }
  };

  const hasSelectedSections = Boolean(
    summary && summary.sections.some((section) => selectedSections[section.id]),
  );

  const toggleSection = (id: BackupSectionId) => {
    setSelectedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const restoredSectionsText = (() => {
    if (!restored) return '';
    return restored.restoredSections.map((id) => SECTION_LABELS[id]).join('、');
  })();

  return (
    <WorkspacePage className="backup-page">
      <WorkspaceHeader
        eyebrow="数据迁移"
        title="备份与恢复"
        description="把软件设置打包带走：新电脑、下一块板子一键复用，无需重新配置。"
        actions={(
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleCreateBackup()}
            disabled={busy}
          >
            <Save aria-hidden="true" />
            {busy ? '处理中…' : '创建备份'}
          </button>
        )}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {loading ? (
        <PageState kind="loading" title="正在加载环境信息" description="正在确认当前板子配置目录。" />
      ) : (
        <div className="backup-page-grid">
          {/* ════════ 创建备份 ════════ */}
          <section className="backup-panel">
            <div className="backup-panel-title">
              <div>
                <h3><Archive aria-hidden="true" /> 创建备份</h3>
                <p className="backup-panel-subtitle">
                  将当前板子的设置与全局配置打包为单个 .atmbak 文件
                </p>
              </div>
            </div>

            <dl className="backup-env-list">
              <div className="backup-env-item">
                <dt>当前环境</dt>
                <dd>{envInfo?.environmentId || '未识别'}</dd>
              </div>
              <div className="backup-env-item">
                <dt>Allegro 版本</dt>
                <dd>{envInfo?.allegroVersion || '未知'}</dd>
              </div>
              <div className="backup-env-item">
                <dt>pcbenv 目录</dt>
                <dd title={envInfo?.pcbenvPath || ''}>{envInfo?.pcbenvPath || '未找到'}</dd>
              </div>
            </dl>

            <div className="backup-include-list">
              <h4>备份内容</h4>
              <ul>
                <li>快捷键方案、Skill 方案、菜单方案</li>
                <li>快捷键收藏、命令来源修正、Skill 元数据</li>
                <li>已应用方案状态、多 env 来源设置</li>
                <li>配色方案（跨板子全局资源）</li>
                <li>主窗口大小、位置与最大化状态</li>
                <li>界面偏好（冲突忽略列表等 UI 设置）</li>
              </ul>
            </div>

            <div className="backup-panel-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleCreateBackup()}
                disabled={busy || !envInfo?.pcbenvPath}
              >
                <Save aria-hidden="true" />
                创建备份
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => void loadEnvironment()}
                disabled={busy}
              >
                <RefreshCw aria-hidden="true" />
                重新检测
              </button>
            </div>
          </section>

          {/* ════════ 恢复 ════════ */}
          <section className="backup-panel">
            <div className="backup-panel-title">
              <div>
                <h3><DatabaseBackup aria-hidden="true" /> 恢复备份</h3>
                <p className="backup-panel-subtitle">
                  选择在其他电脑 / 板子上导出的备份文件，恢复到当前环境
                </p>
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => void handleOpenBackup()}
                disabled={busy}
              >
                <FolderOpen aria-hidden="true" />
                选择备份文件
              </button>
            </div>

            {!summary ? (
              <div className="backup-empty">
                <p>尚未选择备份文件。</p>
                <p className="backup-empty-hint">点击上方“选择备份文件”加载 .atmbak 备份。</p>
              </div>
            ) : (
              <>
                <div className="backup-summary-meta">
                  <span>创建时间：{summary.createdAt ? new Date(summary.createdAt).toLocaleString() : '未知'}</span>
                  <span>来源电脑：{summary.source.machineName}</span>
                  <span>来源环境：{summary.source.environmentName || '未知'}</span>
                  <span>Allegro：{summary.source.allegroVersion || '未知'}</span>
                </div>

                <div className="backup-section-list">
                  {summary.sections.map((section) => (
                    <label key={section.id} className="backup-section-item">
                      <input
                        type="checkbox"
                        checked={selectedSections[section.id]}
                        onChange={() => toggleSection(section.id)}
                      />
                      <div className="backup-section-copy">
                        <span className="backup-section-name">{section.label}</span>
                        <span className="backup-section-detail">
                          {section.details.map((d) => (
                            <span key={d.key}>
                              {d.label}{typeof d.count === 'number' ? ` × ${d.count}` : ''}
                            </span>
                          ))}
                        </span>
                      </div>
                    </label>
                  ))}
                  <span className="backup-summary-total">共 {summary.totalItems} 项设置</span>
                </div>

                {selectedSections.app && (
                  <div className="backup-app-options">
                    <label className="backup-check">
                      <input
                        type="checkbox"
                        checked={includeEnvironments}
                        onChange={(e) => setIncludeEnvironments(e.target.checked)}
                      />
                      <span>
                        同时恢复环境注册表
                        <em>新电脑路径通常不同，建议保持关闭并重新扫描环境</em>
                      </span>
                    </label>
                    <label className="backup-check">
                      <input
                        type="checkbox"
                        checked={includeUpdateSettings}
                        onChange={(e) => setIncludeUpdateSettings(e.target.checked)}
                      />
                      <span>
                        同时恢复更新源配置
                        <em>如需沿用原电脑的更新源地址可开启</em>
                      </span>
                    </label>
                  </div>
                )}

                <div className="backup-panel-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || !hasSelectedSections}
                    onClick={() => setConfirmOpen(true)}
                  >
                    <RotateCcw aria-hidden="true" />
                    恢复选中设置
                  </button>
                  {restored && (
                    <span className="backup-restored-hint">
                      已恢复：{restoredSectionsText}
                    </span>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="确认恢复设置？"
        message="恢复将覆盖当前板子的对应配置。恢复前会自动备份现有设置到 atm_generated/backups/，可手动回退。"
        detail={
          summary
            ? summary.sections
                .filter((s) => selectedSections[s.id])
                .map((s) => s.label)
                .join('、')
            : ''
        }
        variant="warning"
        confirmLabel="确认恢复"
        onConfirm={() => void handleRestore()}
        onCancel={() => setConfirmOpen(false)}
      />
    </WorkspacePage>
  );
};

export default BackupPage;
