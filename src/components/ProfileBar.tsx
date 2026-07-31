import React, { useMemo, useState } from 'react';
import MoreActionsMenu, { type ActionItem } from './MoreActionsMenu';
import ConfirmDialog from './common/ConfirmDialog';

interface Profile {
  id: string;
  name: string;
}

interface ProfileBarProps {
  title: string;
  profiles: Profile[];
  activeProfileId: string;
  appliedProfileId?: string;
  onCreate: (name: string) => void;
  onCopy: (profileId: string) => void;
  onRename: (profileId: string, newName: string) => void;
  onDelete: (profileId: string) => void;
  onSwitch: (profileId: string) => void;
  onApply: () => void;
  onImport?: () => void;
  onExport?: (profileId: string) => void;
  applyLabel?: string;
  compact?: boolean;
  showCompactManagementActions?: boolean;
}

const DEFAULT_PROFILE_NAMES = ['默认', '默认方案', 'Default'];

const ProfileBar: React.FC<ProfileBarProps> = ({
  title,
  profiles,
  activeProfileId,
  appliedProfileId,
  onCreate,
  onCopy,
  onRename,
  onDelete,
  onSwitch,
  onApply,
  onImport,
  onExport,
  applyLabel = '应用此方案',
  compact = false,
  showCompactManagementActions = false,
}) => {
  const [showNewInput, setShowNewInput] = useState(false);
  const [newName, setNewName] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId);
  const activeName = activeProfile?.name || '选择方案';
  const isDefaultProfile =
    DEFAULT_PROFILE_NAMES.includes(activeName) || activeProfileId === 'default';
  const isApplied = Boolean(activeProfileId) && appliedProfileId === activeProfileId;
  const canApply = Boolean(activeProfile) && !isApplied;
  const isRenameEditing = renameId === activeProfileId;

  const handleCreate = () => {
    if (!newName.trim()) {
      return;
    }

    onCreate(newName.trim());
    setNewName('');
    setShowNewInput(false);
  };

  const handleRenameConfirm = () => {
    if (!renameId || !renameName.trim()) {
      return;
    }

    onRename(renameId, renameName.trim());
    setRenameId(null);
    setRenameName('');
  };

  const handleDeleteClick = () => {
    if (isDefaultProfile || isApplied) {
      onDelete(activeProfileId);
      return;
    }

    setShowDeleteConfirm(true);
  };

  const moreActions = useMemo<ActionItem[]>(() => {
    const actions: ActionItem[] = [];

    actions.push({
      label: '重命名',
      disabled: !activeProfile,
      onClick: () => {
        setRenameId(activeProfileId);
        setRenameName(activeProfile?.name || '');
      },
    });

    actions.push({
      label: '删除',
      danger: true,
      disabled: !activeProfile,
      onClick: handleDeleteClick,
    });

    if (onImport) {
      actions.push({
        label: '导入',
        onClick: onImport,
      });
    }

    if (onExport && activeProfile) {
      actions.push({
        label: '导出',
        onClick: () => onExport(activeProfile.id),
      });
    }

    return actions;
  }, [activeProfile, activeProfileId, handleDeleteClick, onExport, onImport]);

  const renderNewForm = () => (
    <div className="profile-bar-inline-form">
      <input
        type="text"
        value={newName}
        onChange={(event) => setNewName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            handleCreate();
          }
          if (event.key === 'Escape') {
            setShowNewInput(false);
          }
        }}
        placeholder="方案名称"
        autoFocus
        className="profile-bar-input"
      />
      <button className="btn btn-sm btn-primary" onClick={handleCreate}>
        保存
      </button>
      <button className="btn btn-sm" onClick={() => setShowNewInput(false)}>
        取消
      </button>
    </div>
  );

  const renderRenameForm = () => (
    <div className="profile-bar-inline-form">
      <input
        type="text"
        value={renameName}
        onChange={(event) => setRenameName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            handleRenameConfirm();
          }
          if (event.key === 'Escape') {
            setRenameId(null);
          }
        }}
        placeholder="新名称"
        autoFocus
        className="profile-bar-input"
      />
      <button className="btn btn-sm btn-primary" onClick={handleRenameConfirm}>
        保存
      </button>
      <button className="btn btn-sm" onClick={() => setRenameId(null)}>
        取消
      </button>
    </div>
  );

  const renderClassicActions = () => (
    <div className="profile-bar-actions">
      {showNewInput ? (
        renderNewForm()
      ) : (
        <button className="btn btn-sm" onClick={() => setShowNewInput(true)}>
          新建
        </button>
      )}

      <button
        className="btn btn-sm"
        onClick={() => activeProfile && onCopy(activeProfile.id)}
        disabled={!activeProfile}
      >
        复制
      </button>

      {isRenameEditing ? (
        renderRenameForm()
      ) : (
        <button
          className="btn btn-sm"
          onClick={() => {
            setRenameId(activeProfileId);
            setRenameName(activeProfile?.name || '');
          }}
          disabled={!activeProfile}
        >
          重命名
        </button>
      )}

      <button
        className="btn btn-sm btn-danger"
        onClick={handleDeleteClick}
        disabled={!activeProfile}
      >
        删除
      </button>

      {(onImport || onExport) ? <div className="profile-bar-divider" /> : null}

      {onImport ? (
        <button className="btn btn-sm" onClick={onImport}>
          导入
        </button>
      ) : null}

      {onExport && activeProfile ? (
        <button className="btn btn-sm" onClick={() => onExport(activeProfile.id)}>
          导出
        </button>
      ) : null}

      <div className="profile-bar-spacer" />

      <button
        className={`btn btn-sm profile-bar-apply${isApplied ? ' is-applied' : ''}`}
        onClick={onApply}
        disabled={!canApply}
        title={activeProfile ? undefined : '请先创建或选择方案'}
      >
        {isApplied ? '已应用' : applyLabel}
      </button>
    </div>
  );

  const renderCompactActions = () => (
    <div className="profile-bar-quick-actions">
      {showNewInput ? (
        renderNewForm()
      ) : (
        <button className="btn btn-sm" onClick={() => setShowNewInput(true)}>
          新建
        </button>
      )}

      {!showNewInput ? (
        <button
          className="btn btn-sm"
          onClick={() => activeProfile && onCopy(activeProfile.id)}
          disabled={!activeProfile}
        >
          复制
        </button>
      ) : null}

      {!showNewInput && !isRenameEditing ? (
        showCompactManagementActions ? (
          <>
            <button
              className="btn btn-sm"
              onClick={() => {
                setRenameId(activeProfileId);
                setRenameName(activeProfile?.name || '');
              }}
              disabled={!activeProfile}
            >
              重命名
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={handleDeleteClick}
              disabled={!activeProfile}
            >
              删除
            </button>
          </>
        ) : (
          <MoreActionsMenu actions={moreActions} label="更多" />
        )
      ) : null}

      <button
        className={`btn btn-sm profile-bar-apply${isApplied ? ' is-applied' : ''}`}
        onClick={onApply}
        disabled={!canApply}
        title={activeProfile ? undefined : '请先创建或选择方案'}
      >
        {isApplied ? '已应用' : applyLabel}
      </button>
    </div>
  );

  return (
    <section className={`profile-bar${compact ? ' profile-bar--compact' : ''}`}>
      <div className={`profile-bar-main${compact ? ' profile-bar-main--compact' : ''}`}>
        <div className="profile-bar-title">
          <span className="profile-bar-kicker">{title}</span>
        </div>

        <select
          value={activeProfileId}
          onChange={(event) => onSwitch(event.target.value)}
          className="profile-bar-select"
          aria-label={`${title}选择`}
          title={activeProfile?.id}
        >
          {profiles.length === 0 ? (
            <option value="" disabled>
              暂无方案
            </option>
          ) : null}
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>

        <div className="profile-bar-spacer" />

        {compact ? renderCompactActions() : null}
      </div>

      {compact && isRenameEditing ? renderRenameForm() : null}

      {!compact ? renderClassicActions() : null}

      <ConfirmDialog
        open={showDeleteConfirm}
        title={`确认删除${title}`}
        message={`确认删除“${activeName}”吗？`}
        detail="该操作只删除 ATM 中的方案配置，不会直接修改 Allegro 当前文件。"
        variant="danger"
        confirmLabel="确认删除"
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onDelete(activeProfileId);
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </section>
  );
};

export default ProfileBar;
