import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scanEnhancedSkills } from '../core/skill/enhancedScan';
import { scanSkillDirectory } from '../core/skill/scanSkill';
import { checkSkillLoad, scanLoadSources } from '../core/validator/skillLoadChecker';
import { getLoadStatusDisplay } from '../src/types/skill';

const tempRoots: string[] = [];

function createPcbenvPackage(loadPackage = false) {
  const root = mkdtempSync(path.join(tmpdir(), 'atm-skill-package-'));
  tempRoots.push(root);
  const skillDir = path.join(root, 'skill');
  const packageDir = path.join(skillDir, 'align-tools');
  const atmGeneratedPath = path.join(root, 'atm_generated');
  mkdirSync(packageDir, { recursive: true });
  mkdirSync(atmGeneratedPath, { recursive: true });

  writeFileSync(path.join(packageDir, 'loader.il'), 'load("main.il")\n', 'utf8');
  writeFileSync(path.join(packageDir, 'main.il'), 'load("module_align_main.il")\n', 'utf8');
  writeFileSync(
    path.join(packageDir, 'module_align_main.il'),
    'procedure(align_components()\n  printf("align")\n)\n',
    'utf8',
  );
  writeFileSync(
    path.join(packageDir, 'module_align_utils.il'),
    'procedure(align_helper()\n  printf("helper")\n)\n',
    'utf8',
  );
  writeFileSync(
    path.join(root, 'allegro.ilinit'),
    loadPackage ? `load("${path.join(packageDir, 'loader.il').replace(/\\/g, '/')}")\n` : '',
    'utf8',
  );
  writeFileSync(path.join(root, 'env'), '', 'utf8');

  return { root, skillDir, packageDir, atmGeneratedPath };
}

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

describe('directory Skill package scanning', () => {
  it('collapses a multi-file subdirectory into one package with loader as entry', () => {
    const { skillDir, packageDir } = createPcbenvPackage();

    const skills = scanSkillDirectory(skillDir, 'user');

    expect(skills).toHaveLength(1);
    expect(skills[0]).toEqual(expect.objectContaining({
      name: 'align-tools',
      filePath: path.join(packageDir, 'loader.il'),
      sourceFiles: expect.arrayContaining([
        path.join(packageDir, 'loader.il'),
        path.join(packageDir, 'main.il'),
        path.join(packageDir, 'module_align_main.il'),
        path.join(packageDir, 'module_align_utils.il'),
      ]),
    }));
  });

  it('aggregates commands from package modules and recognizes an entry-file load', async () => {
    const { root, atmGeneratedPath } = createPcbenvPackage(true);

    const result = await scanEnhancedSkills({
      pcbenvPath: root,
      atmGeneratedPath,
      companySkillPaths: [],
    });

    expect(result.user).toHaveLength(1);
    expect(result.user[0].name).toBe('align-tools');
    expect(result.user[0].packageType).toBe('directory_package');
    expect(result.user[0].loadStatus).toBe('loaded_configured');
    expect(result.user[0].entryCommands.map((command) => command.name)).toEqual(
      expect.arrayContaining(['align_components', 'align_helper']),
    );

    const loadSources = scanLoadSources({
      pcbenvPath: root,
      atmGeneratedPath,
      ilinitFilePath: path.join(root, 'allegro.ilinit'),
      envFilePath: path.join(root, 'env'),
    } as any);
    expect(checkSkillLoad('module_align_main', loadSources, null).status).toBe('loaded_configured');
  });

  it('uses a neutral label when no startup load is configured', () => {
    expect(getLoadStatusDisplay('enabled_but_not_loaded').label).toBe('未配置启动加载');
  });
});
