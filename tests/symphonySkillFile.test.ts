/**
 * ATM - symphony_skill.txt 解析与生成测试
 */
import { describe, it, expect } from 'vitest';
import {
  parseSymphonySkillFile,
  generateSymphonySkillContent,
  diffSymphonyCommands,
  formatCommandName,
  serializeCommandEntry,
} from '../core/symphony/symphonySkillFile';
import type { SymphonyCommandEntry } from '../src/types/symphony';

describe('parseSymphonySkillFile', () => {
  it('应解析单命令、rw 标记、引号与注释', () => {
    const content = [
      '; This file contains a list of SKILL commands',
      '',
      'snp',
      'add connect   rw',
      '"show element"',
      '"change control" rw ; 注释',
      '',
    ].join('\n');

    const parsed = parseSymphonySkillFile(content);
    expect(parsed.commands.map((c) => c.name)).toEqual([
      'snp',
      'add connect',
      'show element',
      'change control',
    ]);
    expect(parsed.commands[0].rw).toBe(false);
    expect(parsed.commands[1].rw).toBe(true);
    expect(parsed.commands[3].rw).toBe(true);
    expect(parsed.commands[3].comment).toBe('注释');
    expect(parsed.isAtmGenerated).toBe(false);
    // 头部说明行应保留
    expect(parsed.preservedLines.length).toBeGreaterThan(0);
  });

  it('应识别 ATM 生成段标记', () => {
    const content = [
      '; ===== ATM Generated Symphony Skill File Start =====',
      'snp',
      '; ===== ATM Generated Symphony Skill File End =====',
    ].join('\n');
    const parsed = parseSymphonySkillFile(content);
    expect(parsed.isAtmGenerated).toBe(true);
    // ATM 段行不进入保留区
    expect(parsed.preservedLines).toHaveLength(0);
  });

  it('应忽略空行与纯注释行', () => {
    const parsed = parseSymphonySkillFile('\n\n; only comment\n\n');
    expect(parsed.commands).toHaveLength(0);
  });
});

describe('formatCommandName / serializeCommandEntry', () => {
  it('多词命令应加引号', () => {
    expect(formatCommandName('snp')).toBe('snp');
    expect(formatCommandName('add connect')).toBe('"add connect"');
  });

  it('序列化应包含 rw 与注释', () => {
    const entry: SymphonyCommandEntry = {
      name: 'change control',
      rw: true,
      source: 'atm',
      comment: '测试',
    };
    expect(serializeCommandEntry(entry)).toBe('"change control" rw ; 测试');
  });
});

describe('generateSymphonySkillContent', () => {
  it('应生成官方说明头与命令列表（字母序）', () => {
    const content = generateSymphonySkillContent({
      commands: [
        { name: 'zap', rw: true, source: 'atm' },
        { name: 'add connect', rw: false, source: 'atm' },
        { name: 'snp', rw: false, source: 'atm' },
      ],
    });

    expect(content).toContain('; This file contains a list of SKILL commands enabled in multi-user');
    expect(content).toContain('"add connect"');
    expect(content).toContain('zap rw');
    const snpIdx = content.indexOf('snp');
    const zapIdx = content.indexOf('zap rw');
    expect(snpIdx).toBeGreaterThan(-1);
    expect(zapIdx).toBeGreaterThan(snpIdx);
  });

  it('应保留既有手动条目并与 ATM 命令去重', () => {
    const existing = [
      '; 手工头部',
      'snp',
      'my_custom_cmd rw',
      '',
    ].join('\n');
    const content = generateSymphonySkillContent({
      commands: [{ name: 'snp', rw: false, source: 'atm' }],
      existingContent: existing,
    });

    expect(content).toContain('my_custom_cmd rw');
    expect(content).toContain('; 手工头部');
    // snp 只出现一次（ATM 段）
    const snpCount = (content.match(/^snp$/gm) || []).length;
    expect(snpCount).toBe(1);
  });

  it('既有 rw 标记应在合并后保留', () => {
    const existing = 'snp rw\n';
    const content = generateSymphonySkillContent({
      commands: [{ name: 'snp', rw: false, source: 'atm' }],
      existingContent: existing,
    });
    expect(content).toContain('snp rw');
  });

  it('空命令列表应输出 (none) 占位', () => {
    const content = generateSymphonySkillContent({ commands: [] });
    expect(content).toContain('(none)');
  });

  it('幂等性：解析生成结果再生成应保持命令一致', () => {
    const commands: SymphonyCommandEntry[] = [
      { name: 'snp', rw: false, source: 'atm' },
      { name: 'add connect', rw: true, source: 'atm' },
    ];
    const first = generateSymphonySkillContent({
      commands,
      existingContent: '; 手动\nmanual_cmd\n',
    });
    const second = generateSymphonySkillContent({
      commands,
      existingContent: first,
    });
    const firstParsed = parseSymphonySkillFile(first);
    const secondParsed = parseSymphonySkillFile(second);
    const names = (p: typeof firstParsed) =>
      [...p.commands]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => `${c.name}:${c.rw}`);
    expect(names(secondParsed)).toEqual(names(firstParsed));
    expect(secondParsed.commands).toHaveLength(3); // snp + add connect + manual_cmd
  });
});

describe('diffSymphonyCommands', () => {
  it('应报告新增、移除与 rw 变更', () => {
    const before: SymphonyCommandEntry[] = [
      { name: 'a', rw: false, source: 'existing' },
      { name: 'b', rw: true, source: 'existing' },
      { name: 'c', rw: false, source: 'existing' },
    ];
    const after: SymphonyCommandEntry[] = [
      { name: 'a', rw: false, source: 'atm' },
      { name: 'b', rw: false, source: 'atm' },
      { name: 'd', rw: false, source: 'atm' },
    ];
    const diff = diffSymphonyCommands(before, after);
    expect(diff.added).toEqual(['d']);
    expect(diff.removed).toEqual(['c']);
    expect(diff.rwChanged).toEqual(['b']);
  });
});
