import { describe, expect, it } from 'vitest';
import { reorderMenuItem } from '../src/utils/menuTreeOrder';
import type { MenuItemConfig } from '../src/types/menu';

const item = (id: string, parentId?: string): MenuItemConfig => ({
  id, type: 'command', label: id, command: id, parentId, order: 0, enabled: true, visible: true,
});

describe('菜单树拖动排序', () => {
  it('将同级菜单项移动到目标项之前并重排 order', () => {
    const result = reorderMenuItem([item('a'), item('b'), item('c')], 'c', 'a');
    expect(result.map((entry) => entry.id)).toEqual(['c', 'a', 'b']);
    expect(result.map((entry) => entry.order)).toEqual([0, 1, 2]);
  });

  it('向下拖动相邻项时真正调换两者位置', () => {
    const result = reorderMenuItem([item('a'), item('b'), item('c')], 'a', 'b');
    expect(result.map((entry) => entry.id)).toEqual(['b', 'a', 'c']);
    expect(result.map((entry) => entry.order)).toEqual([0, 1, 2]);
  });

  it('只在同级内排序，不改变父子层级', () => {
    const result = reorderMenuItem([item('root'), { ...item('menu'), type: 'menu', children: [item('child-a', 'menu'), item('child-b', 'menu')] }], 'child-b', 'root');
    expect(result[0].id).toBe('root');
    expect(result[1].children?.map((entry) => entry.id)).toEqual(['child-a', 'child-b']);
  });
});
