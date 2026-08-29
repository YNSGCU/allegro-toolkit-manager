/**
 * ATM - 统一工作区方案页面（V6.2）
 *
 * 把「Allegro 环境 + 快捷键方案 + Skill 方案 + 菜单方案 + 配色方案」绑定为
 * 一个工作区方案。支持：创建/复制/重命名/删除、统一预览、按序统一应用。
 *
 * 应用编排复用各模块既有 Apply Plan API（skill-profile / menu / hotkey / color），
 * 本页只负责顺序串联与结果汇总，不绕过任何既有写入链路。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Download, Plus, Settings2, Trash2, Upload } from 'lucide-react';
import type {
  WorkspaceApplyPlanView,
  WorkspaceBindingOptions,
  WorkspaceImportPreview,
  WorkspaceProfile,
  WorkspaceProfileBindings,
  WorkspaceProfileStore,
} from '../types/workspaceProfile';
import type { WorkspacePreview } from '../../core/workspace/buildWorkspacePreview';
import ConfirmDialog from '../components/common/ConfirmDialog';
import BusinessDialog from '../shared/ui/overlays/BusinessDialog';
import ToastContainer, { useToast } from '../components/common/Toast';
import { formatUserError, WorkspaceHeader, WorkspacePage } from '../shared/ui';
import './unified-workspace-page.css';

const MODULE_LABELS: Record<string, string> = {
  skill: 'Skill 方案',
  menu: '菜单方案',
  hotkey: '快捷键方案',
  color: '配色方案',
};

const EMPTY_BINDINGS: WorkspaceProfileBindings = {
  environmentId: undefined,
  hotkeyProfileId: '',
  skillProfileId: '',
  menuProfileId: '',
  colorSchemeId: undefined,
};

const UnifiedWorkspacePage: React.FC = () => {
  const { toasts, addToast, removeToast } = useToast();
  const [store, setStore] = useState<WorkspaceProfileStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<WorkspacePreview | null>(null);
  const [applyPlan, setApplyPlan] = useState<WorkspaceApplyPlanView | null>(null);
  const [applyTarget, setApplyTarget] = useState<WorkspaceProfile | null>(null);
  const [applying, setApplying] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceProfile | null>(null);
  const [applyVisibility, setApplyVisibility] = useState(false);
  const [editTarget, setEditTarget] = useState<WorkspaceProfile | null>(null);
  const [bindingOptions, setBindingOptions] = useState<WorkspaceBindingOptions | null>(null);
  const [bindingDraft, setBindingDraft] = useState<WorkspaceProfileBindings>(EMPTY_BINDINGS);
  const [bindingLoading, setBindingLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<WorkspaceImportPreview | null>(null);
  const [importName, setImportName] = useState('');
  const [importing, setImporting] = useState(false);

  const activeWorkspace = useMemo<WorkspaceProfile | null>(() => {
    if (!store) return null;
    return (
      store.workspaces.find((item) => item.id === store.activeWorkspaceId) ??
      store.workspaces[0] ??
      null
    );
  }, [store]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.atm.workspaceLoadAll();
      if (res.success && res.data) {
        setStore(res.data);
      } else {
        addToast('error', res.error || '加载工作区失败');
      }
    } catch (err) {
      addToast('error', formatUserError(err, '加载工作区失败'));
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const res = await window.atm.workspaceCreate(newName.trim());
    if (res.success && res.data) {
      addToast('success', `已创建工作区「${res.data.name}」`);
      setNewName('');
      setCreateOpen(false);
      await reload();
      await openEdit(res.data);
    } else {
      addToast('error', res.error || '创建工作区失败');
    }
  };

  const handleCopy = async (workspace: WorkspaceProfile) => {
    const res = await window.atm.workspaceCopy(workspace.id);
    if (res.success && res.data) {
      addToast('success', `已复制工作区「${res.data.name}」`);
      await reload();
    } else {
      addToast('error', res.error || '复制工作区失败');
    }
  };

  const loadBindingOptions = async (environmentId?: string) => {
    setBindingLoading(true);
    try {
      const res = await window.atm.workspaceBindingOptions(environmentId);
      if (!res.success || !res.data) throw new Error(res.error || '加载绑定选项失败');
      setBindingOptions(res.data);
      return res.data;
    } catch (err) {
      addToast('error', formatUserError(err, '加载绑定选项失败'));
      return null;
    } finally {
      setBindingLoading(false);
    }
  };

  const openEdit = async (workspace: WorkspaceProfile) => {
    setEditTarget(workspace);
    setBindingDraft({
      environmentId: workspace.environmentId,
      hotkeyProfileId: workspace.hotkeyProfileId,
      skillProfileId: workspace.skillProfileId,
      menuProfileId: workspace.menuProfileId,
      colorSchemeId: workspace.colorSchemeId,
    });
    const options = await loadBindingOptions(workspace.environmentId);
    if (!workspace.environmentId && options?.environmentId) {
      setBindingDraft((current) => ({ ...current, environmentId: options.environmentId }));
    }
  };

  const handleEnvironmentBindingChange = async (environmentId: string) => {
    setBindingDraft({
      ...EMPTY_BINDINGS,
      environmentId: environmentId || undefined,
      colorSchemeId: bindingDraft.colorSchemeId,
    });
    await loadBindingOptions(environmentId || undefined);
  };

  const handleBindingSave = async () => {
    if (!editTarget) return;
    const res = await window.atm.workspaceUpdate(editTarget.id, bindingDraft);
    if (res.success) {
      addToast('success', `已更新工作区「${editTarget.name}」`);
      setEditTarget(null);
      setBindingOptions(null);
      await reload();
    } else {
      addToast('error', res.error || '更新工作区失败');
    }
  };

  const handleSwitch = async (workspaceId: string) => {
    const res = await window.atm.workspaceSetActive(workspaceId);
    if (res.success && res.data) {
      await reload();
    } else {
      addToast('error', res.error || '切换工作区失败');
    }
  };

  const handleRename = async (workspace: WorkspaceProfile) => {
    const name = window.prompt('重命名工作区', workspace.name);
    if (!name || name.trim() === '' || name.trim() === workspace.name) return;
    const res = await window.atm.workspaceRename(workspace.id, name.trim());
    if (res.success) {
      addToast('success', '已重命名工作区');
      await reload();
    } else {
      addToast('error', res.error || '重命名失败');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await window.atm.workspaceDelete(deleteTarget.id);
    if (res.success) {
      addToast('success', `已删除工作区「${deleteTarget.name}」`);
      setDeleteTarget(null);
      await reload();
    } else {
      addToast('error', res.error || '删除失败');
    }
  };

  const handleExport = async (workspace: WorkspaceProfile) => {
    try {
      const res = await window.atm.workspaceExport(workspace.id);
      if (res.success && res.data) {
        addToast('success', `已导出工作区「${workspace.name}」到 ${res.data.fileName}`);
      } else if (res.success && !res.data) {
        addToast('info', '已取消导出');
      } else {
        addToast('error', res.error || '导出工作区失败');
      }
    } catch (err) {
      addToast('error', formatUserError(err, '导出工作区失败'));
    }
  };

  const handleImportOpen = async () => {
    setImportPreview(null);
    try {
      const res = await window.atm.workspaceImportOpen();
      if (res.success && res.data) {
        setImportPreview(res.data);
        setImportName(res.data.name);
      } else if (res.success && !res.data) {
        addToast('info', '已取消选择');
      } else {
        addToast('error', res.error || '读取工作区方案失败');
      }
    } catch (err) {
      addToast('error', formatUserError(err, '读取工作区方案失败'));
    }
  };

  const handleImportCommit = async () => {
    if (!importPreview) return;
    setImporting(true);
    try {
      const res = await window.atm.workspaceImportCommit(
        importPreview.filePath,
        importName.trim() || undefined,
      );
      if (res.success && res.data) {
        addToast('success', `已导入工作区「${res.data.workspace.name}」`);
        setImportPreview(null);
        setImportName('');
        await reload();
      } else {
        addToast('error', res.error || '导入工作区失败');
      }
    } catch (err) {
      addToast('error', formatUserError(err, '导入工作区失败'));
    } finally {
      setImporting(false);
    }
  };

  const handlePreview = async (workspace: WorkspaceProfile) => {
    setPreview(null);
    try {
      const res = await window.atm.workspacePreview(workspace.id);
      if (res.success && res.data) {
        setPreview(res.data.preview);
      } else {
        addToast('error', res.error || '生成预览失败');
      }
    } catch (err) {
      addToast('error', formatUserError(err, '生成预览失败'));
    }
  };

  const handleApply = async (workspace: WorkspaceProfile) => {
    if (applying) return;
    setApplyPlan(null);
    try {
      const res = await window.atm.workspaceApplyPlan(workspace.id, { applyVisibility });
      if (res.success && res.data) {
        setApplyTarget(workspace);
        setApplyPlan(res.data);
      } else {
        addToast('error', res.error || '生成应用计划失败');
      }
    } catch (err) {
      addToast('error', formatUserError(err, '生成应用计划失败'));
    }
  };

  /** 按序执行各模块 Apply Plan（复用各模块既有 API） */
  const executeSteps = async (workspace: WorkspaceProfile) => {
    if (!applyPlan) return;
    if (applyPlan.sequence.blocked) {
      addToast('error', applyPlan.sequence.blockedReason || '工作区无可应用方案');
      return;
    }
    setApplying(true);
    let completedSteps = 0;
    try {
      // 确认后、首个写入前再次向主进程校验环境锁与方案存在性，关闭 TOCTOU 窗口。
      const latestRes = await window.atm.workspaceApplyPlan(workspace.id, { applyVisibility });
      if (!latestRes.success || !latestRes.data) {
        throw new Error(latestRes.error || '重新校验工作区失败');
      }
      const latestPlan = latestRes.data;
      const reviewedSignature = JSON.stringify({
        order: applyPlan.sequence.order.map((item) => item.module),
        env: applyPlan.env,
        blocked: applyPlan.sequence.blocked,
      });
      const latestSignature = JSON.stringify({
        order: latestPlan.sequence.order.map((item) => item.module),
        env: latestPlan.env,
        blocked: latestPlan.sequence.blocked,
      });
      if (reviewedSignature !== latestSignature) {
        setApplyPlan(latestPlan);
        addToast('warning', latestPlan.sequence.blocked
          ? latestPlan.sequence.blockedReason || '工作区状态已变化，请处理后重新确认'
          : '工作区环境或方案状态已变化，请重新审阅后确认');
        return;
      }

      for (const step of latestPlan.sequence.order) {
        let ok = false;
        let message = '';
        switch (step.module) {
          case 'skill': {
            const loaded = await window.atm.skillProfileLoadAll();
            const profile = loaded.data?.profiles?.find((p: { id: string }) => p.id === workspace.skillProfileId);
            if (!profile) throw new Error('Skill 方案不存在');
            const planRes = await window.atm.skillProfileCreateApplyPlan(JSON.stringify(profile));
            if (!planRes.success || !planRes.data) throw new Error(planRes.error || '生成 Skill 计划失败');
            const execRes = await window.atm.skillProfileExecuteApplyPlan(JSON.stringify(planRes.data));
            ok = execRes.success;
            message = execRes.success ? 'Skill 方案已应用' : execRes.error || 'Skill 方案执行失败';
            break;
          }
          case 'menu': {
            const loaded = await window.atm.menuLoadProfiles();
            const profile = loaded.data?.profiles?.find((p: { id: string }) => p.id === workspace.menuProfileId);
            if (!profile) throw new Error('菜单方案不存在');
            const planRes = await window.atm.menuCreateApplyPlan(JSON.stringify(profile));
            if (!planRes.success || !planRes.data) throw new Error(planRes.error || '生成菜单计划失败');
            const execRes = await window.atm.menuExecuteApplyPlan(JSON.stringify(planRes.data));
            ok = execRes.success;
            message = execRes.success ? '菜单方案已应用' : execRes.error || '菜单方案执行失败';
            break;
          }
          case 'hotkey': {
            const envFilePath = latestPlan.env.envFilePath;
            if (!envFilePath) throw new Error('未找到可编辑的 env 文件');
            const planRes = await window.atm.createApplyPlan(envFilePath, workspace.hotkeyProfileId);
            if (!planRes.success || !planRes.data) throw new Error(planRes.error || '生成快捷键计划失败');
            const execRes = await window.atm.applyPlan(JSON.stringify(planRes.data));
            ok = execRes.success;
            message = execRes.success ? '快捷键方案已应用' : execRes.error || '快捷键方案执行失败';
            break;
          }
          case 'color': {
            if (!workspace.colorSchemeId) throw new Error('未绑定配色方案');
            const execRes = await window.atm.colorApply(workspace.colorSchemeId, applyVisibility);
            ok = execRes.success;
            message = execRes.success ? '配色方案已应用' : execRes.error || '配色方案执行失败';
            break;
          }
        }
        if (!ok) {
          addToast('error', `${MODULE_LABELS[step.module]}应用失败：${message}`);
          break;
        }
        completedSteps += 1;
        addToast('success', message);
      }
      addToast('info', `已完成 ${completedSteps}/${latestPlan.sequence.order.length} 个步骤`);
      setApplyPlan(null);
      setApplyTarget(null);
    } catch (err) {
      addToast('error', formatUserError(err, '应用工作区失败'));
    } finally {
      setApplying(false);
    }
  };

  return (
    <WorkspacePage className="unified-workspace-page">
      <WorkspaceHeader
        eyebrow="Workspace"
        title="工作区方案"
        description="绑定 Allegro 环境与快捷键 / Skill / 菜单 / 配色方案，一次选择、统一应用"
        actions={
          <>
            <button
              type="button"
              className="btn"
              onClick={() => void handleImportOpen()}
            >
              <Upload aria-hidden="true" />
              导入方案
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setNewName('');
                setCreateOpen(true);
              }}
            >
              <Plus aria-hidden="true" />
              新建工作区
            </button>
          </>
        }
      />

      {loading ? (
        <div className="workspace-empty">正在加载工作区…</div>
      ) : !store || store.workspaces.length === 0 ? (
        <div className="workspace-empty">
          <p>还没有工作区方案。</p>
          <p>点击「新建工作区」，再在对应页面绑定快捷键 / Skill / 菜单 / 配色方案。</p>
        </div>
      ) : (
        <div className="workspace-grid">
          <div className="workspace-list">
            {store.workspaces.map((workspace) => {
              const isActive = workspace.id === store.activeWorkspaceId;
              return (
                <div
                  key={workspace.id}
                  className={`workspace-card${isActive ? ' is-active' : ''}`}
                  onClick={() => void handleSwitch(workspace.id)}
                >
                  <div className="workspace-card-head">
                    <strong>{workspace.name}</strong>
                    {isActive && <span className="workspace-active-badge">当前</span>}
                  </div>
                  <div className="workspace-card-meta">
                    {workspace.environmentId ? `环境 ${workspace.environmentId}` : '未绑定环境'}
                    {' · '}
                    {[
                      workspace.hotkeyProfileId && '快捷键',
                      workspace.skillProfileId && 'Skill',
                      workspace.menuProfileId && '菜单',
                      workspace.colorSchemeId && '配色',
                    ].filter(Boolean).join(' / ') || '未绑定方案'}
                  </div>
                  <div className="workspace-card-actions">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handlePreview(workspace);
                      }}
                    >
                      预览
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleApply(workspace);
                      }}
                      disabled={applying}
                    >
                      应用此工作区
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleRename(workspace);
                      }}
                    >
                      重命名
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      aria-label={`导出 ${workspace.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleExport(workspace);
                      }}
                    >
                      <Download aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      aria-label={`复制 ${workspace.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleCopy(workspace);
                      }}
                    >
                      <Copy aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      aria-label={`配置 ${workspace.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void openEdit(workspace);
                      }}
                    >
                      <Settings2 aria-hidden="true" />
                    </button>
                    {workspace.id !== 'default' && !isActive && (
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        aria-label={`删除 ${workspace.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteTarget(workspace);
                        }}
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {activeWorkspace && (
            <div className="workspace-apply-panel">
              <h4>应用选项</h4>
              <label className="workspace-apply-option">
                <input
                  type="checkbox"
                  checked={applyVisibility}
                  onChange={(event) => setApplyVisibility(event.target.checked)}
                />
                <span>配色应用时同时复制图层可见性</span>
              </label>
              <p className="workspace-apply-note">
                应用顺序：Skill → 菜单 → 快捷键 → 配色。每一步仍走各自的 Apply Plan 确认与备份回滚。
              </p>
            </div>
          )}
        </div>
      )}

      {/* 预览弹窗 */}
      <BusinessDialog
        open={Boolean(preview)}
        title="工作区预览"
        description={preview ? `「${preview.workspaceName}」绑定的环境与方案` : ''}
        onClose={() => setPreview(null)}
        footer={
          <button type="button" className="btn" onClick={() => setPreview(null)}>
            关闭
          </button>
        }
      >
        {preview && (
          <div className="workspace-preview-body">
            <div className="workspace-preview-env">
              环境：{preview.environment?.name || preview.environment?.environmentId || '未绑定'}
              {preview.environment?.allegroVersion ? ` · Allegro ${preview.environment.allegroVersion}` : ''}
              {preview.environment?.pcbenvPath ? ` · ${preview.environment.pcbenvPath}` : ''}
            </div>
            {[
              { key: 'hotkey' as const, label: '快捷键方案', item: preview.hotkey },
              { key: 'skill' as const, label: 'Skill 方案', item: preview.skill },
              { key: 'menu' as const, label: '菜单方案', item: preview.menu },
              { key: 'color' as const, label: '配色方案', item: preview.color },
            ].map(({ label, item }) => (
              <div key={label} className="workspace-preview-row">
                <span className="workspace-preview-label">{label}</span>
                {item ? (
                  <span className={item.exists ? '' : 'is-missing'}>
                    {item.name}
                    {item.detail ? ` · ${item.detail}` : ''}
                    {item.missing ? ` · ${item.missing}` : ''}
                  </span>
                ) : (
                  <span className="is-muted">未绑定</span>
                )}
              </div>
            ))}
            <p className="workspace-preview-total">共 {preview.totalItems} 个已绑定方案</p>
          </div>
        )}
      </BusinessDialog>

      {/* 应用确认 */}
      <BusinessDialog
        open={Boolean(applyPlan)}
        title="应用工作区"
        description={applyPlan ? `按顺序应用「${applyTarget?.name ?? ''}」的 ${applyPlan.sequence.order.length} 个方案` : ''}
        onClose={() => {
          if (!applying) {
            setApplyPlan(null);
            setApplyTarget(null);
          }
        }}
        footer={
          <>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setApplyPlan(null);
                setApplyTarget(null);
              }}
              disabled={applying}
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void executeSteps(applyTarget!)}
              disabled={applying || !applyPlan || !applyTarget || applyPlan.sequence.blocked}
            >
              {applying ? '应用中…' : '确认应用'}
            </button>
          </>
        }
      >
        {applyPlan && (
          <div className="workspace-apply-steps">
            {applyPlan.sequence.blocked ? (
              <p className="workspace-apply-blocked">{applyPlan.sequence.blockedReason}</p>
            ) : (
              applyPlan.sequence.order.map((step, index) => (
                <div key={step.module} className="workspace-apply-step">
                  <span className="workspace-apply-index">{index + 1}</span>
                  <span>{step.label}</span>
                </div>
              ))
            )}
            {applyPlan.sequence.warnings.map((warning) => (
              <p key={warning} className="workspace-apply-warning">{warning}</p>
            ))}
          </div>
        )}
      </BusinessDialog>

      {/* 工作区绑定配置 */}
      <BusinessDialog
        open={Boolean(editTarget)}
        title="配置工作区"
        description={editTarget ? `为「${editTarget.name}」绑定环境与四类方案` : ''}
        onClose={() => {
          if (!bindingLoading) {
            setEditTarget(null);
            setBindingOptions(null);
          }
        }}
        dismissDisabled={bindingLoading}
        footer={
          <>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setEditTarget(null);
                setBindingOptions(null);
              }}
              disabled={bindingLoading}
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleBindingSave()}
              disabled={bindingLoading || !bindingOptions}
            >
              保存绑定
            </button>
          </>
        }
      >
        <div className="workspace-binding-form">
          <label>
            <span>Allegro 环境</span>
            <select
              aria-label="Allegro 环境"
              value={bindingDraft.environmentId ?? ''}
              onChange={(event) => void handleEnvironmentBindingChange(event.target.value)}
              disabled={bindingLoading}
            >
              <option value="">未绑定环境</option>
              {bindingOptions?.environments.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          {[
            { key: 'hotkeyProfileId' as const, label: '快捷键方案', items: bindingOptions?.hotkeyProfiles ?? [] },
            { key: 'skillProfileId' as const, label: 'Skill 方案', items: bindingOptions?.skillProfiles ?? [] },
            { key: 'menuProfileId' as const, label: '菜单方案', items: bindingOptions?.menuProfiles ?? [] },
            { key: 'colorSchemeId' as const, label: '配色方案', items: bindingOptions?.colorSchemes ?? [] },
          ].map(({ key, label, items }) => (
            <label key={key}>
              <span>{label}</span>
              <select
                aria-label={label}
                value={bindingDraft[key] ?? ''}
                onChange={(event) => setBindingDraft((current) => ({
                  ...current,
                  [key]: event.target.value || (key === 'colorSchemeId' ? undefined : ''),
                }))}
                disabled={bindingLoading}
              >
                <option value="">未绑定</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
          ))}
          {bindingLoading && <p className="workspace-binding-loading">正在读取目标环境的方案…</p>}
        </div>
      </BusinessDialog>

      {/* 新建 */}
      <BusinessDialog
        open={createOpen}
        title="新建工作区"
        description="创建后可在各页面绑定对应方案"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setCreateOpen(false)}>
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleCreate()}
              disabled={!newName.trim()}
            >
              创建
            </button>
          </>
        }
      >
        <input
          type="text"
          className="profile-bar-input"
          placeholder="工作区名称（如：项目A / 4DDR3）"
          value={newName}
          autoFocus
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && newName.trim()) void handleCreate();
          }}
        />
      </BusinessDialog>

      {/* 导入确认 */}
      <BusinessDialog
        open={Boolean(importPreview)}
        title="导入工作区方案"
        description={importPreview ? `来自 ${importPreview.fileName}` : ''}
        onClose={() => {
          if (!importing) {
            setImportPreview(null);
            setImportName('');
          }
        }}
        footer={
          <>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setImportPreview(null);
                setImportName('');
              }}
              disabled={importing}
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleImportCommit()}
              disabled={importing || !importName.trim()}
            >
              {importing ? '正在导入…' : '确认导入'}
            </button>
          </>
        }
      >
        {importPreview && (
          <div className="workspace-import-body">
            <div className="ui-dialog-field">
              <label className="ui-dialog-field-label">方案名称</label>
              <input
                type="text"
                className="atm-input"
                value={importName}
                onChange={(event) => setImportName(event.target.value)}
                data-dialog-initial-focus
              />
            </div>
            {importPreview.description ? (
              <p className="ui-dialog-note">{importPreview.description}</p>
            ) : null}
            <div className="workspace-import-bindings">
              <span className="workspace-import-binding-label">包含绑定</span>
              <div className="workspace-import-binding-tags">
                {[
                  importPreview.hasHotkeyProfile && '快捷键方案',
                  importPreview.hasSkillProfile && 'Skill 方案',
                  importPreview.hasMenuProfile && '菜单方案',
                  importPreview.hasColorScheme && '配色方案',
                ].filter((label): label is string => Boolean(label)).map((label) => (
                  <span key={label} className="workspace-binding-tag">
                    {label}
                  </span>
                ))}
              </div>
              {!importPreview.hasHotkeyProfile
                && !importPreview.hasSkillProfile
                && !importPreview.hasMenuProfile
                && !importPreview.hasColorScheme ? (
                <p className="ui-dialog-note">该方案未绑定任何子方案（仅环境绑定或空方案）。</p>
              ) : null}
            </div>
            <p className="ui-dialog-note">
              导入会创建为新的工作区；若名称重复将自动追加「（导入）」，不会覆盖现有方案。
            </p>
          </div>
        )}
      </BusinessDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="删除工作区"
        message={deleteTarget ? `确定删除工作区「${deleteTarget.name}」？此操作只删除组合关系，不影响各方案内容。` : ''}
        variant="danger"
        confirmLabel="删除"
        cancelLabel="取消"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </WorkspacePage>
  );
};

export default UnifiedWorkspacePage;
