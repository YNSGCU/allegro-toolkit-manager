type EnvironmentSwitchGuard = () => boolean | Promise<boolean>;

const guards = new Map<string, EnvironmentSwitchGuard>();

/** 注册页面级切换保护；返回清理函数，供页面卸载时移除。 */
export function registerEnvironmentSwitchGuard(
  id: string,
  guard: EnvironmentSwitchGuard,
): () => void {
  guards.set(id, guard);
  return () => {
    if (guards.get(id) === guard) guards.delete(id);
  };
}

/** 所有页面保护都成功后，才允许改变活动 Allegro 环境。 */
export async function runEnvironmentSwitchGuards(): Promise<boolean> {
  for (const guard of guards.values()) {
    if (!await guard()) return false;
  }
  return true;
}

/** 仅供测试清理模块级状态。 */
export function clearEnvironmentSwitchGuardsForTest(): void {
  guards.clear();
}
