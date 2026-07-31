/**
 * ATM - env 文件导入对话框（V4.0）
 *
 * 从外部 .env 文件导入快捷键的完整向导：
 *   步骤 1: 导入预览（文件信息、统计）
 *   步骤 2: 模式选择（四种导入方式）
 *   步骤 3: 冲突处理
 *   步骤 4: 确认执行
 */
import React, { useState, useMemo, useCallback } from 'react';
import type { HotkeyBinding, HotkeyProfile } from '../types/hotkey';
import type { EnvSourceList } from '../types/environment';
import type {
  EnvImportPreview,
  ImportMode,
  ImportConflictItem,
  ConflictResolution,
  ConflictType,
  ImportResult,
  EnvImportRole,
} from '../types/importEnv';

interface EnvImportDialogProps {
  preview: EnvImportPreview;
  currentBindings: HotkeyBinding[];
  currentProfile: HotkeyProfile | null;
  reservedBindings: HotkeyBinding[];
  pcbenvPath: string;
  userEnvFilePath?: string; // 用户 env 文件路径，用于高级合并
  envSources: EnvSourceList | null;
  profiles: HotkeyProfile[];
  activeProfileId: string;
  onClose: () => void;
  onImported: (result: ImportResult) => void;
}

// ── 辅助：冲突类型标签 ──
const CONFLICT_TYPE_LABEL: Record<ConflictType, string> = {
  duplicate: '重复项',
  conflict: '按键冲突',
  multi_binding: '多绑定',
  alias_conflict: 'Alias 冲突',
  reserved_override: '覆盖保留键',
};

const CONFLICT_TYPE_COLOR: Record<ConflictType, string> = {
  duplicate: 'var(--text-muted)',
  conflict: 'var(--accent-red)',
  multi_binding: 'var(--accent-blue)',
  alias_conflict: 'var(--accent-red)',
  reserved_override: 'var(--accent-yellow)',
};

const RESOLUTION_LABEL: Record<ConflictResolution, string> = {
  keep_current: '保留当前',
  use_imported: '使用导入',
  use_recommended_key: '改用推荐键位',
  skip: '跳过',
  import_disabled: '导入为禁用项',
  rename_alias: '改名导入',
};

// ── 辅助：Env 角色标签 ──
const ENV_ROLE_LABEL: Record<EnvImportRole, string> = {
  user_env: '用户 env',
  install_default_env: '安装默认 env',
  site_env: '站点 env',
  company_env: '公司 env',
  unknown: '未知类型',
};

const ENV_ROLE_COLOR: Record<EnvImportRole, string> = {
  user_env: 'var(--accent-green)',
  install_default_env: 'var(--accent-blue)',
  site_env: '#e67e22',
  company_env: '#9b59b6',
  unknown: 'var(--text-muted)',
};

const MODE_LABEL: Record<ImportMode, string> = {
  new_profile: '新建快捷键方案',
  merge_profile: '合并到当前方案',
  as_reference: '作为只读参考 env',
  merge_user_env: '高级合并到用户 env',
};

const MODE_DESC: Record<ImportMode, string> = {
  new_profile: '将导入的快捷键创建为新的快捷键方案，不修改当前 env',
  merge_profile: '将导入的快捷键合并到当前选中的方案中',
  as_reference: '将导入文件作为参考 env 来源，仅用于对比和覆盖检测',
  merge_user_env: '将导入的快捷键通过 Apply Plan 写入用户 env（需确认）',
};

