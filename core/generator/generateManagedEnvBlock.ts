/**
 * ATM - 托管块生成模块
 * 生成 ATM Managed Hotkeys 块内容
 *
 * 注意：bootstrap 相关函数已迁移到 generateBootstrap.ts
 * 此文件保持向后兼容导出
 */
import {
  ATM_MANAGED_BLOCK_START,
  ATM_MANAGED_BLOCK_END,
  isManagedBindingSource,
} from '../../src/types/hotkey';
import type { HotkeyBinding } from '../../src/types/hotkey';
import {
  generateBootstrapLines as _genBootstrap,
  hasBootstrapInIlinit as _hasBootstrap,
  insertBootstrapToIlinit as _insertBootstrap,
} from './generateBootstrap';

/**
 * 生成 ATM 托管块文本
 * @param bindings 要写入托管块的快捷键绑定列表
 * @returns 完整的托管块文本（包含开始/结束标记）
 */
export function generateManagedEnvBlock(bindings: HotkeyBinding[]): string {
  const lines: string[] = [];

  lines.push(ATM_MANAGED_BLOCK_START);

  // 过滤出需要写入的绑定
  // V1：写入所有非 user_original 且状态正常的绑定
  const writableBindings = bindings.filter((b) => {
    // 只写入显式由 ATM 管理的绑定，或用户主动添加的
    return isManagedBindingSource(b.bindingSource) && b.status !== 'disabled';
  });

  if (writableBindings.length === 0) {
    // 空块，保留标记但加注释说明
    lines.push('# (empty - no managed hotkeys)');
  } else {
    // 按类型分组，先 funckey 后 alias
    const funckeys = writableBindings
      .filter((b) => b.type === 'funckey')
      .sort((a, b) => a.key.localeCompare(b.key));
    const aliases = writableBindings
      .filter((b) => b.type === 'alias')
      .sort((a, b) => a.key.localeCompare(b.key));

    for (const fb of funckeys) {
      lines.push(`funckey ${fb.key} ${fb.command}`);
    }

    for (const ab of aliases) {
      lines.push(`alias ${ab.key} ${ab.command}`);
    }
  }

  lines.push(ATM_MANAGED_BLOCK_END);

  return lines.join('\n');
}

/**
 * 在当前 env 内容中替换或追加 ATM 托管块
 * @param currentContent 当前 env 文件内容
 * @param newBlockContent 新的托管块内容（由 generateManagedEnvBlock 生成）
 * @returns 更新后的 env 文件内容
 */
export function updateEnvWithManagedBlock(
  currentContent: string,
  newBlockContent: string
): string {
  const startRegex = /^# ===== ATM Managed Hotkeys Start =====\r?\n/m;
  const endRegex = /\r?\n# ===== ATM Managed Hotkeys End =====/m;
  const startMatch = currentContent.match(startRegex);
  const endMatch = currentContent.match(endRegex);

  if (startMatch && endMatch) {
    // 替换已有块
    const startIndex = startMatch.index!;
    const endIndex = endMatch.index! + endMatch[0].length;
    const before = currentContent.substring(0, startIndex);
    const after = currentContent.substring(endIndex);

    // 确保格式整洁
    const beforeTrimmed = before.endsWith('\n') ? before : before + '\n';
    const afterTrimmed = after.startsWith('\n') ? after.substring(1) : after;

    return beforeTrimmed + newBlockContent + '\n' + afterTrimmed;
  } else {
    // 追加新块
    const trimmedContent = currentContent.endsWith('\n') ? currentContent : currentContent + '\n';
    // 加空行分隔
    return trimmedContent + '\n' + newBlockContent + '\n';
  }
}

/**
 * 生成 ATM Bootstrap 插入内容
 * 已迁移到 generateBootstrap.ts，此处保留向后兼容引用
 *
 * @deprecated 请从 './generateBootstrap' 导入
 */
export { generateBootstrapLines, hasBootstrapInIlinit, insertBootstrapToIlinit } from './generateBootstrap';
