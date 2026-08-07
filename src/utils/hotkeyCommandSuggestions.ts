import commandDictionaryJson from '../../core/dictionary/command_dictionary.json';
import type { CommandSourceType, HotkeyBinding } from '../types/hotkey';

interface CommandDictionaryEntry {
  chineseName: string;
  category: string;
  description: string;
  defaultSource: CommandSourceType;
}

interface CommandDictionaryFile {
  commands: Record<string, CommandDictionaryEntry>;
}

export interface HotkeyCommandCandidate {
  command: string;
  chineseName: string;
  category: string;
  description: string;
  source: 'builtin_dictionary' | 'current_workspace';
  commandSource?: CommandSourceType;
}

const BUILTIN_COMMANDS = (commandDictionaryJson as CommandDictionaryFile).commands;

const COMMON_COMMAND_PRIORITY = [
  'move',
  'copy',
  'delete',
  'add connect',
  'slide',
  'zoom fit',
  'mirror',
  'show element',
];

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function scoreCandidate(candidate: HotkeyCommandCandidate, query: string): number | null {
  const command = normalize(candidate.command);
  const chineseName = normalize(candidate.chineseName);
  const category = normalize(candidate.category);
  const description = normalize(candidate.description);
  const commonPriority = COMMON_COMMAND_PRIORITY.indexOf(command);
  const commonBonus = commonPriority >= 0 ? commonPriority / 100 : 0.5;

  if (command === query) return commonBonus;
  if (command.startsWith(query)) return 10 + commonBonus;
  if (chineseName.startsWith(query)) return 20 + commonBonus;
  if (command.split(/\s+/).some((part) => part.startsWith(query))) return 30 + commonBonus;
  if (command.includes(query)) return 40 + commonBonus;
  if (chineseName.includes(query)) return 50 + commonBonus;
  if (category.includes(query)) return 60 + commonBonus;
  if (description.includes(query)) return 70 + commonBonus;
  return null;
}

function fromWorkspaceBinding(binding: HotkeyBinding): HotkeyCommandCandidate | null {
  const command = binding.command?.trim();
  if (!command) return null;

  return {
    command,
    chineseName: binding.chineseName || command,
    category: binding.category || '当前配置',
    description: binding.description || `当前工作区已有绑定：${binding.key}`,
    source: 'current_workspace',
    commandSource: binding.commandSource,
  };
}

export function getHotkeyCommandCandidates(bindings: HotkeyBinding[] = []): HotkeyCommandCandidate[] {
  const candidates = new Map<string, HotkeyCommandCandidate>();

  for (const [command, entry] of Object.entries(BUILTIN_COMMANDS)) {
    candidates.set(normalize(command), {
      command,
      chineseName: entry.chineseName,
      category: entry.category,
      description: entry.description,
      source: 'builtin_dictionary',
      commandSource: entry.defaultSource,
    });
  }

  for (const binding of bindings) {
    const candidate = fromWorkspaceBinding(binding);
    if (!candidate) continue;
    const key = normalize(candidate.command);
    const existing = candidates.get(key);
    candidates.set(key, existing ? { ...existing, ...candidate, source: existing.source } : candidate);
  }

  return [...candidates.values()];
}

export function suggestHotkeyCommands(
  query: string,
  bindings: HotkeyBinding[] = [],
  maxResults = 6,
): HotkeyCommandCandidate[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  return getHotkeyCommandCandidates(bindings)
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate, normalizedQuery) }))
    .filter((item): item is { candidate: HotkeyCommandCandidate; score: number } => item.score !== null)
    .sort((left, right) => {
      if (left.score !== right.score) return left.score - right.score;
      if (left.candidate.command.length !== right.candidate.command.length) {
        return left.candidate.command.length - right.candidate.command.length;
      }
      return left.candidate.command.localeCompare(right.candidate.command);
    })
    .slice(0, maxResults)
    .map((item) => item.candidate);
}

export function findExactHotkeyCommand(
  command: string,
  bindings: HotkeyBinding[] = [],
): HotkeyCommandCandidate | null {
  const normalizedCommand = normalize(command);
  if (!normalizedCommand) return null;
  return getHotkeyCommandCandidates(bindings).find(
    (candidate) => normalize(candidate.command) === normalizedCommand,
  ) || null;
}