const EnvImportDialog: React.FC<EnvImportDialogProps> = ({
  preview,
  currentBindings,
  currentProfile,
  reservedBindings,
  pcbenvPath,
  userEnvFilePath,
  envSources,
  profiles,
  activeProfileId,
  onClose,
  onImported,
}) => {
  // ── 内部状态 ──
  const [selectedMode, setSelectedMode] = useState<ImportMode>(() => getDefaultMode(preview.identifiedRole));
  const [step, setStep] = useState<'mode' | 'conflicts' | 'confirm'>(() =>
    preview.conflicts.length > 0 ? 'conflicts' : 'confirm',
  );
  const [resolutions, setResolutions] = useState<Record<string, ConflictResolution>>(() => {
    const init: Record<string, ConflictResolution> = {};
    for (const c of preview.conflicts) {
      init[c.id] = c.suggestedResolution;
    }
    return init;
  });
  const [showRoleConfirm, setShowRoleConfirm] = useState(false);
  const [pendingRole, setPendingRole] = useState<EnvImportRole>('unknown');
  const [pendingMode, setPendingMode] = useState<ImportMode | null>(null);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [applyPlan, setApplyPlan] = useState<any>(null);
  const [showApplyPlan, setShowApplyPlan] = useState(false);

  // ── 模式选择事件 ──
  const handleModeSelect = useCallback((mode: ImportMode) => {
    // 如果是 unknown 类型且用户选了参考模式以外的选项，弹出角色确认
    if (preview.identifiedRole === 'unknown' && mode !== 'as_reference') {
      setPendingRole('user_env');
      setPendingMode(mode);
      setShowRoleConfirm(true);
      return;
    }
    setSelectedMode(mode);
  }, [preview.identifiedRole]);

  const handleRoleConfirm = useCallback((role: EnvImportRole) => {
    setPendingRole(role);
    setShowRoleConfirm(false);
    // 角色确认后，同时设置 pending 的模式
    if (pendingMode) {
      setSelectedMode(pendingMode);
      setPendingMode(null);
    }
  }, [pendingMode]);

  // ── 冲突处理 ──
  const handleResolutionChange = useCallback((conflictId: string, resolution: ConflictResolution) => {
    setResolutions((prev) => ({ ...prev, [conflictId]: resolution }));
  }, []);

  const handleBatchResolve = useCallback((resolution: ConflictResolution) => {
    const newResolutions: Record<string, ConflictResolution> = {};
    for (const c of preview.conflicts) {
      newResolutions[c.id] = resolution;
    }
    setResolutions(newResolutions);
  }, [preview.conflicts]);

  const handleBatchKeepCurrent = useCallback(() => handleBatchResolve('keep_current'), [handleBatchResolve]);
  const handleBatchUseImported = useCallback(() => handleBatchResolve('use_imported'), [handleBatchResolve]);
  const handleBatchSkip = useCallback(() => handleBatchResolve('skip'), [handleBatchResolve]);
  const handleBatchNoConflicts = useCallback(() => {
    const newResolutions: Record<string, ConflictResolution> = {};
    for (const c of preview.conflicts) {
      if (c.conflictType === 'duplicate' || c.conflictType === 'multi_binding') {
        newResolutions[c.id] = 'skip';
      } else {
        newResolutions[c.id] = c.suggestedResolution;
      }
    }
    setResolutions(newResolutions);
  }, [preview.conflicts]);

  // ── 统计信息 ──
  const conflictStats = useMemo(() => {
    const byType: Record<ConflictType, number> = {
      duplicate: 0,
      conflict: 0,
      multi_binding: 0,
      alias_conflict: 0,
      reserved_override: 0,
    };
    for (const c of preview.conflicts) {
      byType[c.conflictType] = (byType[c.conflictType] || 0) + 1;
    }
    return byType;
  }, [preview.conflicts]);

  // ── 执行导入 ──
  const handleExecute = useCallback(async () => {
    setExecuting(true);
    setError(null);

    try {
      const params: any = {
        mode: selectedMode,
        filePath: preview.filePath,
        pcbenvPath,
        conflictResolutions: resolutions,
      };

      // 补充不同模式需要的参数
      if (selectedMode === 'new_profile') {
        const defaultName = `从 env 导入 - ${preview.displayName || '外部'}`;
        params.profileName = defaultName;
      }
      if (selectedMode === 'merge_profile') {
        params.profileId = activeProfileId;
      }
      if (preview.identifiedRole === 'unknown' && selectedMode !== 'as_reference') {
        params.userRole = pendingRole;
      }

      const apiResult = await window.atm.executeEnvImport(params);
      if (apiResult.success && apiResult.data) {
        setResult(apiResult.data);

        // merge_user_env 模式返回 ApplyPlan，需要展示
        if (selectedMode === 'merge_user_env' && apiResult.data.data) {
          setApplyPlan(apiResult.data.data);
          setShowApplyPlan(true);
          setExecuting(false);
          return;
        }

        onImported(apiResult.data);
      } else {
        setError(apiResult.error || '导入执行失败');
      }
    } catch (err) {
      setError('导入执行异常: ' + String(err));
    } finally {
      setExecuting(false);
    }
  }, [selectedMode, preview.filePath, preview.displayName, preview.identifiedRole, pcbenvPath, resolutions, activeProfileId, pendingRole, onImported]);

  // ── 高级合并：确认 ApplyPlan ──
  const handleConfirmApplyPlan = useCallback(async () => {
    setExecuting(true);
    try {
      // 使用实际 env 文件路径，而非拼凑路径
      const envPath = userEnvFilePath || pcbenvPath + '/env';
      const result = await window.atm.executeEditPlan(
        JSON.stringify(applyPlan),
        envPath,
      );
      if (result.success) {
        setShowApplyPlan(false);
        onImported({
          success: true,
          mode: 'merge_user_env',
          data: applyPlan,
          stats: { total: preview.totalHotkeys, added: applyPlan.steps.length - 1, skipped: 0, resolved: 0, conflicts: 0 },
        });
      } else {
        setError('执行 Apply Plan 失败: ' + (result.error || ''));
      }
    } catch (err) {
      setError('执行 Apply Plan 异常: ' + String(err));
    } finally {
      setExecuting(false);
    }
  }, [applyPlan, pcbenvPath, preview.totalHotkeys, onImported]);

  // ── 已执行完成 ──
  if (result && !showApplyPlan) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-dialog env-import-dialog" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3 style={{ margin: 0, fontSize: 15 }}>导入完成</h3>
            <button className="btn btn-sm" onClick={onClose}>关闭</button>
          </div>
          <div className="modal-body" style={{ padding: '16px 0' }}>
            <div className="card" style={{ padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 24, textAlign: 'center', marginBottom: 12 }}>
                {result.success ? '成功' : '失败'}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>导入模式</td>
                    <td style={{ padding: '4px 8px', fontWeight: 600 }}>{MODE_LABEL[result.mode]}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>快捷键总数</td>
                    <td style={{ padding: '4px 8px' }}>{result.stats.total}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>新增</td>
                    <td style={{ padding: '4px 8px', color: 'var(--accent-green)' }}>+{result.stats.added}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>跳过</td>
                    <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>{result.stats.skipped}</td>
                  </tr>
                  {result.stats.resolved > 0 && (
                    <tr>
                      <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>冲突解决</td>
                      <td style={{ padding: '4px 8px', color: 'var(--accent-yellow)' }}>{result.stats.resolved}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {result.error && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--bg-error-bg, #f8d7da)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-error, #721c24)' }}>
                  {result.error}
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
            <button className="btn btn-primary" onClick={onClose}>关闭</button>
          </div>
        </div>
      </div>
    );
  }

  // ── ApplyPlan 预览（高级合并时） ──
  if (showApplyPlan && applyPlan) {
    return (
      <div className="modal-overlay" onClick={() => setShowApplyPlan(false)}>
        <div className="modal-dialog env-import-dialog" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3 style={{ margin: 0, fontSize: 15 }}>Apply Plan 预览</h3>
            <button className="btn btn-sm" onClick={() => setShowApplyPlan(false)}>关闭</button>
          </div>
          <div className="modal-body" style={{ padding: '16px 0' }}>
            <div className="card" style={{ padding: 16, marginBottom: 12 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>{applyPlan.summary}</h4>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 12px' }}>
                ID: {applyPlan.id} | 创建时间: {applyPlan.createdAt}
                {applyPlan.requiresRestart && <span style={{ color: 'var(--accent-yellow)', marginLeft: 8 }}>需要重启 Allegro</span>}
              </p>
              <div style={{ fontSize: 13 }}>
                {(applyPlan.steps || []).map((step: any, i: number) => (
                  <div key={i} style={{
                    padding: '8px 12px',
                    marginBottom: 4,
                    background: 'var(--bg-code)',
                    borderRadius: 'var(--radius)',
                    borderLeft: '3px solid var(--accent-blue)',
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      {i + 1}. {step.description}
                    </div>
                    {step.after && (
                      <pre style={{
                        margin: 0,
                        padding: '6px 8px',
                        background: 'var(--bg-code-dark, #1e1e1e)',
                        borderRadius: 4,
                        fontSize: 12,
                        overflow: 'auto',
                        maxHeight: 100,
                      }}>
                        {step.after}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: '8px 12px', background: 'var(--bg-warning-bg, #fff3cd)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-warning, #856404)' }}>
              应用前已自动备份当前 env 文件。如需撤销，可在变更历史中操作。
            </div>
          </div>
          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
            <button className="btn" onClick={() => { setShowApplyPlan(false); setResult(null); }}>取消</button>
            <button className="btn btn-primary" onClick={handleConfirmApplyPlan} disabled={executing}>
              {executing ? '执行中...' : '确认应用'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 角色确认弹窗（unknown env 时） ──
  if (showRoleConfirm) {
    return (
      <div className="modal-overlay" onClick={() => setShowRoleConfirm(false)}>
        <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
          <div className="modal-header">
            <h3 style={{ margin: 0, fontSize: 15 }}>选择导入角色</h3>
            <button className="btn btn-sm" onClick={() => setShowRoleConfirm(false)}>关闭</button>
          </div>
          <div className="modal-body" style={{ padding: '12px 0' }}>
            <p style={{ fontSize: 13, margin: '0 0 12px', color: 'var(--text-muted)' }}>
              无法确定该 env 文件的类型。请选择将其作为：
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: 10,
                border: '1px solid var(--border-color)', borderRadius: 'var(--radius)',
                cursor: 'pointer', fontSize: 13,
              }}>
                <input
                  type="radio"
                  name="import-role"
                  checked={pendingRole === 'user_env'}
                  onChange={() => setPendingRole('user_env')}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>用户 env</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    导入为快捷键方案，可进行编辑和合并
                  </div>
                </div>
              </label>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: 10,
                border: '1px solid var(--border-color)', borderRadius: 'var(--radius)',
                cursor: 'pointer', fontSize: 13,
              }}>
                <input
                  type="radio"
                  name="import-role"
                  checked={pendingRole === 'install_default_env'}
                  onChange={() => setPendingRole('install_default_env')}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>参考 env</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    作为只读参考来源，仅用于对比和覆盖检测
                  </div>
                </div>
              </label>
            </div>
          </div>
          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
            <button className="btn" onClick={() => setShowRoleConfirm(false)}>取消</button>
            <button className="btn btn-primary" onClick={() => handleRoleConfirm(pendingRole)}>
              确认
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 主界面 ──
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog env-import-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: 15 }}>
            从 env 文件导入快捷键
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8, fontWeight: 400 }}>
              步骤 {step === 'mode' ? '1' : step === 'conflicts' ? '2' : '3'}/3
            </span>
          </h3>
          <button className="btn btn-sm" onClick={onClose}>关闭</button>
        </div>

        {/* ── Body ── */}
        <div className="modal-body" style={{ padding: '16px 0' }}>
          {/* ═══ 1. 预览摘要 ═══ */}
          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-muted)' }}>文件信息</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                <tr>
                  <td style={{ padding: '4px 8px', color: 'var(--text-muted)', width: 100 }}>文件路径</td>
                  <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                    {preview.filePath}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>文件大小</td>
                  <td style={{ padding: '4px 8px' }}>
                    {(preview.fileSize / 1024).toFixed(1)} KB
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>识别类型</td>
                  <td style={{ padding: '4px 8px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 10,
                      fontSize: 12,
                      background: ENV_ROLE_COLOR[preview.identifiedRole] + '22',
                      color: ENV_ROLE_COLOR[preview.identifiedRole],
                      border: `1px solid ${ENV_ROLE_COLOR[preview.identifiedRole]}44`,
                    }}>
                      {ENV_ROLE_LABEL[preview.identifiedRole]}
                      {preview.roleConfidence === 'high' ? ' 高' : preview.roleConfidence === 'medium' ? ' 中' : ' 低'}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ margin: '8px 0 4px', fontSize: 13, color: 'var(--text-muted)' }}>解析统计</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '4px 0' }}>
              <div className="card" style={{ textAlign: 'center', padding: '8px 4px' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-blue)' }}>{preview.totalHotkeys}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>快捷键</div>
              </div>
              <div className="card" style={{ textAlign: 'center', padding: '8px 4px' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-green)' }}>{preview.funckeyCount}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Funckey</div>
              </div>
              <div className="card" style={{ textAlign: 'center', padding: '8px 4px' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-orange, #e67e22)' }}>{preview.aliasCount}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Alias</div>
              </div>
              <div className="card" style={{ textAlign: 'center', padding: '8px 4px' }}>
                <div style={{
                  fontSize: 18, fontWeight: 700,
                  color: preview.conflicts.length > 0 ? 'var(--accent-red)' : 'var(--accent-green)',
                }}>
                  {preview.conflicts.length}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>冲突</div>
              </div>
            </div>

            {/* 冲突详情 */}
            {preview.conflicts.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {(Object.entries(conflictStats) as [ConflictType, number][]).filter(([, count]) => count > 0).map(([type, count]) => (
                  <span key={type} style={{
                    padding: '2px 8px',
                    borderRadius: 10,
                    fontSize: 11,
                    background: CONFLICT_TYPE_COLOR[type] + '22',
                    color: CONFLICT_TYPE_COLOR[type],
                  }}>
                    {CONFLICT_TYPE_LABEL[type]}: {count}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ═══ 2. 模式选择 ═══ */}
          {step === 'mode' && (
            <div className="env-import-section">
              <h4 style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-muted)' }}>导入模式</h4>

              {/* install_default_env 警告 */}
              {preview.identifiedRole === 'install_default_env' && (
                <div style={{
                  padding: '8px 12px', marginBottom: 12,
                  background: 'var(--bg-warning-bg, #fff3cd)',
                  borderRadius: 'var(--radius)',
                  fontSize: 13, color: 'var(--text-warning, #856404)',
                  border: '1px solid #ffc10744',
                }}>
                  <strong>检测到该文件疑似安装默认 env。</strong>
                  <br />
                  默认 env 通常不应合并进用户 env，否则可能产生大量重复或覆盖。建议仅作为参考来源。
                </div>
              )}

              <div className="env-import-mode-grid">
                {(['new_profile', 'merge_profile', 'as_reference', 'merge_user_env'] as ImportMode[]).map((mode) => {
                  const isDisabled = mode === 'merge_profile' && !activeProfileId;
                  const isInstallDefaultWarning = mode !== 'as_reference' && preview.identifiedRole === 'install_default_env';
                  return (
                    <label
                      key={mode}
                      className={`env-import-mode-card ${selectedMode === mode ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                      style={{
                        opacity: isDisabled ? 0.5 : 1,
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="import-mode"
                        value={mode}
                        checked={selectedMode === mode}
                        onChange={() => handleModeSelect(mode)}
                        disabled={isDisabled}
                        style={{ display: 'none' }}
                      />
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                        {getModeIcon(mode)} {MODE_LABEL[mode]}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {MODE_DESC[mode]}
                        {isDisabled && <span style={{ color: 'var(--accent-red)', display: 'block', marginTop: 4 }}>请先选择一个快捷键方案</span>}
                      </div>
                    </label>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn" onClick={onClose}>取消</button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (preview.conflicts.length > 0) {
                      setStep('conflicts');
                    } else {
                      setStep('confirm');
                    }
                  }}
                  disabled={selectedMode === 'merge_profile' && !activeProfileId}
                >
                  下一步
                  {preview.conflicts.length > 0 ? ` (${preview.conflicts.length} 个冲突)` : ''}
                </button>
              </div>
            </div>
          )}

          {/* ═══ 3. 冲突处理 ═══ */}
          {step === 'conflicts' && (
            <div className="env-import-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                  冲突处理 ({preview.conflicts.length} 项)
                </h4>
              </div>

              {/* 批量操作 */}
              <div className="env-import-batch-actions" style={{
                display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8,
              }}>
                <button className="btn btn-sm" onClick={handleBatchKeepCurrent}>全部保留当前</button>
                <button className="btn btn-sm" onClick={handleBatchUseImported}>全部使用导入</button>
                <button className="btn btn-sm" onClick={handleBatchSkip}>全部跳过</button>
                <button className="btn btn-sm" onClick={handleBatchNoConflicts}>仅导入无冲突项</button>
              </div>

              {/* 冲突表 */}
              <div className="env-import-conflict-table" style={{
                maxHeight: 300, overflow: 'auto',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius)',
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-code)', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>快捷键</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>当前命令</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>导入命令</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>冲突类型</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>处理方式</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.conflicts.map((conflict) => {
                      const resolution = resolutions[conflict.id] || conflict.suggestedResolution;
                      const isDuplicate = conflict.conflictType === 'duplicate';
                      const isMultiBind = conflict.conflictType === 'multi_binding';
                      return (
                        <tr key={conflict.id} style={{
                          borderBottom: '1px solid var(--border-color)',
                          background: isDuplicate ? 'transparent' : isMultiBind ? 'var(--bg-info-bg, #d1ecf1)22' : 'var(--bg-warning-bg, #fff3cd)22',
                        }}>
                          <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>
                            {conflict.key}
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>
                              ({conflict.type})
                            </span>
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            {conflict.currentCommand ? (
                              <code style={{ fontSize: 11 }}>{conflict.currentCommand}</code>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>无</span>
                            )}
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <code style={{ fontSize: 11 }}>{conflict.importedCommand}</code>
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <span style={{
                              color: CONFLICT_TYPE_COLOR[conflict.conflictType],
                              fontSize: 11,
                            }}>
                              {CONFLICT_TYPE_LABEL[conflict.conflictType]}
                            </span>
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <select
                              value={resolution}
                              onChange={(e) => handleResolutionChange(conflict.id, e.target.value as ConflictResolution)}
                              style={{
                                padding: '3px 4px',
                                fontSize: 11,
                                maxWidth: 140,
                                borderRadius: 'var(--radius)',
                                border: '1px solid var(--border-color)',
                              }}
                            >
                              <option value="keep_current">保留当前</option>
                              <option value="use_imported">使用导入</option>
                              {conflict.conflictType === 'alias_conflict' && (
                                <option value="rename_alias">改名导入</option>
                              )}
                              <option value="use_recommended_key">改用推荐键位</option>
                              <option value="skip">跳过</option>
                              <option value="import_disabled">导入禁用</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn" onClick={() => setStep('mode')}>上一步</button>
                <button className="btn btn-primary" onClick={() => setStep('confirm')}>
                  确认冲突处理 ({Object.values(resolutions).filter(r => r !== 'skip').length} 项将导入)
                </button>
              </div>
            </div>
          )}

          {/* ═══ 4. 确认执行 ═══ */}
          {step === 'confirm' && (
            <div className="env-import-section">
              <h4 style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-muted)' }}>确认导入</h4>
              <div className="card" style={{ padding: 12, marginBottom: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '4px 8px', color: 'var(--text-muted)', width: 120 }}>导入模式</td>
                      <td style={{ padding: '4px 8px', fontWeight: 600 }}>{MODE_LABEL[selectedMode]}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>总快捷键</td>
                      <td style={{ padding: '4px 8px' }}>{preview.totalHotkeys}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>冲突项</td>
                      <td style={{ padding: '4px 8px' }}>{preview.conflicts.length}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>将导入</td>
                      <td style={{ padding: '4px 8px', color: 'var(--accent-green)' }}>
                        {preview.totalHotkeys - Object.values(resolutions).filter(r => r === 'skip' || r === 'keep_current').length} 项
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {selectedMode === 'merge_user_env' && (
                <div style={{ padding: '8px 12px', marginBottom: 12, background: 'var(--bg-warning-bg, #fff3cd)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-warning, #856404)' }}>
                  此操作将修改当前用户 env 文件。应用前会自动备份，支持撤销。
                </div>
              )}

              {selectedMode === 'as_reference' && (
                <div style={{ padding: '8px 12px', marginBottom: 12, background: 'var(--bg-info-bg, #d1ecf1)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-info, #0c5460)' }}>
                  导入为参考 env 后，该文件将显示在快捷键页的叠加视图中，不会被修改。
                </div>
              )}

              {error && (
                <div style={{ padding: '8px 12px', marginBottom: 12, background: 'var(--bg-error-bg, #f8d7da)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-error, #721c24)' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn" onClick={() => {
                  if (preview.conflicts.length > 0) setStep('conflicts');
                  else setStep('mode');
                }}>
                  上一步
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleExecute}
                  disabled={executing}
                >
                  {executing ? '执行中...' : `确认 ${MODE_LABEL[selectedMode]}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── 辅助函数 ──

/** 根据 env 类型获取默认导入模式 */
function getDefaultMode(role: EnvImportRole): ImportMode {
  switch (role) {
    case 'user_env':
      return 'new_profile';
    case 'install_default_env':
    case 'site_env':
    case 'company_env':
      return 'as_reference';
    case 'unknown':
      return 'as_reference';
    default:
      return 'new_profile';
  }
}

/** 获取模式图标 */
function getModeIcon(mode: ImportMode): string {
  switch (mode) {
    case 'new_profile': return '新建';
    case 'merge_profile': return '合并';
    case 'as_reference': return '参考';
    case 'merge_user_env': return '写入';
    default: return '导入';
  }
}

export default EnvImportDialog;
export type { EnvImportDialogProps };
