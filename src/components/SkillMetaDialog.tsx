/**
 * ATM - Skill 元数据编辑弹窗（V5.0）
 * 编辑 Skill 的中文名称、用户备注、分类和标签
 * 不修改任何 .il 源文件，数据保存到 atm_data/skill_metadata.json
 */
import React, { useState } from 'react';
import type { SkillMeta } from '../types/skill';
import { BusinessDialog } from '../shared/ui';

interface SkillMetaDialogProps {
  /** 当前 Skill 名称（显示用） */
  skillName: string;
  /** 当前 Skill ID */
  skillId: string;
  /** 当前元数据 */
  meta: SkillMeta | null;
  /** 保存回调 */
  onSave: (skillId: string, meta: Partial<SkillMeta>) => Promise<void>;
  /** 关闭弹窗 */
  onClose: () => void;
}

const SkillMetaDialog: React.FC<SkillMetaDialogProps> = ({
  skillName,
  skillId,
  meta,
  onSave,
  onClose,
}) => {
  const [userName, setUserName] = useState(meta?.userName || meta?.displayName || '');
  const [userNote, setUserNote] = useState(meta?.userNote || '');
  const [category, setCategory] = useState(meta?.userCategory || meta?.autoCategory || '');
  const [tagsInput, setTagsInput] = useState((meta?.tags || []).join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const tags = tagsInput
        .split(/[,，、]/)
        .map((t) => t.trim())
        .filter(Boolean);

      await onSave(skillId, {
        userName: userName.trim() || undefined,
        userNote: userNote.trim() || undefined,
        userCategory: category.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BusinessDialog
      title={`编辑 Skill 信息 · ${skillName}`}
      description="补充便于检索和维护的名称、分类、标签与备注，不会修改 Skill 源文件。"
      size="md"
      onClose={onClose}
      dismissDisabled={saving}
      footer={(
        <>
          <button type="button" className="btn" onClick={onClose} disabled={saving}>取消</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中…' : '保存信息'}
          </button>
        </>
      )}
    >
      <div className="ui-dialog-form">
        {error ? <div className="message message-error" role="alert">{error}</div> : null}

        <div className="ui-dialog-field">
          <span className="ui-dialog-field-label">原始名称</span>
          <div className="ui-dialog-readonly"><code>{meta?.originalName || skillName}</code></div>
        </div>

        <div className="ui-dialog-field">
          <label htmlFor="skill-meta-name">中文名称</label>
          <input
            id="skill-meta-name"
            type="text"
            className="atm-input"
            placeholder="例如：智能吸附工具"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            data-dialog-initial-focus
          />
          {meta?.autoName && !userName ? <span className="ui-dialog-field-hint">自动建议：{meta.autoName}</span> : null}
        </div>

        <div className="ui-dialog-field">
          <label htmlFor="skill-meta-note">用户备注</label>
          <textarea
            id="skill-meta-note"
            className="atm-input"
            placeholder="记录该 Skill 的用途、注意事项等…"
            value={userNote}
            onChange={(e) => setUserNote(e.target.value)}
            rows={3}
          />
          {meta?.autoSummary && !userNote ? <span className="ui-dialog-field-hint">自动简介：{meta.autoSummary}</span> : null}
        </div>

        <div className="ui-dialog-field-grid">
          <div className="ui-dialog-field">
            <label htmlFor="skill-meta-category">功能分类</label>
            <input
              id="skill-meta-category"
              type="text"
              className="atm-input"
              placeholder="例如：辅助操作 / 精准定位"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            {meta?.autoCategory && !category ? <span className="ui-dialog-field-hint">自动分类：{meta.autoCategory}</span> : null}
          </div>

          <div className="ui-dialog-field">
            <label htmlFor="skill-meta-tags">标签</label>
            <input
              id="skill-meta-tags"
              type="text"
              className="atm-input"
              placeholder="吸附, 定位, PIN, VIA"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
            <span className="ui-dialog-field-hint">使用逗号、中文逗号或顿号分隔</span>
          </div>
        </div>

        {meta?.generatedAt ? (
          <div className="ui-dialog-meta">
            <span>分析时间：{new Date(meta.generatedAt).toLocaleString('zh-CN')}</span>
            {meta.confidence ? (
              <span className={`ui-dialog-confidence ui-dialog-confidence--${meta.confidence}`}>
                可信度：{meta.confidence === 'high' ? '高' : meta.confidence === 'medium' ? '中' : '低'}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </BusinessDialog>
  );
};

export default SkillMetaDialog;
