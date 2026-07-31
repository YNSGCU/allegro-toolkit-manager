import { APP_NAV_ITEMS, PRIMARY_WORKSPACES } from './appShell';

export type PageSurfaceKey =
  | 'hotkeys'
  | 'skills'
  | 'menu'
  | 'overview'
  | 'environment';

export interface SurfaceAction {
  id: string;
  label: string;
  meta: string;
}

export interface PageSurface {
  key: PageSurfaceKey;
  title: string;
  subtitle: string;
  prompt: string;
  actions: SurfaceAction[];
}

const PAGE_SURFACE_ENTRIES: [PageSurfaceKey, PageSurface][] = [
  [
    'hotkeys',
    {
      key: 'hotkeys',
      title: '快捷键工作台',
      subtitle: '用统一的白色极简入口管理方案、冲突和键位编辑。',
      prompt: '从当前快捷键方案继续，检查冲突、整理映射，或进入具体工作区继续处理。',
      actions: [
        { id: 'editor', label: '编辑键位', meta: '进入主编辑工作区' },
        { id: 'conflicts', label: '处理冲突', meta: '集中处理覆盖与冲突' },
        { id: 'import-export', label: '导入导出', meta: '管理 env、方案与速查表' },
      ],
    },
  ],
  [
    'skills',
    {
      key: 'skills',
      title: 'Skill 编排台',
      subtitle: '聚焦能力加载、引用检查和命令注册，保持结构清晰。',
      prompt: '先确认当前 Skill 方案状态，再继续扫描、校验引用或调整启停。',
      actions: [
        { id: 'scan', label: '扫描 Skill', meta: '同步本地能力' },
        { id: 'refs', label: '检查引用', meta: '定位失效关联' },
        { id: 'registry', label: '命令视图', meta: '查看注册结果' },
      ],
    },
  ],
  [
    'menu',
    {
      key: 'menu',
      title: '菜单工作台',
      subtitle: '把菜单树、命令关联和预览生成收拢到一个稳定入口。',
      prompt: '继续编辑当前菜单草稿，或直接进入预览与 Apply Plan 检查。',
      actions: [
        { id: 'tree', label: '菜单树', meta: '主编辑入口' },
        { id: 'commands', label: '命令关联', meta: '检查挂载情况' },
        { id: 'preview', label: '预览输出', meta: '生成前确认' },
      ],
    },
  ],
  [
    'overview',
    {
      key: 'overview',
      title: '概览',
      subtitle: '快速确认当前工作区健康度，并进入核心工作台。',
      prompt: '先看整体状态，再决定进入快捷键、Skill 或菜单页面继续操作。',
      actions: [
        { id: 'health', label: '环境健康', meta: '全局状态' },
        { id: 'hotkeys', label: '进入快捷键', meta: '默认入口' },
        { id: 'skills', label: '进入 Skill', meta: '能力管理' },
      ],
    },
  ],
  [
    'environment',
    {
      key: 'environment',
      title: '环境检测',
      subtitle: '聚焦路径、权限与配置来源，为后续应用动作兜底。',
      prompt: '定位 pcbenv、env 文件和 allegro.ilinit，确认当前运行环境完整。',
      actions: [
        { id: 'pcbenv', label: '定位 pcbenv', meta: '手动选择路径' },
        { id: 'scan', label: '重新扫描', meta: '刷新检测结果' },
        { id: 'vars', label: '环境变量', meta: '查看基础信息' },
      ],
    },
  ],
];

export const PAGE_SURFACES: Record<PageSurfaceKey, PageSurface> = Object.fromEntries(
  PAGE_SURFACE_ENTRIES,
) as Record<PageSurfaceKey, PageSurface>;

export function getPageSurface(key: PageSurfaceKey): PageSurface {
  return PAGE_SURFACES[key];
}

export function getOrderedPageSurfaces(): PageSurface[] {
  return APP_NAV_ITEMS.map((item) => getPageSurface(item.key));
}

export function getPrimaryWorkspaceSurfaces(): PageSurface[] {
  return PRIMARY_WORKSPACES.map((item) => getPageSurface(item.key));
}
