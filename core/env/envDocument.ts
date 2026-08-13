/**
 * ATM - Env 可视化编辑器文档模型
 *
 * 复用 core/parser/parseEnv 解析 funckey/alias/注释/空行，并把 raw 行进一步识别为
 * `set` 变量。提供渲染序列化、单条目 patch 与行级 diff 预览。
 */
import { parseEnv } from '../parser/parseEnv';
import type { EnvEntry } from '../../src/types/hotkey';
import type {
  EnvEditPatch,
  EnvEditStep,
  EnvEditorDocument,
  EnvEditorEntry,
  EnvEditorEntryType,
} from '../../src/types/envEditor';

/** 识别 `set VAR` / `set VAR = value`，返回变量名与值；非变量返回 null */
export function parseVariableLine(raw: string): { key: string; value?: string } | null {
  const trimmed = raw.trim();
  const match = /^set\s+([^\s=]+)(?:\s*=\s*(.*))?$/i.exec(trimmed);
  if (!match) return null;
  const key = match[1];
  const rawValue = match[2]?.trim();
  return { key, value: rawValue === '' ? undefined : rawValue };
}

function toEditorEntry(entry: EnvEntry): EnvEditorEntry {
  const id = `line_${entry.lineNumber}`;
  if (entry.type === 'funckey' || entry.type === 'alias') {
    return {
      id,
      type: entry.type,
      key: entry.key,
      value: entry.command,
      raw: entry.raw,
      lineNumber: entry.lineNumber,
      source: entry.source,
      dirty: false,
      deleted: false,
    };
  }
  if (entry.type === 'raw') {
    const variable = parseVariableLine(entry.raw);
    if (variable) {
      return {
        id,
        type: 'variable',
        key: variable.key,
        value: variable.value,
        raw: entry.raw,
        lineNumber: entry.lineNumber,
        source: entry.source,
        dirty: false,
        deleted: false,
      };
    }
  }
  return {
    id,
    type: entry.type,
    raw: entry.raw,
    lineNumber: entry.lineNumber,
    source: entry.source,
    dirty: false,
    deleted: false,
  };
}

/** 解析 env 内容为编辑器文档 */
export function parseEnvDocument(content: string): EnvEditorDocument {
  const parsed = parseEnv(content);
  return {
    filePath: '',
    entries: parsed.entries.map(toEditorEntry),
    warnings: parsed.warnings,
  };
}

function quoteCommand(command: string | undefined): string {
  const value = command ?? '';
  return value.includes(' ') ? `"${value}"` : value;
}

function renderEntry(entry: EnvEditorEntry): string {
  if (entry.deleted) {
    return `# ${entry.raw}  ; ATM: 注释删除`;
  }
  if (entry.dirty) {
    if (entry.type === 'funckey') return `funckey ${entry.key ?? ''} ${quoteCommand(entry.value)}`;
    if (entry.type === 'alias') return `alias ${entry.key ?? ''} ${quoteCommand(entry.value)}`;
    if (entry.type === 'variable') {
      return entry.value ? `set ${entry.key ?? ''} = ${entry.value}` : `set ${entry.key ?? ''}`;
    }
  }
  return entry.raw;
}

/** 把条目序列化回 env 文本（LF 换行） */
export function renderEnvDocument(entries: EnvEditorEntry[]): string {
  return entries.map(renderEntry).join('\n');
}

/** 应用单个条目 patch（返回新数组，不修改原数组） */
export function applyPatch(entries: EnvEditorEntry[], patch: EnvEditPatch): EnvEditorEntry[] {
  if (patch.id.startsWith('new_')) {
    const newEntry: EnvEditorEntry = {
      id: patch.id,
      type: patch.type ?? 'raw',
      key: patch.key,
      value: patch.value,
      raw: '',
      lineNumber: 0,
      source: 'user_original',
      dirty: true,
      deleted: false,
    };
    return [...entries, newEntry];
  }

  return entries.map((entry) => {
    if (entry.id !== patch.id) return entry;
    return {
      ...entry,
      type: patch.type !== undefined ? patch.type : entry.type,
      key: patch.key !== undefined ? patch.key : entry.key,
      value: patch.value !== undefined ? patch.value : entry.value,
      deleted: patch.deleted !== undefined ? patch.deleted : entry.deleted,
      dirty: true,
    };
  });
}

/** 生成行级 before/after 预览（只包含 dirty/deleted 条目） */
export function buildEditSteps(entries: EnvEditorEntry[]): EnvEditStep[] {
  return entries
    .filter((entry) => entry.dirty || entry.deleted)
    .map((entry) => {
      const after = renderEntry(entry);
      if (entry.lineNumber === 0) {
        return {
          opType: 'add' as const,
          lineNumber: 0,
          before: '',
          after,
          description: `新增${typeLabel(entry.type)}条目`,
        };
      }
      if (entry.deleted) {
        return {
          opType: 'delete' as const,
          lineNumber: entry.lineNumber,
          before: entry.raw,
          after,
          description: `注释删除第 ${entry.lineNumber} 行`,
        };
      }
      return {
        opType: 'modify' as const,
        lineNumber: entry.lineNumber,
        before: entry.raw,
        after,
        description: `修改第 ${entry.lineNumber} 行`,
      };
    });
}

function typeLabel(type: EnvEditorEntryType): string {
  switch (type) {
    case 'funckey':
      return '快捷键';
    case 'alias':
      return '别名';
    case 'variable':
      return '变量';
    case 'comment':
      return '注释';
    case 'blank':
      return '空行';
    default:
      return '原始';
  }
}
