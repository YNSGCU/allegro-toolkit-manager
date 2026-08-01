export const HOTKEY_WORKSPACE_SECTIONS = [
  {
    key: 'keys',
    label: '键位',
    path: '/hotkeys/keys',
    summary: '查看键盘占用并从物理键进入编辑',
  },
  {
    key: 'list',
    label: '列表',
    path: '/hotkeys/list',
    summary: '搜索、筛选并集中管理全部快捷键',
  },
  {
    key: 'conflicts',
    label: '冲突',
    path: '/hotkeys/conflicts',
    summary: '集中处理冲突与覆盖风险',
  },
] as const;

export type HotkeyWorkspaceSectionKey =
  (typeof HOTKEY_WORKSPACE_SECTIONS)[number]['key'];
