import { useMemo, useState } from 'react';
import AddHotkeyDialog from '../AddHotkeyDialog';
import EditApplyPlanPreview from '../EditApplyPlanPreview';
import HotkeyEditor from '../HotkeyEditor';
import HotkeyList from '../HotkeyList';
import KeyboardVisualizer from '../KeyboardVisualizer';
import RawLineView from '../RawLineView';
import type { HotkeyWorkspaceActions, HotkeyWorkspaceSharedState } from './types';
import { enrichWithPhysicalKey } from '../../utils/hotkeyItem';
import type { HotkeyBinding } from '../../types/hotkey';

type EditApplyPlan = {
  id: string;
  createdAt: string;
  summary: string;
  steps: Array<{
    opType: string;
    target: string;
    description: string;
    before: string;
    after: string;
    lineNumber?: number;
    backupPath?: string;
  }>;
  requiresRestart: boolean;
};

type RawLineModalState = {
  filePath: string;
  lineNumber: number;
  isReference?: boolean;
};

const QUICK_PHYSICAL_KEYS = ['A', 'S', 'D', 'F', 'Q', 'W', 'E', 'R', 'F1', 'F2', 'F3', 'Space'];

function matchesSearch(binding: HotkeyBinding, query: string) {
  if (!query) {
    return true;
  }

  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [
    binding.key,
    binding.command,
    binding.chineseName,
    binding.profileName,
    binding.skillName,
    binding.bindingSource,
    binding.commandSource,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalized));
}

function matchesFilter(binding: HotkeyBinding, state: HotkeyWorkspaceSharedState) {
  switch (state.mapFilter) {
    case 'funckey':
      return binding.type === 'funckey';
    case 'alias':
      return binding.type === 'alias';
    case 'conflict':
      return state.filteredConflicts.some((conflict) => conflict.bindings.some((item) => item.id === binding.id));
    case 'warning':
      return state.filteredConflicts.some(
        (conflict) => conflict.severity === 'warning' && conflict.bindings.some((item) => item.id === binding.id),
      );
    case 'atm_managed':
      return binding.bindingSource === 'atm_managed_block';
    case 'user_original':
      return binding.bindingSource === 'user_env_original';
    default:
      return true;
  }
}

