import type { MapFilter, MapViewMode } from '../HotkeyMap';
import type { ActiveLayer } from '../../utils/hotkeyItem';
import type {
  ApplyPlan,
  Conflict,
  EnvEntry,
  EnhancedConflict,
  HotkeyBinding,
  HotkeyProfile,
} from '../../types/hotkey';
import type {
  AtmSettings,
  EnvironmentInfo,
  EnvSourceList,
} from '../../types/environment';
import type { EnvImportPreview } from '../../types/importEnv';

export interface HotkeyWorkspaceUndoStatus {
  canUndo: boolean;
  message: string;
}

export interface HotkeyWorkspaceStats {
  total: number;
  funckeyCount: number;
  aliasCount: number;
  errorCount: number;
  warningCount: number;
  overlayConflictCount: number;
}

export interface HotkeyWorkspaceSharedState {
  loading: boolean;
  error: string | null;
  envInfo: EnvironmentInfo | null;
  profiles: HotkeyProfile[];
  activeProfileId: string;
  appliedProfileId: string;
  bindings: HotkeyBinding[];
  reservedBindings: HotkeyBinding[];
  filteredConflicts: Conflict[];
  enhancedConflicts: EnhancedConflict[];
  activeLayer: ActiveLayer;
  viewMode: MapViewMode;
  mapFilter: MapFilter;
  searchQuery: string;
  parseWarnings: string[];
  entries: EnvEntry[];
  reservedKeysWarning: string | null;
  favoriteIds: string[];
  undoStatus: HotkeyWorkspaceUndoStatus;
  rawLineView: { filePath: string; lineNumber: number; isReference?: boolean } | null;
  envImportPreview: EnvImportPreview | null;
  pendingOverrideBinding: HotkeyBinding | null;
  stats: HotkeyWorkspaceStats;
  envSources: EnvSourceList | null;
  settings: AtmSettings | null;
}

export interface HotkeyWorkspaceActions {
  selectedBindingId: string | null;
  tableBindings: HotkeyBinding[];
  conflictIgnoreList: string[];
  plan: ApplyPlan | null;
  setSelectedBindingId: (value: string | null) => void;
  setSearchQuery: (value: string) => void;
  setMapFilter: (value: MapFilter) => void;
  setShowExportDialog: (value: boolean) => void;
  setShowChangeHistory: (value: boolean) => void;
  handleEditBinding: (binding: HotkeyBinding) => void;
  handleAdoptBinding: (binding: HotkeyBinding) => void;
  handleOverrideSource: (binding: HotkeyBinding) => void;
  handleCreatePlan: () => Promise<void>;
  handleEditBindingById: (bindingId: string) => void;
  handleIgnoreConflict: (conflictId: string) => void;
  handleViewRawLine: (filePath: string, lineNumber: number, isReference?: boolean) => void;
  handleOverrideByCommand: (command: string) => void;
  handleApplyPlan: () => Promise<void>;
  clearPlan: () => void;
  handleEnvImportClick: () => void;
  handleImportProfileClick: () => void;
  handleExportProfile: () => Promise<void>;
}

export interface HotkeyWorkspacePanelProps {
  sharedState: HotkeyWorkspaceSharedState;
  actions: HotkeyWorkspaceActions;
}

export interface HotkeyOverviewPanelProps extends HotkeyWorkspacePanelProps {}

export interface HotkeyEditorPanelProps extends HotkeyWorkspacePanelProps {}

export interface HotkeyConflictsPanelProps extends HotkeyWorkspacePanelProps {}

export interface HotkeyImportExportPanelProps extends HotkeyWorkspacePanelProps {}
