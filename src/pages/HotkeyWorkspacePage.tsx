import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import type { MapFilter, MapViewMode } from '../components/HotkeyMap';
import ChangeHistoryDialog from '../components/ChangeHistoryDialog';
import EnvImportDialog from '../components/EnvImportDialog';
import ExportCheatsheetDialog from '../components/ExportCheatsheetDialog';
import ImportPreviewDialog from '../components/ImportPreviewDialog';
import type { ImportPreviewData } from '../components/ImportPreviewDialog';
import ProfileBar from '../components/ProfileBar';
import RawLineView from '../components/RawLineView';
import HotkeyConflictsPanel from '../components/hotkeys/HotkeyConflictsPanel';
import HotkeyEditorPanel from '../components/hotkeys/HotkeyEditorPanel';
import HotkeyImportExportPanel from '../components/hotkeys/HotkeyImportExportPanel';
import HotkeyOverviewPanel from '../components/hotkeys/HotkeyOverviewPanel';
import HotkeySubnav from '../components/hotkeys/HotkeySubnav';
import type {
  HotkeyWorkspaceActions,
  HotkeyWorkspaceSharedState,
  HotkeyWorkspaceStats,
  HotkeyWorkspaceUndoStatus,
} from '../components/hotkeys/types';
import type { ApplyPlan, Conflict, EnhancedConflict, EnvEntry, HotkeyBinding, HotkeyProfile } from '../types/hotkey';
import type { AtmSettings, EnvironmentInfo, EnvSourceList } from '../types/environment';
import type { EnvImportPreview, ImportResult } from '../types/importEnv';
import type { ActiveLayer } from '../utils/hotkeyItem';
import { enrichWithPhysicalKey, filterHotkeysByKeyboardLayer } from '../utils/hotkeyItem';
import { HOTKEY_WORKSPACE_SCALE_CONFIG } from '../layout/responsiveScale';
import { useResponsiveScale } from '../layout/useResponsiveScale';
import { loadHotkeyWorkspaceData } from './HotkeyPage';

type ImportedProfileHotkey = {
  type?: string;
  rawKey?: string;
  command?: string;
  zhName?: string;
  enabled?: boolean;
};

type ImportedProfilePayload = {
  type?: string;
  profile?: {
    id?: string;
    name?: string;
    description?: string;
    hotkeys?: ImportedProfileHotkey[];
  };
};

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

function validateImportProfile(parsed: ImportedProfilePayload): { valid: boolean; error?: string } {
  const hotkeys = parsed?.profile?.hotkeys;

  if (!parsed || typeof parsed !== 'object' || parsed.type !== 'atm_hotkey_profile' || !parsed.profile || !Array.isArray(hotkeys)) {
    return { valid: false, error: '导入失败：文件不是有效的 ATM 快捷键方案' };
  }

  if (hotkeys.length === 0) {
    return { valid: false, error: '导入失败：快捷键方案中没有快捷键' };
  }

  for (let index = 0; index < hotkeys.length; index += 1) {
    const hotkey = hotkeys[index];
    if (!hotkey.type || !hotkey.rawKey || !hotkey.command) {
      return {
        valid: false,
        error: `导入失败：第 ${index + 1} 条快捷键缺少必要字段（type/rawKey/command）`,
      };
    }
  }

  return { valid: true };
}

function buildImportPreview(
  parsed: ImportedProfilePayload,
  profiles: HotkeyProfile[],
  bindings: HotkeyBinding[],
  reservedBindings: HotkeyBinding[],
): ImportPreviewData {
  const profile = parsed.profile ?? {};
  const hotkeys = profile.hotkeys ?? [];
  const funckeyCount = hotkeys.filter((item) => item.type === 'funckey').length;
  const aliasCount = hotkeys.filter((item) => item.type === 'alias').length;
  const envKeySet = new Set(bindings.map((binding) => binding.key.toLowerCase()));
  const reservedKeySet = new Set(reservedBindings.map((binding) => binding.key.toLowerCase()));

  return {
    profileName: profile.name || '未命名方案',
    profileDescription: profile.description || '',
    profileId: profile.id || '',
    totalHotkeys: hotkeys.length,
    funckeyCount,
    aliasCount,
    sameNameProfiles: profiles.filter((item) => item.name === profile.name).map((item) => item.name),
    envConflictCount: hotkeys.filter((item) => item.rawKey && envKeySet.has(item.rawKey.toLowerCase())).length,
    reservedOverrideCount: hotkeys.filter((item) => item.rawKey && reservedKeySet.has(item.rawKey.toLowerCase())).length,
    bindings: hotkeys.map((item) => ({
      key: item.rawKey || '',
      command: item.command || '',
      type: (item.type === 'alias' ? 'alias' : 'funckey') as 'funckey' | 'alias',
      chineseName: item.zhName,
      enabled: item.enabled !== false,
    })),
    rawJson: JSON.stringify(parsed),
  };
}

