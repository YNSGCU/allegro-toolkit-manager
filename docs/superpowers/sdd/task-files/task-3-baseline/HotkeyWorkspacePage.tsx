import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Navigate, Route, Routes } from 'react-router-dom';
import type { MapFilter, MapViewMode } from '../components/HotkeyMap';
import HotkeySubnav from '../components/hotkeys/HotkeySubnav';
import type {
  HotkeyConflictsPanelProps,
  HotkeyEditorPanelProps,
  HotkeyImportExportPanelProps,
  HotkeyOverviewPanelProps,
  HotkeyWorkspaceActions,
  HotkeyWorkspaceSharedState,
  HotkeyWorkspaceStats,
  HotkeyWorkspaceUndoStatus,
} from '../components/hotkeys/types';
import type { EnvEntry, ApplyPlan, Conflict, EnhancedConflict, HotkeyBinding, HotkeyProfile } from '../types/hotkey';
import type { AtmSettings, EnvironmentInfo, EnvSourceList } from '../types/environment';
import type { EnvImportPreview } from '../types/importEnv';
import type { ActiveLayer } from '../utils/hotkeyItem';
import { enrichWithPhysicalKey, filterHotkeysByKeyboardLayer } from '../utils/hotkeyItem';
import { loadHotkeyWorkspaceData } from './HotkeyPage';

type PlaceholderProps = {
  title: string;
  summary: string;
  children?: React.ReactNode;
};

function Placeholder({ title, summary, children }: PlaceholderProps) {
  return (
    <section className="hotkey-workspace-placeholder" aria-label={title}>
      <div className="card">
        <div className="card-header">快捷键工作区</div>
        <h3>{title}</h3>
        <p>{summary}</p>
        {children}
      </div>
    </section>
  );
}

function HotkeyOverviewPanel({ sharedState, actions }: HotkeyOverviewPanelProps) {
  const activeProfile =
    sharedState.profiles.find((profile) => profile.id === sharedState.activeProfileId) ?? null;
  const isAppliedProfileActive =
    Boolean(sharedState.appliedProfileId) && sharedState.appliedProfileId === sharedState.activeProfileId;

  return (
    <Placeholder
      title="快捷键总览"
      summary="共享容器现在承接了旧页已有的数据加载语义，并把关键动作暴露给后续子面板。"
    >
      {sharedState.loading ? (
        <p>正在加载共享数据...</p>
      ) : sharedState.error ? (
        <p>{sharedState.error}</p>
      ) : (
        <>
          <dl style={{ margin: 0, display: 'grid', gap: 8 }}>
            <div>
              <dt>当前方案</dt>
              <dd>{activeProfile?.name ?? '未选择方案'}</dd>
            </div>
            <div>
              <dt>应用状态</dt>
              <dd>{isAppliedProfileActive ? '当前方案已应用' : '当前方案未应用'}</dd>
            </div>
            <div>
              <dt>方案数量</dt>
              <dd>{sharedState.profiles.length}</dd>
            </div>
            <div>
              <dt>快捷键数量</dt>
              <dd>{sharedState.stats.total}</dd>
            </div>
            <div>
              <dt>保留键数量</dt>
              <dd>{sharedState.reservedBindings.length}</dd>
            </div>
            <div>
              <dt>冲突数量</dt>
              <dd>{sharedState.filteredConflicts.length}</dd>
            </div>
          </dl>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => void actions.handleCreatePlan()}>
              生成 Apply Plan
            </button>
            {actions.plan && <span>{actions.plan.summary}</span>}
          </div>
        </>
      )}
    </Placeholder>
  );
}

function HotkeyEditorPanel({ sharedState, actions }: HotkeyEditorPanelProps) {
  const firstBinding = sharedState.bindings[0] ?? null;

  return (
    <Placeholder
      title="键位编辑"
      summary="真实编辑 UI 还未回接，但共享容器已经提供了选择与接管等动作。"
    >
      <p>当前选中：{actions.selectedBindingId ?? '无'}</p>
      {firstBinding && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-sm" onClick={() => actions.handleEditBindingById(firstBinding.id)}>
            选中首个快捷键
          </button>
          <button className="btn btn-sm" onClick={() => void actions.handleAdoptBinding(firstBinding)}>
            接管首个快捷键
          </button>
        </div>
      )}
    </Placeholder>
  );
}

