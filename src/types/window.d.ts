/**
 * ATM - window.atm 全局类型声明
 * 所有页面和组件共享的 window.atm 类型
 */
import type { ApplyPlan, Conflict, HotkeyBinding, HotkeyProfile } from './hotkey';
import type { EnvironmentInfo, EnvSourceList, AtmSettings, EnvironmentRegistry, AllegroEnvironmentWorkspace, ProfileCompatibilityReport, CompatibilityEvidenceRecord, AllegroRuntimeVerificationResult } from './environment';
import type { EnvImportPreview, ImportResult, ImportExecuteParams } from './importEnv';
import type { ImpactAnalysis, StaleRefInfo, SkillApplyPlan, SkillUsageInfo, SkillConfigFile, UsageTreeNode } from './skill';
import type { RuntimeInfo } from './runtime';
import type { BridgeSetupStatus } from '../../core/color/vibeBridgeInstaller';
import type { UpdateSettings, UpdateSettingsView, UpdateState } from './updates';

declare global {
  interface Window {
    atm: {
      // 环境检测
      locateEnvironment: (manualPcbenvPath?: string) => Promise<{ success: boolean; data?: EnvironmentInfo; error?: string }>;
      listAllegroEnvironments: (refresh?: boolean, manualPcbenvPath?: string) => Promise<{ success: boolean; data?: EnvironmentRegistry; error?: string }>;
      setActiveAllegroEnvironment: (environmentId: string) => Promise<{ success: boolean; data?: { registry: EnvironmentRegistry; environment?: AllegroEnvironmentWorkspace }; error?: string }>;
      addAllegroInstallRoot: () => Promise<{ success: boolean; data?: { registry: EnvironmentRegistry; selectedRoot: string } | null; error?: string }>;
      removeAllegroInstallRoot: (installRoot: string) => Promise<{ success: boolean; data?: EnvironmentRegistry; error?: string }>;
      listCompatibilityRecords: (filters?: Partial<Pick<CompatibilityEvidenceRecord, 'environmentId' | 'scope' | 'subjectId'>>) => Promise<{ success: boolean; data?: CompatibilityEvidenceRecord[]; error?: string }>;
      saveCompatibilityRecord: (record: Omit<CompatibilityEvidenceRecord, 'id' | 'checkedAt'>) => Promise<{ success: boolean; data?: CompatibilityEvidenceRecord; error?: string }>;
      verifyAllegroRuntime: (environmentId: string) => Promise<{ success: boolean; data?: { result: AllegroRuntimeVerificationResult; record: CompatibilityEvidenceRecord }; error?: string }>;
      selectPcbenv: () => Promise<{ success: boolean; data?: string | null; error?: string }>;
      checkFileAccess: (filePath: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      getHealthScore: () => Promise<{ success: boolean; data?: any; error?: string }>;
      getEnvVars: (names: string[]) => Promise<{ success: boolean; data?: Record<string, string | null>; error?: string }>;

      // 快捷键管理
      parseEnvFile: (filePath: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      validateHotkeys: (filePath: string) => Promise<{ success: boolean; data?: { bindings: HotkeyBinding[]; conflicts: Conflict[] }; error?: string }>;
      createBackup: (filePath: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      createApplyPlan: (filePath: string, profileId?: string) => Promise<{ success: boolean; data?: ApplyPlan; error?: string }>;
      applyPlan: (planJson: string) => Promise<{ success: boolean; appliedSteps: number; totalSteps: number; rollbackPath?: string; error?: string }>;

      // Skill 管理
      scanSkills: () => Promise<{ success: boolean; data?: any; error?: string }>;
      parseSkillFile: (filePath: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      getCommandRegistry: () => Promise<{ success: boolean; data?: any; error?: string }>;
      toggleSkill: (skillPath: string, enabled: boolean) => Promise<{ success: boolean; data?: any; error?: string }>;
      generateSkillLoader: () => Promise<{ success: boolean; data?: string; error?: string }>;
      validateSkillRefs: (bindingsJson: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      applySkillChanges: (planJson: string) => Promise<{ success: boolean; error?: string }>;

      // Profile 管理
      listProfiles: () => Promise<{ success: boolean; data?: HotkeyProfile[]; error?: string }>;
      createProfile: (name: string, description?: string) => Promise<{ success: boolean; data?: HotkeyProfile; error?: string }>;
      copyProfile: (profileId: string, newName?: string) => Promise<{ success: boolean; data?: HotkeyProfile; error?: string }>;
      renameProfile: (profileId: string, newName: string) => Promise<{ success: boolean; error?: string }>;
      deleteProfile: (profileId: string) => Promise<{ success: boolean; error?: string }>;
      exportProfile: (profileId: string) => Promise<{ success: boolean; data?: string; error?: string }>;
      importProfile: (jsonStr: string) => Promise<{ success: boolean; data?: HotkeyProfile; error?: string }>;
      diffProfiles: (sourceId: string, targetId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      saveProfileBindings: (profileId: string, bindings: any[]) => Promise<{ success: boolean; data?: HotkeyProfile; error?: string }>;
      setAppliedHotkeyProfile: (profileId: string) => Promise<{ success: boolean; error?: string }>;
      getAppliedHotkeyProfile: () => Promise<{ success: boolean; data?: { profileId: string }; error?: string }>;
      checkHotkeyProfileCompatibility: (profileId: string, targetEnvironmentId: string) => Promise<{ success: boolean; data?: ProfileCompatibilityReport; error?: string }>;
      migrateHotkeyProfile: (profileId: string, targetEnvironmentId: string) => Promise<{ success: boolean; data?: { profile: HotkeyProfile; report: ProfileCompatibilityReport; sharedPcbenv: boolean }; error?: string }>;

      // 保留键
      getReservedBindings: () => Promise<{ success: boolean; data?: any; error?: string }>;

      // 编辑校验
      validateHotkeyEdit: (editData: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      generateEditPlan: (editRequest: any, currentBinding: any, filePath: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      generateAddPlan: (key: string, command: string, type: string, filePath: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      executeEditPlan: (planJson: string, filePath: string) => Promise<{ success: boolean; error?: string }>;
      saveCommandOverride: (command: string, source: string, note?: string) => Promise<{ success: boolean; error?: string }>;

      // V3.0 多 env 来源
      scanAllEnvironments: (manualPcbenvPath?: string) => Promise<{ success: boolean; data?: { sources: EnvSourceList; settings: AtmSettings | null }; error?: string }>;
      loadSettings: (pcbenvPath?: string) => Promise<{ success: boolean; data?: AtmSettings | null; error?: string }>;
      saveSettings: (pcbenvPath: string, settings: any) => Promise<{ success: boolean; error?: string }>;
      setActiveEnv: (pcbenvPath: string, envPath: string) => Promise<{ success: boolean; data?: AtmSettings; error?: string }>;
      addReferenceEnv: (pcbenvPath: string) => Promise<{ success: boolean; data?: AtmSettings; error?: string; selectedPath?: string }>;
      removeReferenceEnv: (pcbenvPath: string, refPath: string) => Promise<{ success: boolean; data?: AtmSettings; error?: string }>;
      openEnvSourceFolder: (sourcePath: string) => Promise<{ success: boolean; error?: string }>;

      // V4.0 变更历史
      loadChangeHistory: (pcbenvPath: string) => Promise<{ success: boolean; data?: { records: any[] }; error?: string }>;
      getLastChange: (pcbenvPath: string) => Promise<{ success: boolean; data?: { canUndo: boolean; record?: any }; error?: string }>;
      undoLastChange: (pcbenvPath: string) => Promise<{ success: boolean; error?: string }>;
      addChangeRecord: (pcbenvPath: string, record: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      clearChangeHistory: (pcbenvPath: string) => Promise<{ success: boolean; error?: string }>;

      // V4.0 原始行查看
      readRawLine: (filePath: string, lineNumber: number, isReference?: boolean) => Promise<{ success: boolean; data?: any; error?: string }>;
      copyRawLine: (filePath: string, lineNumber: number) => Promise<{ success: boolean; data?: string; error?: string }>;
      getEnvFilePreview: (filePath: string, maxLines?: number) => Promise<{ success: boolean; data?: any; error?: string }>;

      // V4.0 Skill 加载检查
      checkSkillLoad: (skillName: string, envInfo: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      checkAllSkillLoadStatuses: (skillNames: string[], envInfo: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      scanLoadSources: (envInfo: any) => Promise<{ success: boolean; data?: any; error?: string }>;

      // V4.5 Skill 增强管理
      enhancedScanSkills: () => Promise<{ success: boolean; data?: any; error?: string }>;
      getEnhancedCommandList: () => Promise<{ success: boolean; data?: any; error?: string }>;
      getSkillDetail: (skillPath: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      enhancedValidateRefs: (bindingsJson: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      addReadonlySkillDir: (dirPath: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      selectReadonlySkillDir: () => Promise<{ success: boolean; data?: string | null; error?: string }>;
      importSkillPreview: (filePathOrDir: string) => Promise<{ success: boolean; data?: any; error?: string }>;

      // V4.0 增强冲突检测
      detectEnhancedConflicts: (params: any) => Promise<{ success: boolean; data?: any; error?: string }>;

      // V4.0 推荐可用键位
      getRecommendedKeys: (options: any) => Promise<{ success: boolean; data?: any[]; error?: string }>;

      // V4.0 收藏
      toggleFavorite: (pcbenvPath: string, bindingId: string) => Promise<{ success: boolean; data?: { isFavorite: boolean; favorites: { favoriteBindingIds: string[] } }; error?: string }>;
      loadFavorites: (pcbenvPath: string) => Promise<{ success: boolean; data?: { favoriteBindingIds: string[] }; error?: string }>;
      getFavoriteBindings: (pcbenvPath: string, bindingsJson: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;

      // V4.0 导出
      exportCheatsheet: (bindingsJson: string, options: any) => Promise<{ success: boolean; data?: { markdown: string; html: string; filename: string; bindingCount: number }; error?: string }>;
      saveExportedFile: (content: string, defaultName: string, filter: any) => Promise<{ success: boolean; data?: string; error?: string; info?: string }>;

      // V4.0 env 文件导入
      openEnvFileDialog: () => Promise<{ success: boolean; data?: string | null; error?: string; info?: string }>;
      parseImportEnvFile: (filePath: string) => Promise<{ success: boolean; data?: EnvImportPreview; error?: string }>;
      computeImportConflicts: (params: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      executeEnvImport: (params: ImportExecuteParams) => Promise<{ success: boolean; data?: ImportResult; error?: string }>;

      // V5.0 Skill 元数据管理（中文备注/自动简介）
      skillMetaGetAll: () => Promise<{ success: boolean; data?: Record<string, any>; error?: string }>;
      skillMetaGet: (skillId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      skillMetaSave: (skillId: string, meta: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      skillMetaAnalyze: (skillJson: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      skillMetaAnalyzeAll: (skillsJson: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      skillMetaClearAuto: (skillId: string) => Promise<{ success: boolean; error?: string }>;

      // V5.1 Skill 命令引用识别 + 删除影响分析
      analyzeSkillImpact: (skillPath: string, bindingsJson: string) =>
        Promise<{ success: boolean; data?: ImpactAnalysis; error?: string }>;
      createDeletePlan: (skillPath: string, option: string) =>
        Promise<{ success: boolean; data?: SkillApplyPlan; error?: string }>;
      checkStaleRefs: (bindingsJson: string) =>
        Promise<{ success: boolean; data?: StaleRefInfo[]; error?: string }>;

      // V5.2 Skill 使用状态/健康度/使用关系树/配置/说明
      computeSkillUsageStatuses: () =>
        Promise<{ success: boolean; data?: Record<string, SkillUsageInfo>; error?: string }>;
      computeSkillHealthScores: () =>
        Promise<{ success: boolean; data?: Record<string, { score: number; deductions: any[] }>; error?: string }>;
      buildSkillUsageTree: (skillPath: string, bindingsJson: string) =>
        Promise<{ success: boolean; data?: UsageTreeNode; error?: string }>;
      scanSkillConfigFiles: (skillDir: string, skillName: string) =>
        Promise<{ success: boolean; data?: SkillConfigFile[]; error?: string }>;
      generateSkillReadme: (skillPath: string, metaJson: string) =>
        Promise<{ success: boolean; data?: string; error?: string }>;
      toggleSkillSafe: (skillPath: string, enabled: boolean) =>
        Promise<{ success: boolean; data?: { needImpactAnalysis: boolean; impact?: ImpactAnalysis; plan?: SkillApplyPlan }; error?: string }>;
      getSkillLoaderOrder: () =>
        Promise<{ success: boolean; data?: { order: Array<{ index: number; name: string; path: string; loadStatus: string; hasDependencies: boolean; dependencies: string[]; fileExists: boolean; isEnabled: boolean }>; issues: Array<{ type: string; severity: string; message: string }> }; error?: string }>;
      exportSkillPackage: (skillPath: string, optionsJson: string) =>
        Promise<{ success: boolean; data?: any; error?: string }>;
      findUnusedSkills: (bindingsJson: string) =>
        Promise<{ success: boolean; data?: Array<{ id: string; name: string; path: string; tier: string; entryCommands: string[]; lastModified?: string; loadStatus: string }>; error?: string }>;

      // ===== V5.5 菜单管理（可视化菜单编辑） =====
      /** 加载所有菜单方案 */
      menuLoadProfiles: () => Promise<{ success: boolean; data?: any; error?: string }>;
      /** 保存菜单草稿（不走 Apply Plan） */
      menuSaveDraft: (storeJson: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      /** 验证菜单引用 */
      menuValidate: (itemsJson: string, commandsJson: string, skillsJson: string) =>
        Promise<{ success: boolean; data?: { issues: any[]; items: any[] }; error?: string }>;
      /** 预览 generated_menu.il */
      menuGeneratePreview: (profileJson: string) =>
        Promise<{ success: boolean; data?: { ilContent: string; profileJson: string; itemCount: any }; error?: string }>;
      /** 生成菜单 Apply Plan */
      menuCreateApplyPlan: (profileJson: string, storeJson?: string) =>
        Promise<{ success: boolean; data?: any; error?: string }>;
      /** 执行菜单 Apply Plan */
      menuExecuteApplyPlan: (planJson: string) => Promise<{
        success: boolean;
        planId?: string;
        appliedSteps: number;
        totalSteps: number;
        rollbackPath?: string;
        error?: string;
      }>;
      /** 获取命令列表（给命令选择器用） */
      menuGetLinkedCommands: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
      /** 获取 Skill 信息 */
      menuGetLinkedSkills: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
      /** 检查菜单文件生效状态 */
      menuCheckStatus: () => Promise<{ success: boolean; data?: any; error?: string }>;
      /** 从 CommandIndex 生成推荐菜单 */
      menuRecommendFromCommands: (commandsJson: string, optionsJson: string) =>
        Promise<{ success: boolean; data?: any[]; error?: string }>;

      // ===== V5.5 Menu Profile CRUD =====
      menuProfileCreate: (name: string, description?: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      menuProfileCopy: (profileId: string, newName?: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      menuProfileRename: (profileId: string, newName: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      menuProfileDelete: (profileId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      menuProfileSetActive: (profileId: string) => Promise<{ success: boolean; data?: any; error?: string }>;

      // ===== V5.5 Skill Profile =====
      skillProfileLoadAll: () => Promise<{ success: boolean; data?: any; error?: string }>;
      skillProfileSaveDraft: (storeJson: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      skillProfileCreate: (name: string, description?: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      skillProfileCopy: (profileId: string, newName?: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      skillProfileRename: (profileId: string, newName: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      skillProfileDelete: (profileId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      skillProfileSetActive: (profileId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      skillProfileBuildSnapshot: (skillsJson: string, loadOrderJson: string, profileId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      skillProfileComputeDiff: (currentJson: string, targetJson: string, hotkeyRefsJson?: string, menuRefsJson?: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      skillProfileCreateApplyPlan: (profileJson: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      skillProfileExecuteApplyPlan: (planJson: string) => Promise<{ success: boolean; appliedSteps?: number; totalSteps?: number; error?: string }>;

      // ===== Symphony 协同模式适配 =====
      /** Symphony 兼容体检（U 类函数 / 未登记命令 / 菜单触发器） */
      symphonyCheck: () => Promise<{ success: boolean; data?: any; error?: string }>;
      /** ?? symphony_skill.txt ??????? Apply Plan? */
      symphonyGeneratePlan: (optionsJson: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      /** 执行 Symphony 登记计划 */
      symphonyApplyPlan: (planJson: string) => Promise<{ success: boolean; appliedSteps?: number; totalSteps?: number; error?: string }>;
      /** ?? AXL ??????? */
      symphonyTableInfo: () => Promise<{ success: boolean; data?: any; error?: string }>;

      // ===== V5.4 运行时版本自检 =====
      /** 获取运行时版本信息（三层一致性检测用） */
      getRuntimeInfo: () => Promise<{ success: boolean; data?: RuntimeInfo; error?: string }>;
      // ===== 閰嶈壊鏂规(配色方案) =====
      colorCheckBridge: () => Promise<{ success: boolean; data?: ColorBridgeStatus; error?: string }>;
      colorCheckBridgeSetup: () => Promise<{ success: boolean; data?: BridgeSetupStatus; error?: string }>;
      colorCreateBridgeEnablePlan: () => Promise<{ success: boolean; data?: ApplyPlan | null; info?: string; error?: string }>;
      colorExecuteBridgeEnablePlan: (planJson: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      colorCapture: () => Promise<{ success: boolean; data?: { snapshot: ColorSchemeSnapshot; bridgeStatus: ColorBridgeStatus }; error?: string }>;
      colorApply: (schemeId: string, applyVisibility?: boolean) => Promise<{ success: boolean; data?: { result: ColorApplyResult; schemeName: string; sourceAllegroVersion: string | null; targetAllegroVersion: string | null }; error?: string }>;
      colorLoadSchemes: () => Promise<{ success: boolean; data?: ColorSchemeStore; error?: string }>;
      colorCreateScheme: (snapshot: ColorSchemeSnapshot, name: string, description?: string) => Promise<{ success: boolean; data?: ColorScheme; error?: string }>;
      colorCopyScheme: (schemeId: string, newName?: string) => Promise<{ success: boolean; data?: ColorScheme; error?: string }>;
      colorRenameScheme: (schemeId: string, newName: string) => Promise<{ success: boolean; data?: ColorScheme; error?: string }>;
      colorDeleteScheme: (schemeId: string) => Promise<{ success: boolean; error?: string }>;
      colorSetActiveScheme: (schemeId: string) => Promise<{ success: boolean; data?: ColorScheme; error?: string }>;
      colorUpdateScheme: (schemeId: string, updates: { palette?: ColorSchemeSnapshot['palette']; layers?: ColorSchemeSnapshot['layers'] }) => Promise<{ success: boolean; data?: ColorScheme; error?: string }>;
      colorImportCol: () => Promise<{ success: boolean; data?: { palette: ColorSchemeSnapshot['palette']; background: ColorSchemeSnapshot['background']; fileName: string; filePath: string } | null; error?: string }>;
      colorExportCol: (schemeId: string) => Promise<{ success: boolean; data?: string | null; error?: string }>;
      getUpdateState: () => Promise<UpdateState>;
      getUpdateSettings: () => Promise<UpdateSettingsView>;
      saveUpdateSettings: (settings: UpdateSettings) => Promise<UpdateSettingsView>;
      checkForUpdates: () => Promise<UpdateState>;
      downloadUpdate: () => Promise<UpdateState>;
      installUpdate: () => Promise<void>;
      onUpdateState: (listener: (state: UpdateState) => void) => () => void;
    };
  }
}

export {};