export default function HotkeyWorkspacePage() {
  const navigate = useNavigate();
  const { elementRef, scale: workspaceScale } =
    useResponsiveScale<HTMLDivElement>(HOTKEY_WORKSPACE_SCALE_CONFIG);
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
  const [activeLayer, setActiveLayer] = useState<ActiveLayer>('normal');
  const [viewMode, setViewMode] = useState<MapViewMode>('my');
  const [mapFilter, setMapFilter] = useState<MapFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBindingId, setSelectedBindingId] = useState<string | null>(null);
  const [conflictIgnoreList, setConflictIgnoreList] = useState<string[]>([]);
  const [plan, setPlan] = useState<ApplyPlan | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showChangeHistory, setShowChangeHistory] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [undoStatus, setUndoStatus] = useState<HotkeyWorkspaceUndoStatus>({ canUndo: false, message: '' });
  const [rawLineView, setRawLineView] = useState<{ filePath: string; lineNumber: number; isReference?: boolean } | null>(null);
  const [envImportPreview, setEnvImportPreview] = useState<EnvImportPreview | null>(null);
  const [importPreviewData, setImportPreviewData] = useState<ImportPreviewData | null>(null);
  const [pendingOverrideBinding, setPendingOverrideBinding] = useState<HotkeyBinding | null>(null);
  const hasLoadedInitially = useRef(false);
  const isMountedRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canSafelySetState = useCallback(
    () => isMountedRef.current && typeof window !== 'undefined',
    [],
  );

  const applyLoadedData = useCallback((loaded: Awaited<ReturnType<typeof loadHotkeyWorkspaceData>>) => {
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
  }, []);

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
        applyLoadedData(loaded);
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
  }, [activeProfileId, applyLoadedData, canSafelySetState]);

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

  const switchProfile = useCallback(async (profileId: string) => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadHotkeyWorkspaceData(profileId);
      if (!canSafelySetState()) {
        return;
      }
      flushSync(() => {
        applyLoadedData(loaded);
        setLoading(false);
      });
    } catch (err) {
      if (canSafelySetState()) {
        flushSync(() => {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        });
      }
    }
  }, [applyLoadedData, canSafelySetState]);

  const layerFilteredBindings = useMemo(() => {
    const enrichedBindings = bindings.map((binding) => enrichWithPhysicalKey(binding));
    return filterHotkeysByKeyboardLayer(enrichedBindings, activeLayer);
  }, [activeLayer, bindings]);

  const handleSwitchProfile = useCallback(async (profileId: string) => {
    await switchProfile(profileId);
  }, [switchProfile]);

  const handleCreateProfile = useCallback(async (name: string) => {
    const result = await window.atm.createProfile(name);
    if (!result.success || !result.data) {
      setError(result.error || '创建方案失败');
      return;
    }
    await switchProfile(result.data.id);
  }, [switchProfile]);

  const handleCopyProfile = useCallback(async (profileId: string) => {
    const result = await window.atm.copyProfile(profileId);
    if (!result.success || !result.data) {
      setError(result.error || '复制方案失败');
      return;
    }
    await switchProfile(result.data.id);
  }, [switchProfile]);

  const handleRenameProfile = useCallback(async (profileId: string, newName: string) => {
    const result = await window.atm.renameProfile(profileId, newName);
    if (!result.success) {
      setError(result.error || '重命名方案失败');
      return;
    }
    await switchProfile(profileId);
  }, [switchProfile]);

  const handleDeleteProfile = useCallback(async (profileId: string) => {
    const result = await window.atm.deleteProfile(profileId);
    if (!result.success) {
      setError(result.error || '删除方案失败');
      return;
    }
    const nextProfileId = profiles.find((profile) => profile.id !== profileId)?.id || '';
    if (nextProfileId) {
      await switchProfile(nextProfileId);
      return;
    }
    await loadAll();
  }, [loadAll, profiles, switchProfile]);

  const handleApplyActiveProfile = useCallback(async () => {
    if (!envInfo?.envFilePath || !activeProfileId || typeof window.atm.createApplyPlan !== 'function') {
      setError('当前方案或 env 路径不可用');
      return;
    }
    const result = await window.atm.createApplyPlan(envInfo.envFilePath, activeProfileId);
    if (!result.success || !result.data) {
      setError(result.error || '生成 Apply Plan 失败');
      return;
    }
    await window.atm.setAppliedHotkeyProfile(activeProfileId);
    setAppliedProfileId(activeProfileId);
    setPlan(result.data);
  }, [activeProfileId, envInfo?.envFilePath]);

  const stats = useMemo(
    () => buildStats(layerFilteredBindings, conflicts),
    [conflicts, layerFilteredBindings],
  );

  const sharedState: HotkeyWorkspaceSharedState = {
    workspaceScale,
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
    reloadData: loadAll,
    setActiveLayer,
    setSelectedBindingId,
    setViewMode,
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

      const result = await window.atm.createApplyPlan(envInfo.envFilePath, activeProfileId);
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
      if (!filePath || lineNumber <= 0) {
        setRawLineView(null);
        return;
      }
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
    handleImportProfileClick: () => {
      fileInputRef.current?.click();
    },
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

  const handleFileSelected = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const parsed = JSON.parse(await file.text()) as ImportedProfilePayload;
      const validation = validateImportProfile(parsed);
      if (!validation.valid) {
        setError(validation.error || '导入失败：文件不是有效的 ATM 快捷键方案');
        return;
      }

      setImportPreviewData(buildImportPreview(parsed, profiles, bindings, reservedBindings));
    } catch (err) {
      setError(`导入失败：${String(err)}`);
    } finally {
      event.target.value = '';
    }
  }, [bindings, profiles, reservedBindings]);

  const handleImportAsNew = useCallback(async (data: ImportPreviewData) => {
    try {
      const existingName = profiles.find((profile) => profile.name === data.profileName);
      const targetName = existingName ? `${data.profileName} 副本` : data.profileName;
      const createResult = await window.atm.createProfile(targetName, data.profileDescription);
      if (!createResult.success || !createResult.data) {
        setError(`创建方案失败: ${createResult.error || ''}`);
        return;
      }

      const saveResult = await window.atm.saveProfileBindings(
        createResult.data.id,
        data.bindings.map((binding) => ({
          ...binding,
          id: `imported_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        })),
      );
      if (!saveResult.success || !saveResult.data) {
        setError(`保存快捷键失败: ${saveResult.error || ''}`);
        return;
      }

      setImportPreviewData(null);
      setProfiles((current) => [...current, saveResult.data as HotkeyProfile]);
      setActiveProfileId(saveResult.data.id);
    } catch (err) {
      setError(`导入方案时发生异常: ${String(err)}`);
    }
  }, [profiles]);

  const handleImportAndPreview = useCallback(async (data: ImportPreviewData) => {
    try {
      const existingName = profiles.find((profile) => profile.name === data.profileName);
      const targetName = existingName ? `${data.profileName} 副本` : data.profileName;
      const createResult = await window.atm.createProfile(targetName, data.profileDescription);
      if (!createResult.success || !createResult.data) {
        setError(`创建方案失败: ${createResult.error || ''}`);
        return;
      }

      const saveResult = await window.atm.saveProfileBindings(
        createResult.data.id,
        data.bindings.map((binding) => ({
          ...binding,
          id: `imported_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        })),
      );
      if (!saveResult.success || !saveResult.data) {
        setError(`保存快捷键失败: ${saveResult.error || ''}`);
        return;
      }

      setImportPreviewData(null);
      setProfiles((current) => [...current, saveResult.data as HotkeyProfile]);
      setActiveProfileId(saveResult.data.id);

      if (!envInfo?.envFilePath) {
        return;
      }

      const planResult = await window.atm.createApplyPlan(envInfo.envFilePath, saveResult.data.id);
      if (!planResult.success || !planResult.data) {
        setError(`生成 Apply Plan 失败: ${planResult.error || ''}`);
        return;
      }

      setPlan(planResult.data);
      navigate('/hotkeys/conflicts');
    } catch (err) {
      setError(`导入并预览方案时发生异常: ${String(err)}`);
    }
  }, [envInfo?.envFilePath, navigate, profiles]);

  const handleEnvImported = useCallback(async (result: ImportResult) => {
    setEnvImportPreview(null);
    await loadAll();

    if (!result.success) {
      setError(result.error || 'env 导入未完成');
    }
  }, [loadAll]);

  const handleExportSave = useCallback(async (content: string, filename: string) => {
    try {
      const result = await window.atm.saveExportedFile(content, filename, [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'HTML', extensions: ['html', 'htm'] },
      ]);

      if (!result.success && result.info !== '取消保存') {
        setError(`导出失败: ${result.error || ''}`);
      }
    } catch (err) {
      setError(`导出异常: ${String(err)}`);
    }
  }, []);

  return (
    <div
      ref={elementRef}
      className="hotkey-workspace-page"
      style={{ '--hotkey-scale': String(workspaceScale) } as React.CSSProperties}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelected}
        style={{ display: 'none' }}
      />
      <div className="hotkey-workspace-content">
        <ProfileBar
          title="快捷键方案"
          compact
          profiles={profiles}
          activeProfileId={activeProfileId}
          appliedProfileId={appliedProfileId}
          onCreate={(name) => {
            void handleCreateProfile(name);
          }}
          onCopy={(profileId) => {
            void handleCopyProfile(profileId);
          }}
          onRename={(profileId, newName) => {
            void handleRenameProfile(profileId, newName);
          }}
          onDelete={(profileId) => {
            void handleDeleteProfile(profileId);
          }}
          onSwitch={(profileId) => {
            void handleSwitchProfile(profileId);
          }}
          onApply={() => {
            void handleApplyActiveProfile();
          }}
          onImport={() => {
            fileInputRef.current?.click();
          }}
          onExport={() => {
            void actions.handleExportProfile();
          }}
          applyLabel="应用此方案"
        />
        <HotkeySubnav />
        <Routes>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<HotkeyOverviewPanel sharedState={sharedState} actions={actions} />} />
          <Route path="editor" element={<HotkeyEditorPanel state={sharedState} actions={actions} />} />
          <Route path="conflicts" element={<HotkeyConflictsPanel state={sharedState} actions={actions} />} />
          <Route
            path="import-export"
            element={<HotkeyImportExportPanel sharedState={sharedState} actions={actions} />}
          />
        </Routes>
      </div>

      {rawLineView ? (
        <div className="modal-overlay" onClick={() => setRawLineView(null)}>
          <div className="modal-dialog" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 650 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 15 }}>原始行查看</h3>
              <button className="btn btn-sm" onClick={() => setRawLineView(null)}>
                关闭
              </button>
            </div>
            <div className="modal-body" style={{ padding: '8px 0' }}>
              <RawLineView
                filePath={rawLineView.filePath}
                lineNumber={rawLineView.lineNumber}
                isReference={rawLineView.isReference}
                onClose={() => setRawLineView(null)}
              />
            </div>
          </div>
        </div>
      ) : null}

      {importPreviewData ? (
        <ImportPreviewDialog
          data={importPreviewData}
          onClose={() => setImportPreviewData(null)}
          onImportAsNew={(data) => void handleImportAsNew(data)}
          onImportAndPreview={(data) => void handleImportAndPreview(data)}
        />
      ) : null}

      {showChangeHistory && envInfo?.pcbenvPath ? (
        <ChangeHistoryDialog
          pcbenvPath={envInfo.pcbenvPath}
          onClose={() => {
            setShowChangeHistory(false);
            void loadAll();
          }}
          onRefresh={() => {
            void loadAll();
          }}
        />
      ) : null}

      {showExportDialog ? (
        <ExportCheatsheetDialog
          bindings={bindings}
          favorites={favoriteIds}
          activeProfileId={activeProfileId}
          profileName={profiles.find((profile) => profile.id === activeProfileId)?.name}
          onClose={() => setShowExportDialog(false)}
          onExport={(content, filename) => {
            void handleExportSave(content, filename);
          }}
        />
      ) : null}

      {envImportPreview && envInfo?.pcbenvPath ? (
        <EnvImportDialog
          preview={envImportPreview}
          currentBindings={bindings}
          currentProfile={profiles.find((profile) => profile.id === activeProfileId) || null}
          reservedBindings={reservedBindings}
          pcbenvPath={envInfo.pcbenvPath}
          userEnvFilePath={envInfo.envFilePath ?? undefined}
          envSources={envSources}
          profiles={profiles}
          activeProfileId={activeProfileId}
          onClose={() => setEnvImportPreview(null)}
          onImported={(result) => {
            void handleEnvImported(result);
          }}
        />
      ) : null}
    </div>
  );
}