function HotkeyConflictsPanel({ sharedState, actions }: HotkeyConflictsPanelProps) {
  const firstConflictBinding = sharedState.filteredConflicts[0]?.bindings[0] ?? null;

  return (
    <Placeholder
      title="冲突处理"
      summary="占位面板已经能读取真实冲突数据，并调用共享容器内的冲突/原始行动作。"
    >
      <p>当前冲突：{sharedState.filteredConflicts.length}</p>
      <p>已忽略冲突：{actions.conflictIgnoreList.length}</p>
      {sharedState.filteredConflicts[0] && (
        <button className="btn btn-sm" onClick={() => actions.handleIgnoreConflict('placeholder-conflict')}>
          忽略示例冲突
        </button>
      )}
      {firstConflictBinding?.lineNumber && sharedState.envInfo?.envFilePath && (
        <button
          className="btn btn-sm"
          onClick={() =>
            actions.handleViewRawLine(sharedState.envInfo!.envFilePath!, firstConflictBinding.lineNumber!)
          }
        >
          查看原始行
        </button>
      )}
    </Placeholder>
  );
}

function HotkeyImportExportPanel({ sharedState, actions }: HotkeyImportExportPanelProps) {
  return (
    <Placeholder
      title="导入导出"
      summary="导入导出仍是占位路由，但已经绑定到真实共享动作和导入预览状态。"
    >
      <p>环境文件：{sharedState.envInfo?.envFilePath ?? '未检测到 env 文件'}</p>
      <p>导入预览：{sharedState.envImportPreview ? '已准备' : '未准备'}</p>
      {sharedState.error && <p>{sharedState.error}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-sm" onClick={actions.handleEnvImportClick}>
          打开 env 导入
        </button>
        <button className="btn btn-sm" onClick={() => void actions.handleExportProfile()}>
          导出当前方案
        </button>
      </div>
    </Placeholder>
  );
}

function buildStats(bindings: HotkeyBinding[], conflicts: Conflict[]): HotkeyWorkspaceStats {
  return {
    total: bindings.length,
    funckeyCount: bindings.filter((item) => item.type === 'funckey').length,
    aliasCount: bindings.filter((item) => item.type === 'alias').length,
    errorCount: conflicts.filter((item) => item.severity === 'error').length,
    warningCount: conflicts.filter((item) => item.severity === 'warning').length,
    overlayConflictCount: conflicts.filter((item) => item.type === 'cross_env_override').length,
  };
}

export default function HotkeyWorkspacePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [envInfo, setEnvInfo] = useState<EnvironmentInfo | null>(null);
  const [entries, setEntries] = useState<EnvEntry[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<HotkeyProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState('');
  const [appliedProfileId, setAppliedProfileId] = useState('');
  const [bindings, setBindings] = useState<HotkeyBinding[]>([]);
  const [reservedBindings, setReservedBindings] = useState<HotkeyBinding[]>([]);
  const [reservedKeysWarning, setReservedKeysWarning] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [enhancedConflicts] = useState<EnhancedConflict[]>([]);
  const [envSources, setEnvSources] = useState<EnvSourceList | null>(null);
  const [settings, setSettings] = useState<AtmSettings | null>(null);
  const [activeLayer] = useState<ActiveLayer>('normal');
  const [viewMode] = useState<MapViewMode>('my');
  const [mapFilter, setMapFilter] = useState<MapFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBindingId, setSelectedBindingId] = useState<string | null>(null);
  const [conflictIgnoreList, setConflictIgnoreList] = useState<string[]>([]);
  const [plan, setPlan] = useState<ApplyPlan | null>(null);
  const [, setShowExportDialog] = useState(false);
  const [, setShowChangeHistory] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [undoStatus, setUndoStatus] = useState<HotkeyWorkspaceUndoStatus>({ canUndo: false, message: '' });
  const [rawLineView, setRawLineView] = useState<{ filePath: string; lineNumber: number; isReference?: boolean } | null>(null);
  const [envImportPreview, setEnvImportPreview] = useState<EnvImportPreview | null>(null);
  const [pendingOverrideBinding, setPendingOverrideBinding] = useState<HotkeyBinding | null>(null);
  const hasLoadedInitially = useRef(false);
  const isMountedRef = useRef(true);
  const canSafelySetState = useCallback(
    () => isMountedRef.current && typeof window !== 'undefined',
    [],
  );

  const loadAll = useCallback(async (options?: { resetState?: boolean }) => {
    const shouldResetState = options?.resetState ?? true;
    if (shouldResetState) {
      setLoading(true);
      setError(null);
    }
    let settled = false;

    try {
      const loaded = await loadHotkeyWorkspaceData(activeProfileId);
      if (!canSafelySetState()) {
        return;
      }
      flushSync(() => {
        setEnvInfo(loaded.envInfo);
        setEntries(loaded.entries);
        setParseWarnings(loaded.parseWarnings);
        setProfiles(loaded.profiles);
        setActiveProfileId(loaded.activeProfileId);
        setAppliedProfileId(loaded.appliedProfileId);
        setBindings(loaded.bindings);
        setReservedBindings(loaded.reservedBindings);
        setReservedKeysWarning(loaded.reservedKeysWarning);
        setConflicts(loaded.conflicts);
        setEnvSources(loaded.envSources);
        setSettings(loaded.settings);
        setFavoriteIds(loaded.favoriteIds);
        setUndoStatus(loaded.undoStatus);
        setLoading(false);
      });
      settled = true;
    } catch (loadError) {
      if (canSafelySetState()) {
        flushSync(() => {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
          setLoading(false);
        });
        settled = true;
      }
    } finally {
      if (!settled && canSafelySetState()) {
        setLoading(false);
      }
    }
  }, [activeProfileId, canSafelySetState]);

  useEffect(() => {
    isMountedRef.current = true;
    if (hasLoadedInitially.current) {
      return () => {
        isMountedRef.current = false;
      };
    }
    hasLoadedInitially.current = true;
    void loadAll({ resetState: false });
    return () => {
      isMountedRef.current = false;
    };
  }, [loadAll]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('atm_conflict_ignore');
      if (saved) {
        setConflictIgnoreList(JSON.parse(saved));
      }
    } catch {
      setConflictIgnoreList([]);
    }
  }, []);

  const layerFilteredBindings = useMemo(() => {
    const enrichedBindings = bindings.map((binding) => enrichWithPhysicalKey(binding));
    return filterHotkeysByKeyboardLayer(enrichedBindings, activeLayer);
  }, [activeLayer, bindings]);

  const stats = useMemo(
    () => buildStats(layerFilteredBindings, conflicts),
    [conflicts, layerFilteredBindings],
  );

  const sharedState: HotkeyWorkspaceSharedState = {
    loading,
    error,
    envInfo,
    profiles,
    activeProfileId,
    appliedProfileId,
    bindings: layerFilteredBindings,
    reservedBindings,
    filteredConflicts: conflicts,
    enhancedConflicts,
    activeLayer,
    viewMode,
    mapFilter,
    searchQuery,
    parseWarnings,
    entries,
    reservedKeysWarning,
    favoriteIds,
    undoStatus,
    rawLineView,
    envImportPreview,
    pendingOverrideBinding,
    stats,
    envSources,
    settings,
  };

  const actions: HotkeyWorkspaceActions = {
    selectedBindingId,
    tableBindings: layerFilteredBindings,
    conflictIgnoreList,
    plan,
    setSelectedBindingId,
    setSearchQuery,
    setMapFilter,
    setShowExportDialog,
    setShowChangeHistory,
    handleEditBinding: (binding: HotkeyBinding) => {
      setSelectedBindingId(binding.id);
    },
    handleAdoptBinding: async (binding: HotkeyBinding) => {
      if (!activeProfileId) {
        setError('请先选择或创建方案');
        return;
      }

      const activeProfile = profiles.find((profile) => profile.id === activeProfileId);
      if (!activeProfile || typeof window.atm.saveProfileBindings !== 'function') {
        return;
      }

      const newBinding = {
        id: binding.id,
        key: binding.key,
        command: binding.command,
        type: binding.type,
        enabled: true,
        note: `从 env 接管: ${binding.command}`,
      };

      await window.atm.saveProfileBindings(activeProfileId, [...activeProfile.bindings, newBinding]);
      setBindings((current) =>
        current.map((item) =>
          item.id === binding.id
            ? {
                ...item,
                isAdopted: true,
                bindingSource: 'active_profile',
                profileId: activeProfileId,
                profileName: activeProfile.name,
              }
            : item,
        ),
      );
    },
    handleOverrideSource: (binding: HotkeyBinding) => {
      setPendingOverrideBinding(binding);
      setSelectedBindingId(binding.id);
    },
    handleCreatePlan: async () => {
      if (!envInfo?.envFilePath || typeof window.atm.createApplyPlan !== 'function') {
        setError('env 文件路径未知');
        return;
      }

      const result = await window.atm.createApplyPlan(envInfo.envFilePath);
      if (result.success && result.data) {
        setPlan(result.data);
      } else {
        setError(result.error || '生成 Apply Plan 失败');
      }
    },
    handleEditBindingById: (bindingId: string) => {
      setSelectedBindingId(bindingId);
    },
    handleIgnoreConflict: (conflictId: string) => {
      setConflictIgnoreList((current) => {
        if (current.includes(conflictId)) {
          return current;
        }
        const updated = [...current, conflictId];
        try {
          localStorage.setItem('atm_conflict_ignore', JSON.stringify(updated));
        } catch {
          // ignore localStorage failures
        }
        return updated;
      });
    },
    handleViewRawLine: (filePath: string, lineNumber: number, isReference?: boolean) => {
      setRawLineView({ filePath, lineNumber, isReference });
    },
    handleOverrideByCommand: (command: string) => {
      const targetBinding = bindings.find((binding) => binding.command === command) ?? null;
      setPendingOverrideBinding(targetBinding);
      setSelectedBindingId(targetBinding?.id ?? null);
    },
    handleApplyPlan: async () => {
      if (!plan || typeof window.atm.applyPlan !== 'function') {
        return;
      }

      setLoading(true);
      try {
        const result = await window.atm.applyPlan(JSON.stringify(plan));
        if (result.success) {
          setPlan(null);
          await loadAll();
        } else {
          setError(result.error || '执行 Apply Plan 失败');
        }
      } finally {
        setLoading(false);
      }
    },
    clearPlan: () => setPlan(null),
    handleEnvImportClick: () => {
      if (
        typeof window.atm.openEnvFileDialog !== 'function' ||
        typeof window.atm.parseImportEnvFile !== 'function'
      ) {
        return;
      }

      void (async () => {
        try {
          const dialogResult = await window.atm.openEnvFileDialog();
          if (!dialogResult.success || !dialogResult.data) {
            if (dialogResult.info !== '取消选择') {
              setError(`选择文件失败: ${dialogResult.error || ''}`);
            }
            return;
          }

          const parseResult = await window.atm.parseImportEnvFile(dialogResult.data);
          if (!parseResult.success || !parseResult.data) {
            setError(`解析 env 文件失败: ${parseResult.error || ''}`);
            return;
          }

          const preview = parseResult.data;
          if (typeof window.atm.computeImportConflicts === 'function') {
            const conflictResult = await window.atm.computeImportConflicts({
              entries: preview.entries,
              currentBindings: bindings,
              reservedBindings,
            });
            if (conflictResult.success && conflictResult.data) {
              preview.conflicts = conflictResult.data;
            }
          }

          setEnvImportPreview(preview);
        } catch (err) {
          setError(`导入过程异常: ${String(err)}`);
        }
      })();
    },
    handleImportProfileClick: () => undefined,
    handleExportProfile: async () => {
      if (!activeProfileId || typeof window.atm.exportProfile !== 'function') {
        return;
      }
      const result = await window.atm.exportProfile(activeProfileId);
      if (result.success && result.data) {
        const blob = new Blob([result.data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const profileName = profiles.find((profile) => profile.id === activeProfileId)?.name || 'profile';
        link.download = `${profileName}.atm-profile.json`;
        link.click();
        URL.revokeObjectURL(url);
      }
    },
  };

  return (
    <div className="hotkey-workspace-page">
      <HotkeySubnav />
      <Routes>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<HotkeyOverviewPanel sharedState={sharedState} actions={actions} />} />
        <Route path="editor" element={<HotkeyEditorPanel sharedState={sharedState} actions={actions} />} />
        <Route path="conflicts" element={<HotkeyConflictsPanel sharedState={sharedState} actions={actions} />} />
        <Route
          path="import-export"
          element={<HotkeyImportExportPanel sharedState={sharedState} actions={actions} />}
        />
      </Routes>
    </div>
  );
}
