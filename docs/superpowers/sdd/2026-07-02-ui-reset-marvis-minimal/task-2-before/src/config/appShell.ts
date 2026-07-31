export type AppNavGroup = 'primary' | 'utility';

export interface AppNavItem {
  key: 'hotkeys' | 'skills' | 'menu' | 'overview' | 'environment';
  label: string;
  path: string;
  group: AppNavGroup;
  shortLabel: string;
  summary: string;
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    key: 'hotkeys',
    label: '快捷键',
    path: '/hotkeys',
    group: 'primary',
    shortLabel: 'HK',
    summary: '管理高频键位与冲突',
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
    summary: '编辑菜单树与生成覆盖层',
  },
  {
    key: 'overview',
    label: '概览',
    path: '/overview',
    group: 'utility',
    shortLabel: 'OV',
    summary: '查看整体健康与入口状态',
  },
  {
    key: 'environment',
    label: '环境',
    path: '/environment',
    group: 'utility',
    shortLabel: 'EV',
    summary: '检查路径、权限与配置来源',
  },
];

export const PRIMARY_WORKSPACES = APP_NAV_ITEMS.filter(
  (item) => item.group === 'primary',
);

export function getDefaultWorkspaceRoute(): string {
  return '/hotkeys';
}
