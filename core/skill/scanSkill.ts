/**
 * ATM - Skill 目录扫描模块
 * 扫描三级 Skill 目录并分类：公司（只读）/ 用户（可管理）/ ATM（完全托管）
 */
import fs from 'fs';
import path from 'path';
import { isSkillFile } from '../parser/parseSkillMeta';
import type { ScannedSkill, SkillTier } from '../../src/types/skill';
import type { EnvironmentInfo } from '../../src/types/environment';

/**
 * 扫描单个 Skill 目录
 * @param dirPath 目录路径
 * @param tier 来源层级
 * @returns 扫描到的 Skill 列表
 */
export function scanSkillDirectory(dirPath: string, tier: SkillTier): ScannedSkill[] {
  const skills: ScannedSkill[] = [];

  if (!dirPath || typeof dirPath !== 'string' || dirPath.trim() === '') {
    return skills;
  }

  // 规范化路径
  const normalizedPath = path.normalize(dirPath);

  try {
    if (!fs.existsSync(normalizedPath)) {
      return skills;
    }

    const stat = fs.statSync(normalizedPath);
    if (!stat.isDirectory()) {
      return skills;
    }

    const entries = fs.readdirSync(normalizedPath, { encoding: 'utf-8' });

    for (const entry of entries) {
      const fullPath = path.join(normalizedPath, entry);

      try {
        const entryStat = fs.statSync(fullPath);

        if (entryStat.isFile() && isSkillFile(entry)) {
          const skill = scanSingleSkillFile(fullPath, entry, tier);
          if (skill) {
            skills.push(skill);
          }
        } else if (entryStat.isDirectory()) {
          // 一级子目录：多文件按一个目录型 Skill 包处理，单文件保持兼容。
          try {
            const subEntries = fs.readdirSync(fullPath, { encoding: 'utf-8' });
            const subSkillFiles = subEntries
              .map((subEntry) => path.join(fullPath, subEntry))
              .filter((subFullPath) => {
                try {
                  return fs.statSync(subFullPath).isFile() && isSkillFile(path.basename(subFullPath));
                } catch {
                  return false;
                }
              });

            if (subSkillFiles.length > 1) {
              const skillPackage = scanSkillPackage(fullPath, subSkillFiles, tier);
              if (skillPackage) skills.push(skillPackage);
            } else if (subSkillFiles.length === 1) {
              const subFullPath = subSkillFiles[0];
              const skill = scanSingleSkillFile(subFullPath, path.basename(subFullPath), tier);
              if (skill) skills.push(skill);
            }
          } catch {
            // 跳过无法读取的子目录
          }
        }
      } catch {
        // 跳过无法访问的条目
      }
    }
  } catch {
    // 跳过无法读取的目录
  }

  return skills;
}

function readPackageMetadata(dirPath: string): { hasPackageJson: boolean; dependencies: string[]; packageName?: string; entry?: string } {
  const packageJsonPath = path.join(dirPath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return { hasPackageJson: false, dependencies: [] };

  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, { encoding: 'utf-8' }));
    return {
      hasPackageJson: true,
      dependencies: Array.isArray(pkg.requires)
        ? pkg.requires.filter((dep: unknown): dep is string => typeof dep === 'string')
        : [],
      packageName: typeof pkg.name === 'string' && pkg.name.trim() ? pkg.name.trim() : undefined,
      entry: [pkg.entry, pkg.main, pkg.loader].find((value) => typeof value === 'string' && value.trim()),
    };
  } catch {
    return { hasPackageJson: true, dependencies: [] };
  }
}

function choosePackageEntryFile(dirPath: string, sourceFiles: string[], configuredEntry?: string): string {
  const byName = new Map(sourceFiles.map((filePath) => [path.basename(filePath).toLowerCase(), filePath]));
  const configuredName = configuredEntry ? path.basename(configuredEntry).toLowerCase() : '';
  if (configuredName && byName.has(configuredName)) return byName.get(configuredName)!;

  const directoryName = path.basename(dirPath).toLowerCase();
  const preferredNames = [
    'loader.il', 'loader.ile', 'loader.cls',
    'main.il', 'main.ile', 'main.cls',
    `${directoryName}.il`, `${directoryName}.ile`, `${directoryName}.cls`,
  ];
  for (const preferredName of preferredNames) {
    const match = byName.get(preferredName);
    if (match) return match;
  }
  return [...sourceFiles].sort((a, b) => a.localeCompare(b))[0];
}

