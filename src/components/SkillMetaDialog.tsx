/**
 * ATM - Skill 元数据编辑弹窗（V5.0）
 * 编辑 Skill 的中文名称、用户备注、分类和标签
 * 不修改任何 .il 源文件，数据保存到 atm_data/skill_metadata.json
 */
import React, { useState, useEffect } from 'react';
import type { SkillMeta } from '../types/skill';

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
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content skill-meta-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480 }}
      >
        <div className="modal-header">
          <h3>编辑备注 — {skillName}</h3>
          <button className="btn btn-sm" onClick={onClose}>关闭</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 20 }}>
          {error && (
            <div className="message message-error">{error}</div>
          )}

          {/* 原始名称（只读） */}
          <div className="form-group">
            <label className="form-label">原始名称</label>
            <div style={{ fontSize: 14, padding: '8px 0', color: 'var(--text-secondary)' }}>
              <code>{meta?.originalName || skillName}</code>
            </div>
          </div>

          {/* 中文名称 */}
          <div className="form-group">
            <label className="form-label">中文名称</label>
            <input
              type="text"
              className="atm-input"
              placeholder="例如：智能吸附工具"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', fontSize: 14 }}
            />
            {meta?.autoName && !userName && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                自动建议: {meta.autoName}
              </span>
            )}
          </div>

          {/* 用户备注 */}
          <div className="form-group">
            <label className="form-label">用户备注</label>
            <textarea
              className="atm-input"
              placeholder="记录该 Skill 的用途、注意事项等..."
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
              rows={3}
              style={{ width: '100%', padding: '8px 12px', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
            />
            {meta?.autoSummary && !userNote && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                自动简介: {meta.autoSummary}
              </span>
            )}
          </div>

          {/* 分类 */}
          <div className="form-group">
            <label className="form-label">功能分类</label>
            <input
              type="text"
              className="atm-input"
              placeholder="例如：辅助操作 / 精准定位"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', fontSize: 14 }}
            />
            {meta?.autoCategory && !category && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                自动分类: {meta.autoCategory}
              </span>
            )}
          </div>

          {/* 标签 */}
          <div className="form-group">
            <label className="form-label">标签（逗号分隔）</label>
            <input
              type="text"
              className="atm-input"
              placeholder="吸附, 定位, PIN, VIA"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', fontSize: 14 }}
            />
            {meta?.tags && meta.tags.length > 0 && !tagsInput && (
              <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                {meta.tags.map((tag, i) => (
                  <span key={i} className="skill-meta-tag">{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* 元数据信息 */}
          {meta?.generatedAt && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
              <div>分析时间: {new Date(meta.generatedAt).toLocaleString('zh-CN')}</div>
              {meta.confidence && (
                <div>
                  可信度:
                  <span style={{
                    color: meta.confidence === 'high' ? 'var(--accent-green)' :
                           meta.confidence === 'medium' ? 'var(--accent-yellow)' : 'var(--accent-red)',
                    marginLeft: 4,
                  }}>
                    {meta.confidence === 'high' ? '高' : meta.confidence === 'medium' ? '中' : '低'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid var(--border-color)' }}>
          <button className="btn" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SkillMetaDialog;
