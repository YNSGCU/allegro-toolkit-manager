export type AppNavGroup = 'primary' | 'utility';

export interface AppNavItem {
  key: 'hotkeys' | 'skills' | 'menu' | 'colors' | 'drc' | 'session' | 'schematic' | 'overview' | 'backup' | 'env-editor' | 'workspace' | 'diagnostic';
  label: string;
  path: string;
  group: AppNavGroup;
  shortLabel: string;
  summary: string;
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    key: 'workspace',
    label: '工作区',
    path: '/workspace',
    group: 'primary',
    shortLabel: 'WS',
    summary: '绑定环境与快捷键 / Skill / 菜单 / 配色方案，统一应用',
  },
  {
    key: 'hotkeys',
    label: '快捷键',
    path: '/hotkeys',
    group: 'primary',
    shortLabel: 'HK',
    summary: '管理高频键位、冲突与应用方案',
  },
  {
    key: 'skills',
    label: 'Skill',
    path: '/skills',
    group: 'primary',
    shortLabel: 'SK',
    summary: '编排能力、引用与加载状态',
  },
  {
    key: 'menu',
    label: '菜单',
    path: '/menu',
    group: 'primary',
    shortLabel: 'MN',
    summary: '编辑菜单树并生成覆盖层',
  },
  {
    key: 'colors',
    label: '配色',
    path: '/colors',
    group: 'primary',
    shortLabel: 'CL',
    summary: '复制板子配色方案并可视化，跨板子应用',
  },
  {
    key: 'drc',
    label: 'DRC 看板',
    path: '/drc',
    group: 'primary',
    shortLabel: 'DRC',
    summary: '导入或抓取 DRC 报告，按层 / 网络 / 规则分组统计并跟踪解决状态',
  },
  {
    key: 'session',
    label: '会话控制台',
    path: '/session',
    group: 'primary',
    shortLabel: 'SES',
    summary: '查看当前 Allegro 会话并执行 SKILL 命令',
  },
  {
    key: 'diagnostic',
    label: '设计体检',
    path: '/diagnostic',
    group: 'primary',
    shortLabel: 'DIAG',
    summary: '对当前板子运行只读检查，查看叠层 / 网络 / 器件 / DRC 概况',
  },
  {
    key: 'schematic',
    label: '电源树',
    path: '/schematic',
    group: 'primary',
    shortLabel: 'PW',
    summary: '导入 OrCAD / PDF 原理图，自动生成电源树与硬件框图',
  },
  {
    key: 'backup',
    label: '备份与恢复',
    path: '/backup',
    group: 'utility',
    shortLabel: 'BK',
    summary: '备份软件设置并在新电脑 / 新板子复用',
  },
  {
    key: 'env-editor',
    label: 'Env 编辑器',
    path: '/env-editor',
    group: 'utility',
    shortLabel: 'ENV',
    summary: '可视化编辑当前环境的 env 文件',
  },
  {
    key: 'overview',
    label: '系统状态',
    path: '/overview',
    group: 'utility',
    shortLabel: 'OV',
    summary: '查看整体健康度、环境与入口状态',
  },
];

export const PRIMARY_WORKSPACES = APP_NAV_ITEMS.filter(
  (item) => item.group === 'primary',
);

export function getDefaultWorkspaceRoute(): string {
  return '/hotkeys';
}
