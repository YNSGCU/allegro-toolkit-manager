const INTERNAL_ERROR_PATTERNS = [
  /cannot read propert/i,
  /is not a function/i,
  /typeerror/i,
  /window\.atm/i,
  /ipcrenderer|ipcmain|invoke\(/i,
  /enhancedscanskills|locateenvironment|menuloadprofiles/i,
  /undefined|null is not an object/i,
];

/**
 * 将桥接层和运行时异常转换为稳定的中文界面文案。
 * 已由业务层提供的中文错误会原样保留，内部方法名与英文堆栈不直接展示给用户。
 */
export function formatUserError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const message = raw.trim();

  if (!message) return fallback;
  if (INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    return `${fallback}。未连接到 ATM 桌面服务，请在桌面应用中重试。`;
  }

  return /[\u3400-\u9fff]/.test(message) ? message : fallback;
}
