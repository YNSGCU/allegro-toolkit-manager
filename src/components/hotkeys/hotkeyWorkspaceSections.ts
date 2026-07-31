export const HOTKEY_WORKSPACE_SECTIONS = [
  {
    key: 'overview',
    label: '总览',
    path: '/hotkeys/overview',
    summary: '查看当前方案与键盘占用',
  },
  {
    key: 'editor',
    label: '编辑',
    path: '/hotkeys/editor',
    summary: '查找、修改、新增和删除快捷键',
  },
  {
    key: 'conflicts',
    label: '冲突',
    path: '/hotkeys/conflicts',
    summary: '集中处理冲突与覆盖风险',
  },
  {
    key: 'import-export',
    label: '导入导出',
    path: '/hotkeys/import-export',
    summary: '导入 env、方案与导出速查表',
  },
] as const;

export type HotkeyWorkspaceSectionKey =
  (typeof HOTKEY_WORKSPACE_SECTIONS)[number]['key'];
