/**
 * ATM - Electron Preload 脚本
 * 通过 contextBridge 向渲染进程暴露安全的 IPC 接口
 *
 * 版本：V5.4 — 添加 getRuntimeInfo，支持三层版本自检
 * 如果修改此文件，必须重新构建：npm run build:electron
 * 然后重启 Electron 应用。
 */
import { contextBridge, ipcRenderer } from 'electron';

// ═══════════════════════════════════════════════════════════════
// Preload 构建时间戳 — 每次 build:electron 更新
// ═══════════════════════════════════════════════════════════════
const PRELOAD_BUILD_TIME: string = new Date().toISOString();
const PRELOAD_API_VERSION: string = '5.4.0';

console.log('[ATM Preload] Script executing');
console.log(`[ATM Preload] Build time: ${PRELOAD_BUILD_TIME}, API version: ${PRELOAD_API_VERSION}`);

try {
contextBridge.exposeInMainWorld('atm', {
  // ===== 环境检测 =====
  /** 定位 Allegro 配置环境 */
  locateEnvironment: (manualPcbenvPath?: string) =>
    ipcRenderer.invoke('env:locate', manualPcbenvPath),

  listAllegroEnvironments: (refresh = false, manualPcbenvPath?: string) =>
    ipcRenderer.invoke('env:list-workspaces', refresh, manualPcbenvPath),

  setActiveAllegroEnvironment: (environmentId: string) =>
    ipcRenderer.invoke('env:set-active-workspace', environmentId),

  launchAllegroEnvironment: (environmentId: string) =>
    ipcRenderer.invoke('env:launch-workspace', environmentId),

  /** 手动添加 Allegro 安装根目录（新电脑第一次使用时） */
  addAllegroInstallRoot: () => ipcRenderer.invoke('env:add-install-root'),

  /** 移除手动安装目录 */
  removeAllegroInstallRoot: (installRoot: string) =>
    ipcRenderer.invoke('env:remove-install-root', installRoot),

  listCompatibilityRecords: (filters?: any) =>
    ipcRenderer.invoke('env:list-compatibility-records', filters),

  saveCompatibilityRecord: (record: any) =>
    ipcRenderer.invoke('env:save-compatibility-record', record),

  verifyAllegroRuntime: (environmentId: string) =>
    ipcRenderer.invoke('env:verify-vibe-runtime', environmentId),

  /** 打开文件选择对话框选择 pcbenv */
  selectPcbenv: () => ipcRenderer.invoke('env:select-pcbenv'),

  /** 检测文件访问状态 */
  checkFileAccess: (filePath: string) =>
    ipcRenderer.invoke('env:check-file-access', filePath),

  /** 计算环境健康评分 */
  getHealthScore: () => ipcRenderer.invoke('env:health-score'),

  /** 获取 Windows 环境变量（供 UI 显示） */
  getEnvVars: (names: string[]) =>
    ipcRenderer.invoke('env:get-vars', names),

  // ===== 快捷键管理 =====
  /** 解析 env 文件 */
  parseEnvFile: (filePath: string) =>
    ipcRenderer.invoke('hotkey:parse-env', filePath),

  /** 检测快捷键冲突 */
  validateHotkeys: (filePath: string) =>
    ipcRenderer.invoke('hotkey:validate', filePath),

  /** 创建备份 */
  createBackup: (filePath: string) =>
    ipcRenderer.invoke('hotkey:create-backup', filePath),

  /** 生成 Apply Plan */
  createApplyPlan: (filePath: string, profileId?: string) =>
    ipcRenderer.invoke('hotkey:create-apply-plan', filePath, profileId),

  /** 执行 Apply Plan */
  applyPlan: (planJson: string) =>
    ipcRenderer.invoke('hotkey:apply-plan', planJson),

  // ===== Skill 管理 =====
  /** 扫描所有 Skill（三级分类） */
  scanSkills: () => ipcRenderer.invoke('skill:scan'),

  /** 解析单个 Skill 文件 */
  parseSkillFile: (filePath: string) =>
    ipcRenderer.invoke('skill:parse-file', filePath),

  /** 获取命令注册中心 */
  getCommandRegistry: () => ipcRenderer.invoke('skill:get-registry'),

  /** 切换 Skill 启用/禁用（返回 Apply Plan） */
  toggleSkill: (skillPath: string, enabled: boolean) =>
    ipcRenderer.invoke('skill:toggle', skillPath, enabled),

  /** 预览 Skill Loader 内容 */
  generateSkillLoader: () => ipcRenderer.invoke('skill:generate-loader'),

  /** 校验快捷键命令引用 */
  validateSkillRefs: (bindingsJson: string) =>
    ipcRenderer.invoke('skill:validate-refs', bindingsJson),

  /** 执行 Skill Apply Plan */
  applySkillChanges: (planJson: string) =>
    ipcRenderer.invoke('skill:apply-skill-changes', planJson),

  // ===== Profile 管理（V1.5） =====
  /** 获取所有快捷键方案 */
  listProfiles: () => ipcRenderer.invoke('profile:list'),

  /** 创建方案 */
  createProfile: (name: string, description?: string) =>
    ipcRenderer.invoke('profile:create', name, description),

  /** 复制方案 */
  copyProfile: (profileId: string, newName?: string) =>
    ipcRenderer.invoke('profile:copy', profileId, newName),

  /** 重命名方案 */
  renameProfile: (profileId: string, newName: string) =>
    ipcRenderer.invoke('profile:rename', profileId, newName),

  /** 删除方案 */
  deleteProfile: (profileId: string) =>
    ipcRenderer.invoke('profile:delete', profileId),

  /** 导出方案为 JSON */
  exportProfile: (profileId: string) =>
    ipcRenderer.invoke('profile:export', profileId),

  /** 从 JSON 导入方案 */
  importProfile: (jsonStr: string) =>
    ipcRenderer.invoke('profile:import', jsonStr),

  /** 比较两个方案差异 */
  diffProfiles: (sourceId: string, targetId: string) =>
    ipcRenderer.invoke('profile:diff', sourceId, targetId),

  /** 保存方案的快捷键绑定 */
  saveProfileBindings: (profileId: string, bindings: any[]) =>
    ipcRenderer.invoke('profile:save-bindings', profileId, bindings),

  /** 设置已应用的快捷键方案 */
  setAppliedHotkeyProfile: (profileId: string) =>
    ipcRenderer.invoke('profile:set-applied', profileId),

  /** 获取已应用的快捷键方案 ID */
  getAppliedHotkeyProfile: () =>
    ipcRenderer.invoke('profile:get-applied'),

  checkHotkeyProfileCompatibility: (profileId: string, targetEnvironmentId: string) =>
    ipcRenderer.invoke('profile:check-compatibility', profileId, targetEnvironmentId),

  migrateHotkeyProfile: (profileId: string, targetEnvironmentId: string) =>
    ipcRenderer.invoke('profile:migrate', profileId, targetEnvironmentId),

  // ===== 保留键（V1.6） =====
  /** 获取软件默认/系统保留快捷键 */
  getReservedBindings: () => ipcRenderer.invoke('hotkey:get-reserved'),

  // ===== 编辑校验（V1.5） =====
  /** 编辑快捷键时的实时检测 */
  validateHotkeyEdit: (editData: any) =>
    ipcRenderer.invoke('hotkey:validate-edit', editData),

  /** 生成编辑快捷键的 Apply Plan */
  generateEditPlan: (editRequest: any, currentBinding: any, filePath: string) =>
    ipcRenderer.invoke('hotkey:generate-edit-plan', editRequest, currentBinding, filePath),

  /** 生成添加快捷键的 Apply Plan */
  generateAddPlan: (key: string, command: string, type: string, filePath: string) =>
    ipcRenderer.invoke('hotkey:generate-add-plan', key, command, type, filePath),

  /** 执行编辑 Apply Plan */
  executeEditPlan: (planJson: string, filePath: string) =>
    ipcRenderer.invoke('hotkey:execute-edit-plan', planJson, filePath),

  /** 保存用户命令来源修正 */
  saveCommandOverride: (commandName: string, source: string, note?: string) =>
    ipcRenderer.invoke('command:save-override', commandName, source, note),

  // ===== 多 env 来源管理（V3.0） =====
  /** 扫描所有 env 来源 */
  scanAllEnvironments: (manualPcbenvPath?: string) =>
    ipcRenderer.invoke('env:scan-all', manualPcbenvPath),

  /** 加载设置 */
  loadSettings: (pcbenvPath?: string) =>
    ipcRenderer.invoke('env:load-settings', pcbenvPath),

  /** 保存设置 */
  saveSettings: (pcbenvPath: string, settings: any) =>
    ipcRenderer.invoke('env:save-settings', pcbenvPath, settings),

  /** 设置当前活动 env */
  setActiveEnv: (pcbenvPath: string, envPath: string) =>
    ipcRenderer.invoke('env:set-active-env', pcbenvPath, envPath),

  /** 添加参考 env（打开文件对话框） */
  addReferenceEnv: (pcbenvPath: string) =>
    ipcRenderer.invoke('env:add-reference-env', pcbenvPath),

  /** 移除参考 env */
  removeReferenceEnv: (pcbenvPath: string, refPath: string) =>
    ipcRenderer.invoke('env:remove-reference-env', pcbenvPath, refPath),

  /** 打开 env 来源所在文件夹 */
  openEnvSourceFolder: (sourcePath: string) =>
    ipcRenderer.invoke('env:open-source-folder', sourcePath),

  // ===== 变更历史（V4.0） =====
  /** 加载变更历史 */
  loadChangeHistory: (pcbenvPath: string) =>
    ipcRenderer.invoke('history:load', pcbenvPath),

  /** 获取上次变更 */
  getLastChange: (pcbenvPath: string) =>
    ipcRenderer.invoke('history:get-last', pcbenvPath),

  /** 撤销上次变更 */
  undoLastChange: (pcbenvPath: string) =>
    ipcRenderer.invoke('history:undo', pcbenvPath),

  /** 添加变更记录 */
  addChangeRecord: (pcbenvPath: string, record: any) =>
    ipcRenderer.invoke('history:add', pcbenvPath, record),

  /** 清空变更历史 */
  clearChangeHistory: (pcbenvPath: string) =>
    ipcRenderer.invoke('history:clear', pcbenvPath),

  // ===== 原始行查看（V4.0） =====
  /** 读取 env 原始行（带上下文） */
  readRawLine: (filePath: string, lineNumber: number, isReference?: boolean) =>
    ipcRenderer.invoke('env:read-raw-line', filePath, lineNumber, isReference),

  /** 复制原始行内容 */
  copyRawLine: (filePath: string, lineNumber: number) =>
    ipcRenderer.invoke('env:copy-raw-line', filePath, lineNumber),

  /** 获取 env 文件预览 */
  getEnvFilePreview: (filePath: string, maxLines?: number) =>
    ipcRenderer.invoke('env:file-preview', filePath, maxLines),

  // ===== Skill 加载检查（V4.0） =====
  /** 检查 Skill 加载状态 */
  checkSkillLoad: (skillName: string, envInfo: any) =>
    ipcRenderer.invoke('skill:check-load', skillName, envInfo),

  /** 检查所有 Skill 加载状态 */
  checkAllSkillLoadStatuses: (skillNames: string[], envInfo: any) =>
    ipcRenderer.invoke('skill:check-all-load', skillNames, envInfo),

  /** 扫描加载源 */
  scanLoadSources: (envInfo: any) =>
    ipcRenderer.invoke('skill:scan-load-sources', envInfo),

  // ===== Skill 增强管理（V4.5） =====
  /** 增强扫描 - 返回含入口/内部函数区分、加载状态等详细信息的 Skill 列表 */
  enhancedScanSkills: () => ipcRenderer.invoke('skill:enhanced-scan'),

  /** 获取增强命令列表（含快捷键引用等） */
  getEnhancedCommandList: () => ipcRenderer.invoke('skill:enhanced-commands'),

  /** 获取单个 Skill 详情 */
  getSkillDetail: (skillPath: string) =>
    ipcRenderer.invoke('skill:file-detail', skillPath),

  /** 增强引用检查 */
  enhancedValidateRefs: (bindingsJson: string) =>
    ipcRenderer.invoke('skill:enhanced-refs', bindingsJson),

  /** 添加只读 Skill 目录 */
  addReadonlySkillDir: (dirPath: string) =>
    ipcRenderer.invoke('skill:add-readonly-dir', dirPath),

  /** 打开选择器选择只读 Skill 目录 */
  selectReadonlySkillDir: () =>
    ipcRenderer.invoke('skill:select-readonly-dir'),

  /** 导入 Skill 预览 */
  importSkillPreview: (filePathOrDir: string) =>
    ipcRenderer.invoke('skill:import-preview', filePathOrDir),

  // ===== 增强冲突检测（V4.0） =====
  /** 检测增强冲突 */
  detectEnhancedConflicts: (params: any) =>
    ipcRenderer.invoke('hotkey:enhanced-conflicts', params),

  // ===== 推荐可用键位（V4.0） =====
  /** 获取推荐可用键位 */
  getRecommendedKeys: (options: any) =>
    ipcRenderer.invoke('hotkey:recommended-keys', options),

  // ===== 收藏管理（V4.0） =====
  /** 切换收藏状态 */
  toggleFavorite: (pcbenvPath: string, bindingId: string) =>
    ipcRenderer.invoke('favorite:toggle', pcbenvPath, bindingId),

  /** 加载收藏列表 */
  loadFavorites: (pcbenvPath: string) =>
    ipcRenderer.invoke('favorite:load', pcbenvPath),

  /** 获取收藏快捷键列表 */
  getFavoriteBindings: (pcbenvPath: string, bindingsJson: string) =>
    ipcRenderer.invoke('favorite:get-bindings', pcbenvPath, bindingsJson),

  // ===== 导出速查表（V4.0） =====
  /** 导出快捷键速查表 */
  exportCheatsheet: (bindingsJson: string, options: any) =>
    ipcRenderer.invoke('hotkey:export', bindingsJson, options),

  /** 保存导出文件到磁盘 */
  saveExportedFile: (content: string, defaultName: string, filter: any) =>
    ipcRenderer.invoke('hotkey:save-export', content, defaultName, filter),

  // ===== env 文件导入（V4.0） =====
  /** 打开文件选择对话框选择 env 文件 */
  openEnvFileDialog: () =>
    ipcRenderer.invoke('import:open-dialog'),

  /** 解析外部 env 文件生成导入预览 */
  parseImportEnvFile: (filePath: string) =>
    ipcRenderer.invoke('import:parse-file', filePath),

  /** 计算导入快捷键与当前环境的冲突 */
  computeImportConflicts: (params: any) =>
    ipcRenderer.invoke('import:compute-conflicts', params),

  /** 执行 env 导入 */
  executeEnvImport: (params: any) =>
    ipcRenderer.invoke('import:execute', params),

  // ===== Skill 元数据管理（V5.0） =====
  /** 获取所有 Skill 元数据 */
  skillMetaGetAll: () => ipcRenderer.invoke('skillMeta:getAll'),

  /** 获取单个 Skill 元数据 */
  skillMetaGet: (skillId: string) =>
    ipcRenderer.invoke('skillMeta:get', skillId),

  /** 保存 Skill 元数据 */
  skillMetaSave: (skillId: string, meta: any) =>
    ipcRenderer.invoke('skillMeta:save', skillId, meta),

  /** 自动分析单个 Skill */
  skillMetaAnalyze: (skillJson: string) =>
    ipcRenderer.invoke('skillMeta:analyze', skillJson),

  /** 批量分析所有 Skill */
  skillMetaAnalyzeAll: (skillsJson: string) =>
    ipcRenderer.invoke('skillMeta:analyzeAll', skillsJson),

  /** 清除自动分析结果 */
  skillMetaClearAuto: (skillId: string) =>
    ipcRenderer.invoke('skillMeta:clearAuto', skillId),

  // ===== Skill 命令引用与影响分析（V5.1） =====
  /** 分析 Skill 删除/禁用影响 */
  analyzeSkillImpact: (skillPath: string, bindingsJson: string) =>
    ipcRenderer.invoke('skill:impact-analysis', skillPath, bindingsJson),

  /** 创建 Skill 删除计划 */
  createDeletePlan: (skillPath: string, option: string) =>
    ipcRenderer.invoke('skill:create-delete-plan', skillPath, option),

  /** 检查失效引用（Skill 文件被外部删除后 env 中的残留引用） */
  checkStaleRefs: (bindingsJson: string) =>
    ipcRenderer.invoke('skill:check-stale-refs', bindingsJson),

  // ===== V5.2 Skill 使用状态/健康度/使用关系树/配置/说明 =====
  /** 批量计算所有 Skill 的使用状态 */
  computeSkillUsageStatuses: () =>
    ipcRenderer.invoke('skill:usage-statuses'),

  /** 批量计算所有 Skill 的健康度评分 */
  computeSkillHealthScores: () =>
    ipcRenderer.invoke('skill:health-scores'),

  /** 构建单个 Skill 的使用关系树 */
  buildSkillUsageTree: (skillPath: string, bindingsJson: string) =>
    ipcRenderer.invoke('skill:usage-tree', skillPath, bindingsJson),

  /** 扫描 Skill 配置文件 */
  scanSkillConfigFiles: (skillDir: string, skillName: string) =>
    ipcRenderer.invoke('skill:config-files', skillDir, skillName),

  /** 生成 Skill README 使用说明 */
  generateSkillReadme: (skillPath: string, metaJson: string) =>
    ipcRenderer.invoke('skill:generate-readme', skillPath, metaJson),

  /** 安全禁用 — 禁用前先做影响分析 */
  toggleSkillSafe: (skillPath: string, enabled: boolean) =>
    ipcRenderer.invoke('skill:toggle-safe', skillPath, enabled),

  /** 获取 Loader 加载顺序分析 */
  getSkillLoaderOrder: () =>
    ipcRenderer.invoke('skill:loader-order'),

  /** 导出 Skill 包预览 */
  exportSkillPackage: (skillPath: string, optionsJson: string) =>
    ipcRenderer.invoke('skill:export-package', skillPath, optionsJson),

  /** 检测未使用 Skill */
  findUnusedSkills: (bindingsJson: string) =>
    ipcRenderer.invoke('skill:find-unused', bindingsJson),

  // ===== V5.5 菜单管理（可视化菜单编辑） =====
  /** 加载所有菜单方案 */
  menuLoadProfiles: () => ipcRenderer.invoke('menu:load-profiles'),

  /** 保存菜单草稿 */
  menuSaveDraft: (storeJson: string) =>
    ipcRenderer.invoke('menu:save-draft', storeJson),

  /** 验证菜单引用 */
  menuValidate: (itemsJson: string, commandsJson: string, skillsJson: string) =>
    ipcRenderer.invoke('menu:validate', itemsJson, commandsJson, skillsJson),

  /** 预览 generated_menu.il */
  menuGeneratePreview: (profileJson: string) =>
    ipcRenderer.invoke('menu:generate-preview', profileJson),

  /** 生成菜单 Apply Plan */
  menuCreateApplyPlan: (profileJson: string, storeJson?: string) =>
    ipcRenderer.invoke('menu:create-apply-plan', profileJson, storeJson),

  /** 从 ATM 备份生成菜单方案恢复计划 */
  menuCreateRecoveryPlan: () => ipcRenderer.invoke('menu:create-recovery-plan'),

  /** 从其他 Allegro 环境复制菜单方案到当前环境 */
  menuCreateEnvironmentCopyPlan: (sourceEnvironmentId: string) =>
    ipcRenderer.invoke('menu:create-environment-copy-plan', sourceEnvironmentId),

  /** 导出单个菜单方案为便携包 */
  menuExportProfile: (profileId: string) =>
    ipcRenderer.invoke('menu:export-profile', profileId),

  /** 选择并预览菜单方案包 */
  menuOpenImportProfile: () =>
    ipcRenderer.invoke('menu:open-import-profile'),

  /** 生成菜单方案导入 Apply Plan */
  menuCreateImportPlan: (filePath: string) =>
    ipcRenderer.invoke('menu:create-import-plan', filePath),

  /** 执行菜单 Apply Plan */
  menuExecuteApplyPlan: (planJson: string) =>
    ipcRenderer.invoke('menu:execute-apply-plan', planJson),

  /** 获取命令列表 */
  menuGetLinkedCommands: () =>
    ipcRenderer.invoke('menu:get-linked-commands'),

  /** 获取 Skill 信息 */
  menuGetLinkedSkills: () =>
    ipcRenderer.invoke('menu:get-linked-skills'),

  /** 检查菜单文件生效状态 */
  menuCheckStatus: () =>
    ipcRenderer.invoke('menu:check-status'),

  /** 从 CommandIndex 生成推荐菜单 */
  menuRecommendFromCommands: (commandsJson: string, optionsJson: string) =>
    ipcRenderer.invoke('menu:recommend-from-commands', commandsJson, optionsJson),

  // ===== V5.5 Menu Profile CRUD =====
  /** 新建菜单方案 */
  menuProfileCreate: (name: string, description?: string) =>
    ipcRenderer.invoke('menu:profile-create', name, description),
  /** 复制菜单方案 */
  menuProfileCopy: (profileId: string, newName?: string) =>
    ipcRenderer.invoke('menu:profile-copy', profileId, newName),
  /** 重命名菜单方案 */
  menuProfileRename: (profileId: string, newName: string) =>
    ipcRenderer.invoke('menu:profile-rename', profileId, newName),
  /** 删除菜单方案 */
  menuProfileDelete: (profileId: string) =>
    ipcRenderer.invoke('menu:profile-delete', profileId),
  /** 切换活动菜单方案 */
  menuProfileSetActive: (profileId: string) =>
    ipcRenderer.invoke('menu:profile-set-active', profileId),

  // ===== V5.5 Skill Profile =====
  /** 加载所有 Skill 方案 */
  skillProfileLoadAll: () => ipcRenderer.invoke('skill-profile:load-all'),
  /** 保存 Skill 方案草稿 */
  skillProfileSaveDraft: (storeJson: string) =>
    ipcRenderer.invoke('skill-profile:save-draft', storeJson),
  /** 新建 Skill 方案 */
  skillProfileCreate: (name: string, description?: string) =>
    ipcRenderer.invoke('skill-profile:create', name, description),
  /** 复制 Skill 方案 */
  skillProfileCopy: (profileId: string, newName?: string) =>
    ipcRenderer.invoke('skill-profile:copy', profileId, newName),
  /** 重命名 Skill 方案 */
  skillProfileRename: (profileId: string, newName: string) =>
    ipcRenderer.invoke('skill-profile:rename', profileId, newName),
  /** 删除 Skill 方案 */
  skillProfileDelete: (profileId: string) =>
    ipcRenderer.invoke('skill-profile:delete', profileId),
  /** 切换活动 Skill 方案 */
  skillProfileSetActive: (profileId: string) =>
    ipcRenderer.invoke('skill-profile:set-active', profileId),
  /** 构建 Skill 快照 */
  skillProfileBuildSnapshot: (skillsJson: string, loadOrderJson: string, profileId: string) =>
    ipcRenderer.invoke('skill-profile:build-snapshot', skillsJson, loadOrderJson, profileId),
  /** 计算 Skill 方案差异 */
  skillProfileComputeDiff: (currentJson: string, targetJson: string, hotkeyRefsJson?: string, menuRefsJson?: string) =>
    ipcRenderer.invoke('skill-profile:compute-diff', currentJson, targetJson, hotkeyRefsJson, menuRefsJson),
  /** 生成 Skill 方案 Apply Plan */
  skillProfileCreateApplyPlan: (profileJson: string) =>
    ipcRenderer.invoke('skill-profile:create-apply-plan', profileJson),
  /** 执行 Skill 方案 Apply Plan */
  skillProfileExecuteApplyPlan: (planJson: string) =>
    ipcRenderer.invoke('skill-profile:execute-apply-plan', planJson),

  // ===== Symphony 协同模式适配 =====
  /** Symphony 兼容体检（U 类函数 / 未登记命令 / 菜单触发器） */
  symphonyCheck: () => ipcRenderer.invoke('skill:symphony-check'),
  /** 基于 symphony_skill.txt 生成登记方案的 Apply Plan */
  symphonyGeneratePlan: (optionsJson: string) =>
    ipcRenderer.invoke('skill:symphony-generate', optionsJson),
  /** 执行 Symphony 登记计划 */
  symphonyApplyPlan: (planJson: string) =>
    ipcRenderer.invoke('skill:symphony-apply', planJson),
  /** 查询 AXL 命令登记表信息 */
  symphonyTableInfo: () => ipcRenderer.invoke('skill:symphony-table-info'),

  // ===== V5.4 运行时版本自检 =====
  /** 获取运行时版本信息（三层一致性检测用） */
  getRuntimeInfo: () => ipcRenderer.invoke('app:getRuntimeInfo'),
  // ===== 备份与恢复（V5.7） =====
  /** 创建 ATM 设置备份（.atmbak），uiPrefsJson 为渲染进程收集的界面偏好 */
  createSettingsBackup: (uiPrefsJson?: string, appVersion?: string) =>
    ipcRenderer.invoke('backup:create', uiPrefsJson, appVersion),

  /** 选择 ATM 备份文件 */
  openSettingsBackup: () => ipcRenderer.invoke('backup:open'),

  /** 解析备份文件并返回摘要 */
  inspectSettingsBackup: (filePath: string) =>
    ipcRenderer.invoke('backup:inspect', filePath),

  /** 恢复备份到当前激活 pcbenv */
  restoreSettingsBackup: (filePath: string, optionsJson?: string) =>
    ipcRenderer.invoke('backup:restore', filePath, optionsJson),

  // ===== 应用内更新 =====
  // ===== 配色方案 =====
  /** 检查 Vibe Bridge 可用性 */
  colorCheckBridge: () => ipcRenderer.invoke('color:check-bridge'),

  /** 检查桥接安装状态（自动加载是否已配置） */
  colorCheckBridgeSetup: () => ipcRenderer.invoke('color:bridge-setup-status'),

  /** 生成启用桥接自动加载的 Apply Plan */
  colorCreateBridgeEnablePlan: () => ipcRenderer.invoke('color:bridge-enable-plan'),

  /** 执行启用桥接自动加载的 Apply Plan */
  colorExecuteBridgeEnablePlan: (planJson: string) =>
    ipcRenderer.invoke('color:bridge-execute-plan', planJson),

  /** 从当前打开的 Allegro 板子捕获配色 */
  colorCapture: () => ipcRenderer.invoke('color:capture'),

  /** 将配色方案应用到当前板子（需 UI 确认） */
  colorApply: (schemeId: string, applyVisibility?: boolean) =>
    ipcRenderer.invoke('color:apply', schemeId, applyVisibility),

  /** 生成配色应用预览（目标板叠层 + 最终颜色映射） */
  colorApplyPreview: (schemeId: string, applyVisibility?: boolean) =>
    ipcRenderer.invoke('color:apply-preview', schemeId, applyVisibility),

  /** 撤销本次配色（恢复应用前保存的快照） */
  colorUndoApply: (undoSnapshotId: string) =>
    ipcRenderer.invoke('color:undo-apply', undoSnapshotId),

  /** 加载全部配色方案 */
  colorLoadSchemes: () => ipcRenderer.invoke('color:schemes'),

  /** 保存捕获快照为方案 */
  colorCreateScheme: (snapshot: any, name: string, description?: string) =>
    ipcRenderer.invoke('color:scheme-create', snapshot, name, description),

  /** 复制方案 */
  colorCopyScheme: (schemeId: string, newName?: string) =>
    ipcRenderer.invoke('color:scheme-copy', schemeId, newName),

  /** 重命名方案 */
  colorRenameScheme: (schemeId: string, newName: string) =>
    ipcRenderer.invoke('color:scheme-rename', schemeId, newName),

  /** 删除方案 */
  colorDeleteScheme: (schemeId: string) =>
    ipcRenderer.invoke('color:scheme-delete', schemeId),

  /** 设置活跃方案 */
  colorSetActiveScheme: (schemeId: string) =>
    ipcRenderer.invoke('color:scheme-set-active', schemeId),

  /** 更新方案（编辑调色板/图层颜色） */
  colorUpdateScheme: (schemeId: string, updates: any) =>
    ipcRenderer.invoke('color:scheme-update', schemeId, updates),

  /** 导入 .col 文件 */
  colorImportCol: () => ipcRenderer.invoke('color:import-col'),

  /** 导出 .col 文件 */
  colorExportCol: (schemeId: string) =>
    ipcRenderer.invoke('color:export-col', schemeId),
  // ===== 统一工作区方案（V6.2） =====
  /** 加载全部工作区 */
  workspaceLoadAll: () => ipcRenderer.invoke('workspace:load-all'),
  /** 创建工作区 */
  workspaceCreate: (name: string, options?: any) =>
    ipcRenderer.invoke('workspace:create', name, options),
  /** 复制工作区 */
  workspaceCopy: (workspaceId: string, newName?: string) =>
    ipcRenderer.invoke('workspace:copy', workspaceId, newName),
  /** 加载工作区绑定候选项 */
  workspaceBindingOptions: (environmentId?: string) =>
    ipcRenderer.invoke('workspace:binding-options', environmentId),
  /** 更新工作区环境与子方案绑定 */
  workspaceUpdate: (workspaceId: string, bindings: any) =>
    ipcRenderer.invoke('workspace:update', workspaceId, bindings),
  /** 重命名工作区 */
  workspaceRename: (workspaceId: string, newName: string) =>
    ipcRenderer.invoke('workspace:rename', workspaceId, newName),
  /** 删除工作区 */
  workspaceDelete: (workspaceId: string) =>
    ipcRenderer.invoke('workspace:delete', workspaceId),
  /** 设置激活工作区 */
  workspaceSetActive: (workspaceId: string) =>
    ipcRenderer.invoke('workspace:set-active', workspaceId),
  /** 生成工作区统一预览 */
  workspacePreview: (workspaceId: string) =>
    ipcRenderer.invoke('workspace:preview', workspaceId),
  /** 生成工作区应用计划（环境锁 + 执行序列） */
  workspaceApplyPlan: (workspaceId: string, options?: { applyVisibility?: boolean }) =>
    ipcRenderer.invoke('workspace:apply-plan', workspaceId, options),
  getUpdateState: () => ipcRenderer.invoke('app:update-state'),
  getUpdateSettings: () => ipcRenderer.invoke('app:update-settings'),
  saveUpdateSettings: (settings: { feedUrl: string; connectionMode: 'system' | 'direct' }) =>
    ipcRenderer.invoke('app:update-settings-save', settings),
  checkForUpdates: () => ipcRenderer.invoke('app:update-check'),
  downloadUpdate: () => ipcRenderer.invoke('app:update-download'),
  installUpdate: () => ipcRenderer.invoke('app:update-install'),
  onUpdateState: (listener: (state: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: unknown) => listener(state);
    ipcRenderer.on('app:update-state-changed', handler);
    return () => ipcRenderer.removeListener('app:update-state-changed', handler);
  },
});

console.log('[ATM Preload] window.atm injected successfully');
} catch (err) {
  console.error('[ATM Preload] Failed to inject atm API:', err);
}
