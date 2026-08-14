import { describe, expect, it } from 'vitest';
import {
  createEmptyStore,
  recordSessionCommand,
  toggleSessionFavorite,
} from '../core/session/sessionCommandStore';

describe('sessionCommandStore', () => {
  it('记录命令并按 code 去重置顶', () => {
    let store = createEmptyStore();
    store = recordSessionCommand(store, 'cmd-a', 'readonly', true);
    store = recordSessionCommand(store, 'cmd-b', 'readonly', true);
    store = recordSessionCommand(store, 'cmd-a', 'readonly', false);
    expect(store.items.map((i) => i.code)).toEqual(['cmd-a', 'cmd-b']);
    expect(store.items[0].success).toBe(false);
  });

  it('重新记录时保留收藏状态', () => {
    let store = createEmptyStore();
    store = recordSessionCommand(store, 'cmd-a', 'readonly', true);
    store = toggleSessionFavorite(store, 'cmd-a');
    expect(store.items[0].favorite).toBe(true);
    store = recordSessionCommand(store, 'cmd-a', 'write', true);
    expect(store.items[0].favorite).toBe(true);
    expect(store.items[0].risk).toBe('write');
  });

  it('收藏切换为纯函数且不改变其它条目', () => {
    let store = createEmptyStore();
    store = recordSessionCommand(store, 'a', 'readonly', true);
    store = recordSessionCommand(store, 'b', 'readonly', true);
    store = toggleSessionFavorite(store, 'b');
    expect(store.items.find((i) => i.code === 'b')?.favorite).toBe(true);
    expect(store.items.find((i) => i.code === 'a')?.favorite).toBe(false);
  });

  it('历史条数上限为 50', () => {
    let store = createEmptyStore();
    for (let i = 0; i < 60; i++) {
      store = recordSessionCommand(store, 'cmd-' + i, 'readonly', true);
    }
    expect(store.items.length).toBe(50);
    expect(store.items[0].code).toBe('cmd-59');
  });
});
