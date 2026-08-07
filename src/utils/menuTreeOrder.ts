import type { MenuItemConfig } from '../types/menu';

function findParentId(items: MenuItemConfig[], itemId: string, parentId?: string): string | null | undefined {
  for (const item of items) {
    if (item.id === itemId) return parentId ?? null;
    if (item.children?.length) {
      const result = findParentId(item.children, itemId, item.id);
      if (result !== undefined) return result;
    }
  }
  return undefined;
}

function normalizeList(list: MenuItemConfig[]): MenuItemConfig[] {
  return list.map((item, index) => ({
    ...item,
    order: index,
    children: item.children ? normalizeList(item.children) : undefined,
    updatedAt: new Date().toISOString(),
  }));
}

/** 将菜单项拖到目标项之前；只允许同级排序，避免误改变菜单层级。 */
export function reorderMenuItem(items: MenuItemConfig[], draggedId: string, targetId: string): MenuItemConfig[] {
  if (!draggedId || !targetId || draggedId === targetId) return items;
  const draggedParentId = findParentId(items, draggedId);
  const targetParentId = findParentId(items, targetId);
  if (draggedParentId === undefined || targetParentId === undefined || draggedParentId !== targetParentId) return items;

  const reorderInList = (list: MenuItemConfig[]): { changed: boolean; list: MenuItemConfig[] } => {
    const draggedIndex = list.findIndex((item) => item.id === draggedId);
    const targetIndex = list.findIndex((item) => item.id === targetId);
    if (draggedIndex >= 0 && targetIndex >= 0) {
      const next = [...list];
      const [dragged] = next.splice(draggedIndex, 1);
      next.splice(Math.max(0, next.findIndex((item) => item.id === targetId)), 0, dragged);
      return { changed: true, list: normalizeList(next) };
    }
    for (let index = 0; index < list.length; index += 1) {
      const item = list[index];
      if (!item.children?.length) continue;
      const result = reorderInList(item.children);
      if (result.changed) {
        const next = [...list];
        next[index] = { ...item, children: result.list };
        return { changed: true, list: next };
      }
    }
    return { changed: false, list };
  };

  return reorderInList(items).list;
}
