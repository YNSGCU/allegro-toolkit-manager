/**
 * ATM - 命令注册中心测试
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildCommandRegistry, findCommand, findUnresolvedRefs } from '../core/skill/commandRegistry';
import type { ScannedSkill, CommandRegistry } from '../src/types/skill';
import type { HotkeyBinding } from '../src/types/hotkey';

describe('buildCommandRegistry', () => {
  it('应该从空列表构建空注册中心', () => {
    const registry = buildCommandRegistry([]);
    expect(registry.stats.totalCommands).toBe(0);
    expect(Object.keys(registry.entries)).toHaveLength(0);
  });

  it('应该从包含函数的 Skill 构建注册中心', () => {
    const skills: ScannedSkill[] = [
      {
        id: 'test1',
        name: 'test1',
        filePath: '/test/test1.il',
        dirPath: '/test',
        tier: 'user',
        status: 'enabled',
        functions: [
          { name: 'funcA', type: 'procedure', lineNumber: 1 },
          { name: 'funcB', type: 'defun', lineNumber: 5 },
        ],
        hasPackageJson: false,
        dependencies: [],
      },
    ];

    const registry = buildCommandRegistry(skills);
    expect(registry.stats.totalCommands).toBe(2);
    expect(Object.keys(registry.entries)).toHaveLength(2);
    expect(registry.entries['funca']).toBeTruthy(); // case insensitive key
    expect(registry.entries['funcb']).toBeTruthy();
  });

  it('应该将命令名转为小写作为索引键', () => {
    const skills: ScannedSkill[] = [
      {
        id: 'test1',
        name: 'test1',
        filePath: '/test/test1.il',
        dirPath: '/test',
        tier: 'user',
        status: 'enabled',
        functions: [
          { name: 'MyFunc', type: 'procedure', lineNumber: 1 },
        ],
        hasPackageJson: false,
        dependencies: [],
      },
    ];

    const registry = buildCommandRegistry(skills);
    expect(registry.entries['myfunc']).toBeTruthy();
    expect(registry.entries['MYFUNC']).toBeUndefined(); // indexed by lowercase
  });

  it('同名命令来自多个 Skill 时应该合并', () => {
    const skills: ScannedSkill[] = [
      {
        id: 's1',
        name: 'skill1',
        filePath: '/test/s1.il',
        dirPath: '/test',
        tier: 'user',
        status: 'enabled',
        functions: [{ name: 'commonFunc', type: 'procedure', lineNumber: 1 }],
        hasPackageJson: false,
        dependencies: [],
      },
      {
        id: 's2',
        name: 'skill2',
        filePath: '/test/s2.il',
        dirPath: '/test',
        tier: 'company',
        status: 'enabled',
        functions: [{ name: 'commonFunc', type: 'procedure', lineNumber: 1 }],
        hasPackageJson: false,
        dependencies: [],
      },
    ];

    const registry = buildCommandRegistry(skills);
    expect(registry.entries['commonfunc']).toHaveLength(2);
  });

  it('应该正确统计各级别命令数', () => {
    const skills: ScannedSkill[] = [
      {
        id: 's1',
        name: 's1',
        filePath: '/test/s1.il',
        dirPath: '/test',
        tier: 'company',
        status: 'enabled',
        functions: [{ name: 'f1', type: 'procedure', lineNumber: 1 }],
        hasPackageJson: false,
        dependencies: [],
      },
      {
        id: 's2',
        name: 's2',
        filePath: '/test/s2.il',
        dirPath: '/test',
        tier: 'user',
        status: 'enabled',
        functions: [{ name: 'f2', type: 'defun', lineNumber: 1 }],
        hasPackageJson: false,
        dependencies: [],
      },
      {
        id: 's3',
        name: 's3',
        filePath: '/test/s3.il',
        dirPath: '/test',
        tier: 'atm',
        status: 'enabled',
        functions: [{ name: 'f3', type: 'defunValue', lineNumber: 1 }],
        hasPackageJson: false,
        dependencies: [],
      },
    ];

    const registry = buildCommandRegistry(skills);
    expect(registry.stats.totalCommands).toBe(3); // 3 unique command names
    // Each command appears once, so counts match total command entries
    const entryCount = Object.values(registry.entries).flat().length;
    expect(entryCount).toBe(3);
  });

  it('应该把 axlCmdRegister 注册的外部命令名收进注册中心', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'atm-command-registry-'));
    const skillFilePath = join(tempDir, 'smart-snap.il');

    try {
      writeFileSync(
        skillFilePath,
        [
          'axlCmdRegister("snp" \'ssnap_native_run)',
          'procedure(ssnap_native_run()',
          '  t',
          ')',
        ].join('\n'),
        'utf8',
      );

      const skills: ScannedSkill[] = [
        {
          id: 'smart-snap',
          name: 'smart-snap',
          filePath: skillFilePath,
          dirPath: tempDir,
          tier: 'user',
          status: 'enabled',
          functions: [],
          hasPackageJson: false,
          dependencies: [],
        },
      ];

      const registry = buildCommandRegistry(skills);

      expect(registry.entries.snp).toBeTruthy();
      expect(registry.entries.snp[0].skillName).toBe('smart-snap');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('即使 Skill 已预填 functions，也应该继续补收 axlCmdRegister 的外部命令名', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'atm-command-registry-prefilled-'));
    const skillFilePath = join(tempDir, 'change-via-net.il');

    try {
      writeFileSync(
        skillFilePath,
        [
          'axlCmdRegister("cvn" \'ps_ChangeViaNet)',
          'procedure(ps_ChangeViaNet()',
          '  t',
          ')',
        ].join('\n'),
        'utf8',
      );

      const skills: ScannedSkill[] = [
        {
          id: 'change-via-net',
          name: 'ChangeViaNet',
          filePath: skillFilePath,
          dirPath: tempDir,
          tier: 'user',
          status: 'enabled',
          functions: [
            { name: 'ps_ChangeViaNet', type: 'procedure', lineNumber: 2 },
          ],
          hasPackageJson: false,
          dependencies: [],
        },
      ];

      const registry = buildCommandRegistry(skills);

      expect(registry.entries.cvn).toBeTruthy();
      expect(registry.entries.cvn[0].skillName).toBe('ChangeViaNet');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('对于无法直接解析的 .ile，也应该从同目录说明文档补收默认命令名', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'atm-command-registry-doc-hint-'));
    const skillFilePath = join(tempDir, 'snap_to_anything.ile');

    try {
      writeFileSync(skillFilePath, 'compiled skill placeholder', 'utf8');
      writeFileSync(
        join(tempDir, 'snap_to_anything使用说明.txt'),
        [
          '功能默认命令 snp',
          'env中设置 funckey "F3" "snp" 可将智能吸附定义为F3激活',
        ].join('\n'),
        'utf8',
      );

      const skills: ScannedSkill[] = [
        {
          id: 'snap-to-anything',
          name: 'snap_to_anything',
          filePath: skillFilePath,
          dirPath: tempDir,
          tier: 'user',
          status: 'enabled',
          functions: [],
          hasPackageJson: false,
          dependencies: [],
        },
      ];

      const registry = buildCommandRegistry(skills);

      expect(registry.entries.snp).toBeTruthy();
      expect(registry.entries.snp[0].skillName).toBe('snap_to_anything');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('findCommand', () => {
  const registry: CommandRegistry = {
    entries: {
      'fanout': [
        { commandName: 'fanout', type: 'procedure', skillFilePath: '/s.il', skillName: 's', tier: 'user', skillEnabled: true },
      ],
      'initboard': [
        { commandName: 'initBoard', type: 'procedure', skillFilePath: '/s2.il', skillName: 's2', tier: 'company', skillEnabled: true },
      ],
    },
    stats: { totalCommands: 2, companyCommands: 1, userCommands: 1, atmCommands: 0 },
  };

  it('应该通过命令名查找', () => {
    const result = findCommand(registry, 'fanout');
    expect(result).toHaveLength(1);
    expect(result![0].commandName).toBe('fanout');
  });

  it('查找应该不区分大小写', () => {
    const result = findCommand(registry, 'FANOUT');
    expect(result).toHaveLength(1);
  });

  it('不存在的命令应该返回 null', () => {
    const result = findCommand(registry, 'nonexistent');
    expect(result).toBeNull();
  });
});

describe('findUnresolvedRefs', () => {
  const registry: CommandRegistry = {
    entries: {
      'fanout': [
        { commandName: 'fanout', type: 'procedure', skillFilePath: '/s.il', skillName: 's', tier: 'user', skillEnabled: true },
      ],
      'dobackup': [
        { commandName: 'doBackup', type: 'procedure', skillFilePath: '/s2.il', skillName: 's2', tier: 'company', skillEnabled: true },
      ],
    },
    stats: { totalCommands: 2, companyCommands: 1, userCommands: 1, atmCommands: 0 },
  };

  const makeBinding = (command: string): HotkeyBinding => ({
    id: 'test',
    key: 'F1',
    command,
    type: 'funckey',
    source: 'user_original',
    status: 'normal',
  });

  it('已解析的命令应该返回 info 级别', () => {
    const result = findUnresolvedRefs(registry, [makeBinding('fanout')]);
    expect(result.stats.resolved).toBe(1);
    expect(result.checks[0].severity).toBe('info');
    expect(result.checks[0].type).toBe('resolved');
  });

  it('未解析的命令应该返回 error 级别', () => {
    const result = findUnresolvedRefs(registry, [makeBinding('nonexistent')]);
    expect(result.stats.unresolved).toBe(1);
    expect(result.checks[0].severity).toBe('error');
    expect(result.checks[0].type).toBe('unresolved');
  });

  it('公司只读的命令应该返回 warning 级别', () => {
    const result = findUnresolvedRefs(registry, [makeBinding('doBackup')]);
    expect(result.stats.companySkill).toBe(1);
    expect(result.checks[0].severity).toBe('warning');
    expect(result.checks[0].type).toBe('company_skill');
  });

  it('空命令应该被跳过', () => {
    const result = findUnresolvedRefs(registry, [makeBinding('')]);
    expect(result.checks).toHaveLength(0);
  });

  it('多个命令应该正确统计', () => {
    const bindings = [
      makeBinding('fanout'),
      makeBinding('doBackup'),
      makeBinding('unknown'),
      makeBinding(''),
    ];
    const result = findUnresolvedRefs(registry, bindings);
    // fanout is resolved (info), save is company_skill (warning), unknown is unresolved (error)
    expect(result.stats.resolved).toBe(1);
    expect(result.stats.companySkill).toBe(1);
    expect(result.stats.unresolved).toBe(1);
    expect(result.checks).toHaveLength(3); // 3 non-empty commands
  });

  it('Allegro 内置命令应该自动匹配（白名单）', () => {
    const result = findUnresolvedRefs(registry, [
      makeBinding('add'),
      makeBinding('move'),
      makeBinding('slide'),
      makeBinding('zoom'),
      makeBinding('spin'),
      makeBinding('copy'),
    ]);
    expect(result.stats.resolved).toBe(6);
    expect(result.stats.unresolved).toBe(0);
    expect(result.checks.every((c) => c.severity === 'info')).toBe(true);
    expect(result.checks.every((c) => c.type === 'resolved')).toBe(true);
  });

  it('内置命令白名单不区分大小写', () => {
    const result = findUnresolvedRefs(registry, [makeBinding('ADD'), makeBinding('Zoom')]);
    expect(result.stats.resolved).toBe(2);
    expect(result.stats.unresolved).toBe(0);
  });

  it('env 文件中的引号命令应该正确剥离引号匹配白名单', () => {
    const result = findUnresolvedRefs(registry, [makeBinding('"add"'), makeBinding('"move"'), makeBinding("'slide'")]);
    expect(result.stats.resolved).toBe(3);
    expect(result.stats.unresolved).toBe(0);
  });

  it('命令末尾的分号应该自动剥离', () => {
    const result = findUnresolvedRefs(registry, [makeBinding('move;'), makeBinding('copy;')]);
    expect(result.stats.resolved).toBe(2);
    expect(result.stats.unresolved).toBe(0);
  });

  it('ipick_to_gridunit 内置命令应该被识别', () => {
    const result = findUnresolvedRefs(registry, [makeBinding('ipick_to_gridunit')]);
    expect(result.stats.resolved).toBe(1);
    expect(result.checks[0].message).toContain('内置命令');
  });
});
