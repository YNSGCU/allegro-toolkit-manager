/**
 * ATM - 快捷键编辑对话框（V4.0 修改影响预览 + 推荐可用键位）
 * 编辑字段：类型、按键/别名、原始命令
 * 保存时生成 Apply Plan，不直接写 env
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { HotkeyBinding, HotkeyEditValidation, CommandSourceType, KeyRecommendation } from '../types/hotkey';
import { BINDING_SRC_CONFIG } from '../utils/hotkeyItem';

interface HotkeyEditorProps {
  binding: HotkeyBinding;
  onClose: () => void;
  onSave: (editData: any) => void;
  currentEnvBindings?: HotkeyBinding[];
  currentProfileBindings?: HotkeyBinding[];
  profileId?: string;
  allReservedBindings?: HotkeyBinding[];
  envFilePath?: string;
}

const SOURCE_OPTIONS: { value: CommandSourceType | 'ambiguous'; label: string }[] = [
  { value: 'allegro_builtin', label: 'Allegro 内置' },
  { value: 'user_skill', label: '本地 Skill' },
  { value: 'company_skill', label: '公司 Skill' },
  { value: 'atm_managed_skill', label: 'ATM 托管' },
  { value: 'ambiguous', label: '歧义（多种来源）' },
  { value: 'unknown', label: '未知' },
];

const HotkeyEditor: React.FC<HotkeyEditorProps> = ({
  binding, onClose, onSave, currentEnvBindings, currentProfileBindings, profileId, allReservedBindings, envFilePath,
}) => {
  const [type, setType] = useState<'funckey' | 'alias'>(binding.type);
  const [key, setKey] = useState(binding.key);
  const [command, setCommand] = useState(binding.command);
  const [enabled, setEnabled] = useState(binding.enabled !== false);
  const [note, setNote] = useState(binding.notes?.[0] || '');
  const [commandSource, setCommandSource] = useState<CommandSourceType | 'ambiguous'>(
    (binding.commandSource as CommandSourceType | 'ambiguous') || 'unknown',
  );

  // 实时检测结果
  const [validation, setValidation] = useState<HotkeyEditValidation>({
    valid: true, warnings: [], errors: [],
    duplicateInEnv: false, duplicateInProfile: false,
    isReservedKey: false, isReservedWarning: false,
    commandRecognized: true, skillMaybeUnloaded: false,
    isSoftwareDefault: false,
  });
  const [validating, setValidating] = useState(false);

  // 推荐可用键位
  const [recommendedKeys, setRecommendedKeys] = useState<KeyRecommendation[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  // 快捷键来源显示
  const bindingSrcConfig = BINDING_SRC_CONFIG[binding.bindingSource] || BINDING_SRC_CONFIG.unknown;

  // ── 修改影响预览 ──
  const impactPreview = useMemo(() => {
    if (!key.trim() || key.trim() === binding.key) return null;

    const newKey = key.trim();
    const lowerNewKey = newKey.toLowerCase();
    const impacts: { type: 'info' | 'warning' | 'error'; message: string }[] = [];
    let riskLevel: 'safe' | 'info' | 'warning' | 'danger' = 'safe';

    // 1. 检查新键是否已被占用（env 绑定中）
    const occupiedEnvBinding = currentEnvBindings?.find(
      b => b.key?.toLowerCase() === lowerNewKey && b.type === type && b.id !== binding.id
    );
    if (occupiedEnvBinding) {
      impacts.push({
        type: 'warning',
        message: `⚠️ 新按键 "${newKey}" 已被 "${occupiedEnvBinding.command}" 占用（env 中）`,
      });
      riskLevel = 'warning';
    }

    // 2. 检查新键是否在 Profile 中被占用
    const occupiedProfileBinding = currentProfileBindings?.find(
      b => b.key?.toLowerCase() === lowerNewKey && b.type === type
    );
    if (occupiedProfileBinding) {
      impacts.push({
        type: 'warning',
        message: `⚠️ 新按键 "${newKey}" 在当前方案中被 "${occupiedProfileBinding.command}" 占用`,
      });
      riskLevel = 'warning';
    }

    // 3. 检查是否覆盖保留键
    const reservedMatch = allReservedBindings?.find(
      b => b.key?.toLowerCase() === lowerNewKey
    );
    if (reservedMatch) {
      if (reservedMatch.warnWhenOverride) {
        impacts.push({
          type: 'warning',
          message: `⚠️ "${newKey}" 是 Allegro 默认占用键 (${reservedMatch.defaultOccupier?.command || reservedMatch.command})，绑定后可能不生效`,
        });
        riskLevel = 'warning';
      } else {
        impacts.push({
          type: 'info',
          message: `ℹ️ "${newKey}" 在保留键列表中 (${reservedMatch.defaultOccupier?.source || '系统'})`,
        });
        if (riskLevel === 'safe') riskLevel = 'info';
      }
    }

    // 4. 检查是否需要重启
    const needsRestart = !['alias', 'macro'].includes(type);
    if (needsRestart && key.trim() !== binding.key) {
      impacts.push({
        type: 'info',
        message: 'ℹ️ 修改 funckey 需要重启 Allegro 才能生效',
      });
    }

    // 5. 修改前后对比
    const beforeRaw = `${binding.type} ${binding.key} "${binding.command}"`;
    const afterRaw = `${type} ${newKey} "${command.trim()}"`;

    return {
      impacts,
      riskLevel,
      beforeRaw,
      afterRaw,
      newKey,
      requiresRestart: needsRestart && key.trim() !== binding.key,
    };
  }, [key, command, type, binding, currentEnvBindings, currentProfileBindings, allReservedBindings]);

  // ── 实时检测 ──
  useEffect(() => {
    if (!key.trim() || !command.trim()) return;
    setValidating(true);

    const timeout = setTimeout(async () => {
      try {
        const w = window as any;
        if (w.atm?.validateHotkeyEdit) {
          const result = await w.atm.validateHotkeyEdit({
            type,
            key: key.trim(),
            command: command.trim(),
            currentEnvBindings,
            currentProfileBindings,
            profileId,
          });
          if (result.success) {
            setValidation(result.data);
          }
        }
      } catch {} finally {
        setValidating(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [type, key, command, currentEnvBindings, currentProfileBindings, profileId]);

  // ── 加载推荐键位（当 key 变化时，但仅在聚焦时） ──
  const loadRecommendedKeys = useCallback(async () => {
    if (!key.trim() || !currentEnvBindings) return;
    setLoadingRecommendations(true);
    try {
      const w = window as any;
      if (w.atm?.getRecommendedKeys) {
        const result = await w.atm.getRecommendedKeys({
          excludeKeys: [key.trim(), binding.key],
          currentBindings: currentEnvBindings,
          reservedBindings: allReservedBindings || [],
          profileBindings: currentProfileBindings || [],
          maxResults: 10,
        });
        if (result.success) {
          setRecommendedKeys(result.data || []);
        }
      }
    } catch {} finally {
      setLoadingRecommendations(false);
    }
  }, [key, currentEnvBindings, currentProfileBindings, allReservedBindings, binding.key]);

  // 当按键输入框获得焦点时加载推荐
  const [keyFocused, setKeyFocused] = useState(false);
  useEffect(() => {
    if (keyFocused) {
      loadRecommendedKeys();
    }
  }, [keyFocused, loadRecommendedKeys]);

  const handleSave = () => {
    onSave({
      bindingId: binding.id,
      type,
      key: key.trim(),
      command: command.trim(),
      enabled,
      note: note.trim(),
      commandSource,
      profileId,
    });
  };

  const canSave = key.trim().length > 0 && command.trim().length > 0 && validation.valid;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: 16 }}>编辑快捷键</h3>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* 两栏布局：编辑表单 | 推荐键位 */}
          <div style={{ display: 'flex', gap: 16 }}>
            {/* 左栏：编辑表单 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* 类型 */}
              <div className="form-row">
                <label className="form-label" style={{ width: 80 }}>类型</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <label>
                    <input type="radio" checked={type === 'funckey'} onChange={() => setType('funckey')} /> Funckey
                  </label>
                  <label>
                    <input type="radio" checked={type === 'alias'} onChange={() => setType('alias')} /> Alias
                  </label>
                </div>
              </div>

              {/* 按键/别名 */}
              <div className="form-row">
                <label className="form-label" style={{ width: 80 }}>按键/别名</label>
                <input
                  className="search-input"
                  type="text"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  onFocus={() => setKeyFocused(true)}
                  onBlur={() => setTimeout(() => setKeyFocused(false), 200)}
                  placeholder={type === 'funckey' ? '例: F8, ~v, C+s' : '例: zs'}
                  style={{ flex: 1 }}
                />
              </div>

              {/* 原始命令 */}
              <div className="form-row">
                <label className="form-label" style={{ width: 80 }}>原始命令</label>
                <input
                  className="search-input"
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="例: move, add connect, zoom fit"
                  style={{ flex: 1, fontFamily: 'monospace' }}
                />
              </div>

              {/* 命令来源修正 */}
              <div className="form-row">
                <label className="form-label" style={{ width: 80 }}>命令来源</label>
                <select
                  value={commandSource}
                  onChange={(e) => setCommandSource(e.target.value as any)}
                  style={{ flex: 1, padding: '4px 8px' }}
                >
                  {SOURCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* 启用 */}
              <div className="form-row">
                <label className="form-label" style={{ width: 80 }}>状态</label>
                <label>
                  <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> 启用
                </label>
              </div>

              {/* 备注 */}
              <div className="form-row">
                <label className="form-label" style={{ width: 80 }}>备注</label>
                <input
                  className="search-input"
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="可选备注"
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            {/* 右栏：推荐可用键位 */}
            <div style={{ width: 200, borderLeft: '1px solid var(--border-color)', paddingLeft: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
                💡 推荐可用键位
              </div>
              {loadingRecommendations ? (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>加载中...</div>
              ) : recommendedKeys.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {recommendedKeys.map((rec, i) => (
                    <button
                      key={i}
                      className="recommended-key-btn"
                      onClick={() => setKey(rec.key)}
                      title={rec.reason || ''}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 8px',
                        fontSize: 12,
                        cursor: 'pointer',
                        border: '1px solid var(--border-color)',
                        borderRadius: 4,
                        background: rec.status === 'available' ? 'var(--accent-green-alpha, #e8f5e9)' : 'var(--bg-secondary)',
                        color: rec.status === 'available' ? 'var(--accent-green, #2e7d32)' : 'var(--text-muted)',
                        opacity: rec.status === 'available' ? 1 : 0.6,
                      }}
                    >
                      <code style={{ fontWeight: 600, fontSize: 13 }}>{rec.displayKey}</code>
                      <span style={{ fontSize: 10 }}>
                        {rec.status === 'available' ? '可用' : rec.reason || rec.status}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>点击按键框加载推荐...</div>
              )}
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>
                点击推荐键位自动填入
              </div>
            </div>
          </div>

          {/* ── 修改影响预览 ── */}
          {impactPreview && (
            <div className={`impact-preview impact-${impactPreview.riskLevel}`}>
              <div className="impact-preview-header">
                <span className="impact-preview-title">📋 修改影响预览</span>
                <span className={`impact-risk-badge risk-${impactPreview.riskLevel}`}>
                  {impactPreview.riskLevel === 'safe' ? '✅ 安全' :
                   impactPreview.riskLevel === 'warning' ? '⚠️ 有风险' : '❌ 危险'}
                </span>
              </div>

              {/* 修改前后对比 */}
              <div className="impact-diff">
                <div className="impact-diff-item impact-diff-before">
                  <div className="impact-diff-label">修改前</div>
                  <code>{impactPreview.beforeRaw}</code>
                </div>
                <div className="impact-diff-arrow">→</div>
                <div className="impact-diff-item impact-diff-after">
                  <div className="impact-diff-label">修改后</div>
                  <code>{impactPreview.afterRaw}</code>
                </div>
              </div>

              {/* 影响列表 */}
              {impactPreview.impacts.length > 0 && (
                <div className="impact-list">
                  {impactPreview.impacts.map((item, i) => (
                    <div key={i} className={`impact-item impact-${item.type}`}>
                      {item.message}
                    </div>
                  ))}
                </div>
              )}

              {impactPreview.requiresRestart && (
                <div className="impact-restart-warning">
                  🔄 需要重启 Allegro 才能生效
                </div>
              )}
            </div>
          )}

          {/* 只读参考信息 */}
          <div style={{ borderTop: '1px solid var(--border-color)', marginTop: 4, paddingTop: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>参考信息（不可编辑）</div>

            {/* 快捷键来源 */}
            <div className="form-row" style={{ marginBottom: 4 }}>
              <label className="form-label" style={{ width: 100, fontSize: 12 }}>快捷键来源</label>
              <span className={`source-tag ${bindingSrcConfig.className}`}>
                {bindingSrcConfig.label}
              </span>
              {binding.profileName && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                  方案: {binding.profileName}
                </span>
              )}
            </div>

            {/* 原始行号 */}
            {binding.lineNumber && (
              <div className="form-row" style={{ marginBottom: 4 }}>
                <label className="form-label" style={{ width: 100, fontSize: 12 }}>原始行号</label>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {binding.lineNumber}
                </span>
              </div>
            )}

            {/* 原始命令行 */}
            <div className="form-row">
              <label className="form-label" style={{ width: 100, fontSize: 12 }}>原始命令</label>
              <code style={{ fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                {binding.type} {binding.key} "{binding.command}"
              </code>
            </div>
          </div>

          {/* 实时检测结果 */}
          <div className="edit-validation" style={{ fontSize: 12 }}>
            {validating && <span style={{ color: 'var(--text-muted)' }}>检测中...</span>}

            {validation.errors.length > 0 && (
              <div style={{ color: 'var(--accent-red)', marginTop: 4 }}>
                {validation.errors.map((e, i) => <div key={i}>❌ {e}</div>)}
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div style={{ color: 'var(--accent-yellow)', marginTop: 4 }}>
                {validation.warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
              </div>
            )}

            {!validating && validation.warnings.length === 0 && validation.errors.length === 0 && (
              <div style={{ color: 'var(--accent-green)' }}>✅ 通过检测</div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!canSave}>
            {canSave ? '📝 生成 Apply Plan' : '请修正错误'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HotkeyEditor;
