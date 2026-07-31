/**
 * ATM - 快捷键方案选择器（V5.5）
 *
 * 顶部方案栏：预览切换 + 已应用状态显示 + 新建/复制/重命名/删除/导入/导出/应用此方案
 */
import React, { useState } from 'react';
import type { HotkeyProfile } from '../types/hotkey';
import { showToast } from './common/Toast';
import ConfirmDialog from './common/ConfirmDialog';

interface ProfileSelectorProps {
  profiles: HotkeyProfile[];
  activeProfileId: string;
  /** 当前已应用到 env 的方案 ID（用于对比显示） */
  appliedProfileId?: string;
  onSelectProfile: (profileId: string) => void;
  onCreateProfile: (name: string, description?: string) => void;
  onCopyProfile: (profileId: string, newName?: string) => void;
  onRenameProfile: (profileId: string, newName: string) => void;
  onDeleteProfile: (profileId: string) => void;
  onExportProfile: (profileId: string) => void;
  onImportClick: () => void;
  /** 点击应用此方案 */
  onApplyProfile: () => void;
  /** 当前是否已应用 */
  isApplied?: boolean;
  /** 当前 env 快捷键总数 */
  totalEnvBindings?: number;
}

const DEFAULT_PROFILE_NAMES = ['默认', '默认方案', 'Default'];

const ProfileSelector: React.FC<ProfileSelectorProps> = ({
  profiles, activeProfileId, appliedProfileId,
  onSelectProfile, onCreateProfile, onCopyProfile, onRenameProfile,
  onDeleteProfile, onExportProfile, onImportClick, onApplyProfile,
  isApplied, totalEnvBindings = 0,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [action, setAction] = useState<'create' | 'rename' | 'copy' | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const activeProfile = profiles.find((p) => p.id === activeProfileId);
  const activeName = activeProfile?.name || '选择方案';
  const activeBindingCount = activeProfile?.bindings?.length || 0;
  const isDefaultProfile = DEFAULT_PROFILE_NAMES.includes(activeName) || activeProfileId === 'default';
  const isActiveApplied = isApplied || appliedProfileId === activeProfileId;

  const handleActionSubmit = () => {
    if (!inputValue.trim()) return;
    switch (action) {
      case 'create':
        onCreateProfile(inputValue.trim());
        break;
      case 'rename':
        onRenameProfile(activeProfileId, inputValue.trim());
        break;
      case 'copy':
        onCopyProfile(activeProfileId, inputValue.trim());
        break;
    }
    setAction(null);
    setInputValue('');
  };

  /** 删除前校验 */
  const handleDeleteClick = () => {
    setDeleteError(null);

    // 检查是否为默认方案
    if (isDefaultProfile) {
      showToast('warning', '默认方案不能删除。你可以复制默认方案后再编辑副本。');
      return;
    }

    // 检查是否正在使用
    if (isActiveApplied) {
      showToast('warning', '当前方案正在使用，请先切换到其他方案后再删除。');
      return;
    }

    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    setShowDeleteConfirm(false);
    onDeleteProfile(activeProfileId);
  };

  return (
    <div className="profile-selector" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>📂 当前预览方案：</span>

        {/* 选择器按钮 */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn"
            onClick={() => setShowDropdown(!showDropdown)}
            style={{ minWidth: 140, textAlign: 'left' }}
          >
            {activeName} <span style={{ float: 'right' }}>▾</span>
          </button>

          {showDropdown && (
            <div
              style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 100,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius)',
                minWidth: 200, maxHeight: 300, overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              {profiles.map((p) => (
                <div
                  key={p.id}
                  onClick={() => { onSelectProfile(p.id); setShowDropdown(false); }}
                  style={{
                    padding: '8px 12px', cursor: 'pointer',
                    background: p.id === activeProfileId ? 'var(--bg-hover)' : undefined,
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <span>{p.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {p.bindings.length} 项托管
                  </span>
                </div>
              ))}
              {profiles.length === 0 && (
                <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
                  暂无方案
                </div>
              )}
            </div>
          )}
        </div>

        {/* 已应用状态 */}
        <span style={{
          fontSize: 12,
          color: isActiveApplied ? '#34d399' : '#fbbf24',
          fontWeight: 500,
        }}>
          {isActiveApplied ? '✅ 已应用' : '⚠ 当前方案尚未应用'}
        </span>

        {/* 托管快捷键数量 */}
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          托管：{activeBindingCount} 项 · env 共 {totalEnvBindings} 条
        </span>

        {/* 操作按钮组 */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-sm" onClick={() => { setAction('create'); setInputValue(''); }} title="新建方案">
            ✚ 新建
          </button>
          <button className="btn btn-sm" onClick={() => { setAction('copy'); setInputValue(activeName ? `${activeName} (副本)` : ''); }} title="复制方案">
            📋 复制
          </button>
          <button className="btn btn-sm" onClick={() => { setAction('rename'); setInputValue(activeName); }} title="重命名方案">
            ✏️ 重命名
          </button>
          <button className="btn btn-sm" onClick={handleDeleteClick} title="删除方案">
            🗑️ 删除
          </button>
          <button className="btn btn-sm" onClick={() => onExportProfile(activeProfileId)} title="导出方案 JSON">
            📤 导出
          </button>
          <button className="btn btn-sm" onClick={onImportClick} title="导入方案 JSON">
            📥 导入
          </button>
          <div style={{ width: '1px', height: '16px', background: 'var(--border-color)', margin: '0 4px' }} />
          <button
            className="btn btn-sm btn-primary"
            onClick={onApplyProfile}
            title="将当前方案应用到 env"
            style={{
              background: isActiveApplied ? 'var(--bg-hover)' : 'var(--accent-blue)',
              color: isActiveApplied ? 'var(--text-muted)' : '#fff',
              fontWeight: 600,
              border: 'none',
              padding: '4px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            {isActiveApplied ? '✅ 已应用' : '📌 应用此方案'}
          </button>
        </div>
      </div>

      {/* 操作输入框 */}
      {action && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="search-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleActionSubmit(); if (e.key === 'Escape') setAction(null); }}
            placeholder={
              action === 'create' ? '输入新方案名称...' :
              action === 'rename' ? '输入新名称...' :
              action === 'copy' ? '输入副本名称...' : ''
            }
            style={{ flex: 1, maxWidth: 300 }}
            autoFocus
          />
          <button className="btn btn-sm btn-primary" onClick={handleActionSubmit}>确定</button>
          <button className="btn btn-sm" onClick={() => setAction(null)}>取消</button>
        </div>
      )}

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="确认删除快捷键方案"
        message={`确认删除快捷键方案"${activeName}"？`}
        detail={`该操作只删除 ATM 中的方案配置，不会直接修改当前 env 文件。\n方案内快捷键数量：${activeBindingCount} 项`}
        variant="danger"
        confirmLabel="确认删除"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
};

export default ProfileSelector;
