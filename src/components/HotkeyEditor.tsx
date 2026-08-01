/**
 * ATM - 快捷键编辑对话框（V4.0 修改影响预览 + 推荐可用键位）
 * 编辑字段：类型、按键/别名、原始命令
 * 保存时生成 Apply Plan，不直接写 env
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { HotkeyBinding, HotkeyEditValidation, CommandSourceType, KeyRecommendation } from '../types/hotkey';
import { BINDING_SRC_CONFIG } from '../utils/hotkeyItem';
import { BusinessDialog } from '../shared/ui';

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
        message: `新按键“${newKey}”已被“${occupiedEnvBinding.command}”占用（env 中）`,
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
        message: `新按键“${newKey}”在当前方案中被“${occupiedProfileBinding.command}”占用`,
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
          message: `“${newKey}”是 Allegro 默认占用键（${reservedMatch.defaultOccupier?.command || reservedMatch.command}），绑定后可能不生效`,
        });
        riskLevel = 'warning';
      } else {
        impacts.push({
          type: 'info',
          message: `“${newKey}”在保留键列表中（${reservedMatch.defaultOccupier?.source || '系统'}）`,
        });
        if (riskLevel === 'safe') riskLevel = 'info';
      }
    }

    // 4. 检查是否需要重启
    const needsRestart = !['alias', 'macro'].includes(type);
    if (needsRestart && key.trim() !== binding.key) {
      impacts.push({
        type: 'info',
        message: '修改 funckey 需要重启 Allegro 才能生效',
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
    <BusinessDialog
      title={<>编辑快捷键<span className="ui-dialog-title-context"> · {binding.key}</span></>}
      description="修改键位、命令与来源；保存后仅生成 Apply Plan。"
      size="lg"
      onClose={onClose}
      bodyClassName="hotkey-edit-dialog-body"
      footer={(
        <>
          <button type="button" className="btn" onClick={onClose}>取消</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={!canSave}>
            {canSave ? '生成 Apply Plan' : '请修正错误'}
          </button>
        </>
      )}
    >
      <div className="hotkey-edit-dialog-form">

          {/* 两栏布局：编辑表单 | 推荐键位 */}
          <div className="hotkey-edit-dialog-grid">
            {/* 左栏：编辑表单 */}
            <div className="ui-dialog-form hotkey-edit-dialog-fields">
              {/* 类型 */}
              <fieldset className="ui-dialog-field">
                <legend className="ui-dialog-field-label">绑定类型</legend>
                <div className="ui-dialog-choice-group">
                  <label className="ui-dialog-choice">
                    <input type="radio" name="hotkey-edit-type" checked={type === 'funckey'} onChange={() => setType('funckey')} /> Funckey
                  </label>
                  <label className="ui-dialog-choice">
                    <input type="radio" name="hotkey-edit-type" checked={type === 'alias'} onChange={() => setType('alias')} /> Alias
                  </label>
                </div>
              </fieldset>

              {/* 按键/别名 */}
              <div className="ui-dialog-field ui-dialog-field--code">
                <label htmlFor="hotkey-edit-key">按键 / 别名</label>
                <input
                  id="hotkey-edit-key"
                  className="search-input"
                  type="text"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  onFocus={() => setKeyFocused(true)}
                  onBlur={() => setTimeout(() => setKeyFocused(false), 200)}
                  placeholder={type === 'funckey' ? '例: F8, ~v, C+s' : '例: zs'}
                  data-dialog-initial-focus
                />
              </div>

              {/* 原始命令 */}
              <div className="ui-dialog-field ui-dialog-field--code">
                <label htmlFor="hotkey-edit-command">原始命令</label>
                <input
                  id="hotkey-edit-command"
                  className="search-input"
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="例: move, add connect, zoom fit"
                />
              </div>

              {/* 命令来源修正 */}
              <div className="ui-dialog-field">
                <label htmlFor="hotkey-edit-source">命令来源</label>
                <select
                  id="hotkey-edit-source"
                  value={commandSource}
                  onChange={(e) => setCommandSource(e.target.value as any)}
                >
                  {SOURCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* 启用 */}
              <div className="ui-dialog-field">
                <span className="ui-dialog-field-label">状态</span>
                <label className="ui-dialog-choice hotkey-edit-enabled">
                  <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> 启用
                </label>
              </div>

              {/* 备注 */}
              <div className="ui-dialog-field">
                <label htmlFor="hotkey-edit-note">备注</label>
                <input
                  id="hotkey-edit-note"
                  className="search-input"
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="可选备注"
                />
              </div>
            </div>

            {/* 右栏：推荐可用键位 */}
            <aside className="hotkey-edit-recommendations" aria-labelledby="hotkey-edit-recommendations-title">
              <h3 id="hotkey-edit-recommendations-title" className="ui-dialog-section-title">推荐可用键位</h3>
              {loadingRecommendations ? (
                <div className="ui-dialog-field-hint">正在加载…</div>
              ) : recommendedKeys.length > 0 ? (
                <div className="hotkey-edit-recommendation-list">
                  {recommendedKeys.map((rec, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`recommended-key-btn ${rec.status === 'available' ? 'is-available' : 'is-unavailable'}`}
                      onClick={() => setKey(rec.key)}
                      title={rec.reason || ''}
                    >
                      <code>{rec.displayKey}</code>
                      <span>
                        {rec.status === 'available' ? '可用' : rec.reason || rec.status}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="ui-dialog-field-hint">聚焦按键输入框后加载推荐</div>
              )}
              <div className="ui-dialog-field-hint hotkey-edit-recommendation-hint">点击推荐项可自动填入</div>
            </aside>
          </div>

          {/* ── 修改影响预览 ── */}
          {impactPreview && (
            <div className={`impact-preview impact-${impactPreview.riskLevel}`}>
              <div className="impact-preview-header">
                <span className="impact-preview-title">修改影响预览</span>
                <span className={`impact-risk-badge risk-${impactPreview.riskLevel}`}>
                  {impactPreview.riskLevel === 'safe' ? '安全' :
                   impactPreview.riskLevel === 'warning' ? '有风险' : '高风险'}
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
                  需要重启 Allegro 才能生效
                </div>
              )}
            </div>
          )}

          {/* 只读参考信息 */}
          <section className="hotkey-edit-reference" aria-labelledby="hotkey-edit-reference-title">
            <h3 id="hotkey-edit-reference-title" className="ui-dialog-section-title">参考信息</h3>

            {/* 快捷键来源 */}
            <div className="hotkey-edit-reference-row">
              <span>快捷键来源</span>
              <span className={`source-tag ${bindingSrcConfig.className}`}>
                {bindingSrcConfig.label}
              </span>
              {binding.profileName && (
                <small>方案：{binding.profileName}</small>
              )}
            </div>

            {/* 原始行号 */}
            {binding.lineNumber && (
              <div className="hotkey-edit-reference-row">
                <span>原始行号</span>
                <code>{binding.lineNumber}</code>
              </div>
            )}

            {/* 原始命令行 */}
            <div className="hotkey-edit-reference-row">
              <span>原始命令</span>
              <code>
                {binding.type} {binding.key} "{binding.command}"
              </code>
            </div>
          </section>

          {/* 实时检测结果 */}
          <div className="edit-validation hotkey-edit-validation" aria-live="polite">
            {validating && <span className="ui-dialog-field-hint">正在检测…</span>}

            {validation.errors.length > 0 && (
              <div className="ui-dialog-alert ui-dialog-alert--danger" role="alert">
                {validation.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div className="ui-dialog-alert ui-dialog-alert--warning">
                {validation.warnings.map((w, i) => <div key={i}>{w}</div>)}
              </div>
            )}

            {!validating && validation.warnings.length === 0 && validation.errors.length === 0 && (
              <div className="hotkey-edit-validation-success">通过检测</div>
            )}
          </div>
      </div>
    </BusinessDialog>
  );
};

export default HotkeyEditor;