export default function HotkeyEditorPanel({
  state,
  actions,
}: {
  state: HotkeyWorkspaceSharedState;
  actions: HotkeyWorkspaceActions;
}) {
  const [editingBinding, setEditingBinding] = useState<HotkeyBinding | null>(null);
  const [sourceOverrideBinding, setSourceOverrideBinding] = useState<HotkeyBinding | null>(null);
  const [overrideInput, setOverrideInput] = useState('unknown');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPhysicalKeyPicker, setShowPhysicalKeyPicker] = useState(false);
  const [draftPhysicalKey, setDraftPhysicalKey] = useState('');
  const [pendingEditPlan, setPendingEditPlan] = useState<EditApplyPlan | null>(null);
  const [applyingPlan, setApplyingPlan] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [rawLineModal, setRawLineModal] = useState<RawLineModalState | null>(null);
  const [selectedKeyboardKey, setSelectedKeyboardKey] = useState<string | null>(null);

  const selectedBinding = useMemo(
    () => state.bindings.find((binding) => binding.id === actions.selectedBindingId) ?? null,
    [actions.selectedBindingId, state.bindings],
  );

  const selectedPhysicalKey = useMemo(() => {
    if (!selectedBinding) {
      return null;
    }
    return enrichWithPhysicalKey(selectedBinding).physicalKey ?? null;
  }, [selectedBinding]);

  const tableBindings = useMemo(
    () =>
      actions.tableBindings.filter(
        (binding) => matchesFilter(binding, state) && matchesSearch(binding, state.searchQuery),
      ),
    [actions.tableBindings, state],
  );

  const currentProfileBindings = useMemo(
    () =>
      state.profiles.find((profile) => profile.id === state.activeProfileId)?.bindings as HotkeyBinding[] | undefined,
    [state.activeProfileId, state.profiles],
  );

  const resolvedPhysicalKey = useMemo(
    () => draftPhysicalKey.trim() || selectedPhysicalKey || '',
    [draftPhysicalKey, selectedPhysicalKey],
  );

  const openEditor = (binding: HotkeyBinding) => {
    actions.setSelectedBindingId(binding.id);
    setLocalError(null);
    setSuccessMessage(null);
    setEditingBinding(binding);
  };

  const openSourceOverride = (binding: HotkeyBinding) => {
    actions.setSelectedBindingId(binding.id);
    setLocalError(null);
    setSuccessMessage(null);
    setSourceOverrideBinding(binding);
    setOverrideInput(binding.commandSource || 'unknown');
  };

  const openAddBindingFlow = () => {
    setLocalError(null);
    setSuccessMessage(null);
    if (selectedPhysicalKey) {
      setDraftPhysicalKey(selectedPhysicalKey);
      setShowAddDialog(true);
      return;
    }

    setDraftPhysicalKey('');
    setShowPhysicalKeyPicker(true);
  };

  const openAddBindingForPhysicalKey = (physicalKey: string) => {
    setDraftPhysicalKey(physicalKey);
    setShowAddDialog(true);
  };

  const confirmPhysicalKey = () => {
    if (!draftPhysicalKey.trim()) {
      return;
    }

    setShowPhysicalKeyPicker(false);
    setShowAddDialog(true);
  };

  const handleEditorSave = async (editData: unknown) => {
    if (!editingBinding || !state.envInfo?.envFilePath || typeof window.atm.generateEditPlan !== 'function') {
      setLocalError('当前环境还没有可编辑的 env 文件，暂时无法生成编辑计划。');
      return;
    }

    try {
      const result = await window.atm.generateEditPlan(editData, editingBinding, state.envInfo.envFilePath);
      if (result.success && result.data) {
        setPendingEditPlan(result.data as EditApplyPlan);
        setEditingBinding(null);
        setSuccessMessage(null);
      } else {
        setLocalError(result.error || '生成编辑计划失败。');
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleExecuteEditPlan = async () => {
    if (!pendingEditPlan || !state.envInfo?.envFilePath || typeof window.atm.executeEditPlan !== 'function') {
      return;
    }

    setApplyingPlan(true);
    setLocalError(null);
    try {
      const result = await window.atm.executeEditPlan(JSON.stringify(pendingEditPlan), state.envInfo.envFilePath);
      if (result.success) {
        setPendingEditPlan(null);
        setSuccessMessage('编辑计划已执行，工作区数据已刷新。');
        await actions.reloadData();
      } else {
        setLocalError(result.error || '执行编辑计划失败。');
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    } finally {
      setApplyingPlan(false);
    }
  };

  const handleAddBindingConfirm = async (draft: { key: string; command: string; type: 'funckey' | 'alias' }) => {
    if (!state.envInfo?.envFilePath || typeof window.atm.generateAddPlan !== 'function') {
      setLocalError('当前环境还没有可编辑的 env 文件，暂时无法生成新增计划。');
      return;
    }

    try {
      const result = await window.atm.generateAddPlan(draft.key, draft.command, draft.type, state.envInfo.envFilePath);
      if (result.success && result.data) {
        setPendingEditPlan(result.data as EditApplyPlan);
        setShowAddDialog(false);
        setSuccessMessage(null);
      } else {
        setLocalError(result.error || '生成新增计划失败。');
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleSaveOverride = async () => {
    if (!sourceOverrideBinding || typeof window.atm.saveCommandOverride !== 'function') {
      return;
    }

    try {
      const result = await window.atm.saveCommandOverride(sourceOverrideBinding.command, overrideInput);
      if (result.success) {
        setSourceOverrideBinding(null);
        setSuccessMessage('命令来源修正已保存。');
        await actions.reloadData();
      } else {
        setLocalError(result.error || '保存命令来源修正失败。');
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <section className="hotkey-editor-panel" aria-label="键位编辑">
      <header className="hotkey-editor-panel-header">
        <div>
          <h2>键位</h2>
          <p>从键盘定位占用，再在列表中搜索、选择和编辑绑定。</p>
        </div>
        <div className="hotkey-editor-panel-actions">
          <button
            className="btn btn-primary"
            onClick={openAddBindingFlow}
            title={selectedPhysicalKey ? `为 ${selectedPhysicalKey} 新增绑定` : '先选择物理键后新增绑定'}
          >
            新增绑定
          </button>
        </div>
      </header>

      {state.error ? (
        <div className="message message-error message-with-action" role="alert">
          <span>{state.error}</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void actions.reloadData()}
            disabled={state.loading}
          >
            {state.loading ? '正在重试…' : '重新加载'}
          </button>
        </div>
      ) : null}
      {localError ? <div className="message message-error" role="alert">{localError}</div> : null}
      {successMessage ? <div className="message message-info">{successMessage}</div> : null}

      <div className="hotkey-editor-panel-layout">
        <div className="hotkey-editor-panel-main">
          <section className="hotkey-editor-map-section" aria-label="键盘占用">
            <KeyboardVisualizer
              bindings={state.bindings}
              reservedBindings={state.reservedBindings}
              conflicts={state.filteredConflicts}
              selectedKey={selectedKeyboardKey}
              onSelectKey={setSelectedKeyboardKey}
              viewMode={state.viewMode}
              onViewModeChange={actions.setViewMode}
              activeLayer={state.activeLayer}
              onLayerChange={actions.setActiveLayer}
              onEditBinding={openEditor}
              onAdoptBinding={actions.handleAdoptBinding}
              onOverrideSource={openSourceOverride}
              onAddBinding={openAddBindingForPhysicalKey}
            />
          </section>

          <section className="card hotkey-editor-list-card" aria-label="快捷键列表">
            <div className="card-header hotkey-editor-list-header">
              <span className="hotkey-editor-section-title hotkey-editor-section-title-inline">快捷键列表</span>
              <span>{tableBindings.length} 条</span>
            </div>
            <div className="hotkey-editor-list-tools">
              <input
                className="search-input"
                type="search"
                value={state.searchQuery}
                onChange={(event) => actions.setSearchQuery(event.target.value)}
                placeholder="搜索键位、命令或来源"
                aria-label="搜索快捷键"
              />
              <select
                value={state.mapFilter}
                onChange={(event) => actions.setMapFilter(event.target.value as typeof state.mapFilter)}
                aria-label="筛选快捷键"
              >
                <option value="all">全部绑定</option>
                <option value="funckey">功能键</option>
                <option value="alias">别名</option>
                <option value="conflict">存在冲突</option>
                <option value="warning">存在警告</option>
                <option value="atm_managed">ATM 管理</option>
                <option value="user_original">用户原始配置</option>
              </select>
            </div>
            <HotkeyList
              bindings={tableBindings}
              highlightId={actions.selectedBindingId || undefined}
              onBindingClick={(binding) => actions.setSelectedBindingId(binding.id)}
              onEdit={openEditor}
              onAdopt={actions.handleAdoptBinding}
              onOverrideSource={openSourceOverride}
            />
          </section>
        </div>

        <aside className="card hotkey-editor-detail-card" aria-label="当前选择">
          <div className="card-header">当前选择</div>
          {selectedBinding ? (
            <div className="hotkey-editor-detail">
              <div className="hotkey-editor-detail-key">{selectedBinding.key}</div>
              <div className="hotkey-editor-detail-command">{selectedBinding.command}</div>
              <div className="hotkey-editor-detail-meta">
                <span>{selectedBinding.type}</span>
                <span>{selectedBinding.bindingSource}</span>
                {selectedBinding.lineNumber ? <span>第 {selectedBinding.lineNumber} 行</span> : null}
              </div>
              <p className="hotkey-editor-detail-note">
                {selectedBinding.chineseName || '可以从这里进入编辑、修正来源或查看原始行。'}
              </p>

              <div className="hotkey-editor-detail-actions">
                <button className="btn btn-primary" onClick={() => openEditor(selectedBinding)}>
                  编辑此绑定
                </button>
                <button className="btn" onClick={() => void actions.handleAdoptBinding(selectedBinding)}>
                  接管到当前方案
                </button>
                <button className="btn" onClick={() => openSourceOverride(selectedBinding)}>
                  修正命令来源
                </button>
                <button
                  className="btn"
                  onClick={() =>
                    selectedBinding.lineNumber && state.envInfo?.envFilePath
                      ? setRawLineModal({
                          filePath: state.envInfo.envFilePath,
                          lineNumber: selectedBinding.lineNumber,
                        })
                      : undefined
                  }
                  disabled={!selectedBinding.lineNumber || !state.envInfo?.envFilePath}
                >
                  查看原始行
                </button>
              </div>
            </div>
          ) : (
            <div className="detail-empty-state">
              先在地图或列表里选中一个快捷键，这里就会显示可编辑详情。
            </div>
          )}
        </aside>
      </div>

      {pendingEditPlan ? (
        <section className="hotkey-editor-plan-preview">
          <EditApplyPlanPreview
            plan={pendingEditPlan}
            onConfirm={() => void handleExecuteEditPlan()}
            onCancel={() => setPendingEditPlan(null)}
            isApplying={applyingPlan}
          />
        </section>
      ) : null}

      {editingBinding ? (
        <HotkeyEditor
          binding={editingBinding}
          onClose={() => setEditingBinding(null)}
          onSave={(editData) => void handleEditorSave(editData)}
          currentEnvBindings={state.bindings}
          currentProfileBindings={currentProfileBindings}
          profileId={state.activeProfileId}
          allReservedBindings={state.reservedBindings}
          envFilePath={state.envInfo?.envFilePath ?? undefined}
        />
      ) : null}

      {showPhysicalKeyPicker ? (
        <div className="modal-overlay" onClick={() => setShowPhysicalKeyPicker(false)}>
          <div className="modal-dialog" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 15 }}>选择物理键</h3>
              <button className="btn btn-sm" onClick={() => setShowPhysicalKeyPicker(false)}>
                关闭
              </button>
            </div>
            <div className="modal-body" style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label htmlFor="hotkey-editor-physical-key" style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  物理键
                </label>
                <input
                  id="hotkey-editor-physical-key"
                  className="search-input"
                  type="text"
                  value={draftPhysicalKey}
                  onChange={(event) => setDraftPhysicalKey(event.target.value.toUpperCase())}
                  placeholder="例如 A、F2、Space"
                  style={{ width: '100%' }}
                />
              </div>

              <div className="hotkey-editor-quick-keys">
                {QUICK_PHYSICAL_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setDraftPhysicalKey(key)}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowPhysicalKeyPicker(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={confirmPhysicalKey} disabled={!draftPhysicalKey.trim()}>
                继续新增
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showAddDialog && resolvedPhysicalKey ? (
        <AddHotkeyDialog
          physicalKey={resolvedPhysicalKey}
          onClose={() => {
            setShowAddDialog(false);
            if (!selectedPhysicalKey) {
              setDraftPhysicalKey('');
            }
          }}
          onConfirm={(draft) => void handleAddBindingConfirm(draft)}
        />
      ) : null}

      {sourceOverrideBinding ? (
        <div className="modal-overlay" onClick={() => setSourceOverrideBinding(null)}>
          <div className="modal-dialog" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 15 }}>修正命令来源</h3>
              <button className="btn btn-sm" onClick={() => setSourceOverrideBinding(null)}>
                关闭
              </button>
            </div>
            <div className="modal-body" style={{ padding: '12px 0' }}>
              <p style={{ fontSize: 13, marginBottom: 8 }}>
                命令: <code>{sourceOverrideBinding.command}</code>
              </p>
              <select
                value={overrideInput}
                onChange={(event) => setOverrideInput(event.target.value)}
                style={{ width: '100%', padding: '6px 8px' }}
              >
                <option value="allegro_builtin">Allegro 内置</option>
                <option value="user_skill">本地 Skill</option>
                <option value="company_skill">公司 Skill</option>
                <option value="atm_managed_skill">ATM 托管 Skill</option>
                <option value="ambiguous">歧义（多种来源）</option>
                <option value="unknown">未知</option>
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setSourceOverrideBinding(null)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={() => void handleSaveOverride()}>
                保存修正
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rawLineModal ? (
        <div className="modal-overlay" onClick={() => setRawLineModal(null)}>
          <div className="modal-dialog" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 650 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 15 }}>原始行查看</h3>
              <button className="btn btn-sm" onClick={() => setRawLineModal(null)}>
                关闭
              </button>
            </div>
            <div className="modal-body" style={{ padding: '8px 0' }}>
              <RawLineView
                filePath={rawLineModal.filePath}
                lineNumber={rawLineModal.lineNumber}
                isReference={rawLineModal.isReference}
                onClose={() => setRawLineModal(null)}
                onEdit={
                  selectedBinding
                    ? () => {
                        setRawLineModal(null);
                        openEditor(selectedBinding);
                      }
                    : undefined
                }
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