function scanSkillPackage(dirPath: string, sourceFiles: string[], tier: SkillTier): ScannedSkill | null {
  try {
    const metadata = readPackageMetadata(dirPath);
    const normalizedFiles = [...sourceFiles].sort((a, b) => a.localeCompare(b));
    const entryFile = choosePackageEntryFile(dirPath, normalizedFiles, metadata.entry);
    const name = metadata.packageName || path.basename(dirPath);
    return {
      id: path.normalize(dirPath).replace(/\\/g, '/').toLowerCase(),
      name,
      filePath: entryFile,
      dirPath,
      tier,
      status: 'enabled',
      functions: [],
      hasPackageJson: metadata.hasPackageJson,
      sourceFiles: normalizedFiles,
      dependencies: metadata.dependencies,
    };
  } catch {
    return null;
  }
}

/**
 * 扫描单个 Skill 文件并构建 ScannedSkill
 */
function scanSingleSkillFile(
  fullPath: string,
  entryName: string,
  tier: SkillTier
): ScannedSkill | null {
  try {
    const name = path.parse(entryName).name;
    const id = fullPath.replace(/\\/g, '/').toLowerCase();

    // 检查 package.json
    const dirPath = path.dirname(fullPath);
    const metadata = readPackageMetadata(dirPath);

    // 公司 Skill 默认已启用（不可切换），用户 Skill 默认启用
    const status = tier === 'company' ? 'enabled' : 'enabled';

    return {
      id,
      name,
      filePath: fullPath,
      dirPath,
      tier,
      status,
      functions: [], // 函数列表由调用方后续填充（需要解析文件内容）
      hasPackageJson: metadata.hasPackageJson,
      dependencies: metadata.dependencies,
    };
  } catch {
    return null;
  }
}

/**
 * 扫描全部三类 Skill 目录
 * @param envInfo 环境检测结果
 * @returns 全部分类后的 Skill 列表
 */
export function scanAllSkills(envInfo: Pick<EnvironmentInfo, 'pcbenvPath' | 'atmGeneratedPath'> & { companySkillPaths?: string[] }): {
  company: ScannedSkill[];
  user: ScannedSkill[];
  atm: ScannedSkill[];
  all: ScannedSkill[];
} {
  const companyPaths = envInfo.companySkillPaths || [];
  const userPath = envInfo.pcbenvPath ? path.join(envInfo.pcbenvPath, 'skill') : '';
  const atmPath = envInfo.atmGeneratedPath || '';

  // 扫描公司 Skill（多个路径）
  const companySet = new Map<string, ScannedSkill>();
  for (const cp of companyPaths) {
    const skills = scanSkillDirectory(cp, 'company');
    for (const s of skills) {
      if (!companySet.has(s.id)) {
        companySet.set(s.id, s);
      }
    }
  }

  // 扫描用户 Skill（pcbenv/skill/）
  const userSkills = userPath ? scanSkillDirectory(userPath, 'user') : [];

  // 扫描 ATM Skill（atm_generated/，只扫描顶层 .il 文件）
  const atmSkills = atmPath ? scanSkillDirectory(atmPath, 'atm') : [];

  const company = Array.from(companySet.values());
  const all = [...company, ...userSkills, ...atmSkills];

  return {
    company,
    user: userSkills,
    atm: atmSkills,
    all,
  };
}

/**
 * 根据路径判断 Skill 来源层级
 * @param skillFilePath Skill 文件路径
 * @param envInfo 环境信息
 * @returns Skill 来源层级
 */
export function classifySkillByPath(
  skillFilePath: string,
  envInfo: Pick<EnvironmentInfo, 'pcbenvPath' | 'atmGeneratedPath'> & { companySkillPaths?: string[] }
): SkillTier {
  const normalizedPath = path.normalize(skillFilePath).toLowerCase();
  const companyPaths = (envInfo.companySkillPaths || []).map((p) => path.normalize(p).toLowerCase());
  const userPath = envInfo.pcbenvPath ? path.normalize(path.join(envInfo.pcbenvPath, 'skill')).toLowerCase() : '';
  const atmPath = envInfo.atmGeneratedPath ? path.normalize(envInfo.atmGeneratedPath).toLowerCase() : '';

  if (atmPath && normalizedPath.startsWith(atmPath)) {
    return 'atm';
  }

  if (userPath && normalizedPath.startsWith(userPath)) {
    return 'user';
  }

  for (const cp of companyPaths) {
    if (normalizedPath.startsWith(cp)) {
      return 'company';
    }
  }

  // 默认归类为用户 Skill
  return 'user';
}
