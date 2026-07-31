import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifySkillByPath, scanAllSkills, scanSkillDirectory } from '../core/skill/scanSkill';

const FIXTURE_DIR = path.join(__dirname, '..', 'test-fixtures', 'skill-sample');
const UTILS_DIR = path.join(FIXTURE_DIR, 'utils');

describe('scanSkillDirectory', () => {
  it('扫描目录中的 Skill 文件', () => {
    const skills = scanSkillDirectory(FIXTURE_DIR, 'user');
    expect(skills.length).toBeGreaterThanOrEqual(3);
  });

  it('为扫描到的 Skill 正确赋予 tier', () => {
    const skills = scanSkillDirectory(FIXTURE_DIR, 'company');
    for (const skill of skills) {
      expect(skill.tier).toBe('company');
    }
  });

  it('扫描一级子目录中的 Skill 文件', () => {
    const skills = scanSkillDirectory(FIXTURE_DIR, 'user');
    const utilsSkills = skills.filter(
      (skill) => skill.dirPath === UTILS_DIR || skill.dirPath === UTILS_DIR.replace(/\\/g, '/'),
    );

    expect(utilsSkills.length).toBeGreaterThan(0);
    expect(skills.find((skill) => skill.name === 'core_lib')).toBeTruthy();
  });

  it('检测 package.json', () => {
    const skills = scanSkillDirectory(FIXTURE_DIR, 'user');
    const coreLib = skills.find((skill) => skill.name === 'core_lib');
    expect(coreLib?.hasPackageJson).toBe(true);
  });

  it('读取 package.json 中的依赖', () => {
    const skills = scanSkillDirectory(FIXTURE_DIR, 'user');
    const coreLib = skills.find((skill) => skill.name === 'core_lib');
    expect((coreLib?.dependencies.length || 0)).toBeGreaterThan(0);
  });

  it('支持扫描 .ile 文件', () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'atm-scan-skill-ile-'));

    try {
      writeFileSync(path.join(tempDir, 'snap_to_anything.ile'), 'compiled skill placeholder', 'utf8');
      const skills = scanSkillDirectory(tempDir, 'user');

      expect(skills.map((skill) => skill.name)).toContain('snap_to_anything');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('不存在的目录返回空列表', () => {
    const skills = scanSkillDirectory('/path/to/nonexistent', 'user');
    expect(skills).toHaveLength(0);
  });

  it('空路径返回空列表', () => {
    expect(scanSkillDirectory('', 'user')).toHaveLength(0);
    expect(scanSkillDirectory('  ', 'user')).toHaveLength(0);
  });

  it('传入文件路径而不是目录时返回空列表', () => {
    const skills = scanSkillDirectory(path.join(FIXTURE_DIR, 'sample_utils.il'), 'user');
    expect(skills).toHaveLength(0);
  });
});

describe('scanAllSkills', () => {
  const pcbenvPath = FIXTURE_DIR;
  const atmGeneratedPath = path.join(FIXTURE_DIR, 'atm');
  const companySkillPaths = [path.join(FIXTURE_DIR)];

  it('返回三级分类结果', () => {
    const result = scanAllSkills({
      pcbenvPath,
      atmGeneratedPath,
      companySkillPaths,
    });

    expect(Array.isArray(result.company)).toBe(true);
    expect(Array.isArray(result.user)).toBe(true);
    expect(Array.isArray(result.atm)).toBe(true);
    expect(Array.isArray(result.all)).toBe(true);
  });

  it('同路径的 company Skill 不重复计入', () => {
    const result = scanAllSkills({
      pcbenvPath: '',
      atmGeneratedPath: '',
      companySkillPaths: [path.join(FIXTURE_DIR)],
    });

    expect(result.company.length + result.user.length + result.atm.length).toBe(result.all.length);
  });
});

describe('classifySkillByPath', () => {
  const envInfo = {
    pcbenvPath: '/home/user/pcbenv',
    atmGeneratedPath: '/home/user/pcbenv/atm_generated',
    companySkillPaths: ['/company/skills', '/shared/skills'],
  };

  it('将 atm_generated 下的路径归类为 atm', () => {
    const result = classifySkillByPath('/home/user/pcbenv/atm_generated/test.il', envInfo);
    expect(result).toBe('atm');
  });

  it('将 pcbenv/skill 下的路径归类为 user', () => {
    const result = classifySkillByPath('/home/user/pcbenv/skill/my_skill.il', envInfo);
    expect(result).toBe('user');
  });

  it('将公司路径归类为 company', () => {
    const result = classifySkillByPath('/company/skills/tool.il', envInfo);
    expect(result).toBe('company');
  });

  it('未知路径默认归类为 user', () => {
    const result = classifySkillByPath('/some/other/path/test.il', envInfo);
    expect(result).toBe('user');
  });
});
