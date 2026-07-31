/**
 * ATM - Skill 加载状态检查模块
 *
 * 检查 Skill 命令引用的函数是否在 Allegro 环境中实际加载。
 * 通过扫描 allegro.ilinit、generated_skill_loader.il、env、bootstrap.il
 * 等加载源，判断每个 Skill 是否已配置加载。
 */
import fs from 'fs';
import path from 'path';
import type { EnvironmentInfo } from '../../src/types/environment';

// ════════════════════════════════════════════════════════════
// 类型定义
// ════════════════════════════════════════════════════════════

export type LoadStatusValue = 'loaded_configured' | 'maybe_unloaded' | 'unknown' | 'readonly_reference';

export interface SkillLoadResult {
  skillName: string;
  status: LoadStatusValue;
  sources: string[];
  detail: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface LoadSource {
  sourceType: 'ilinit' | 'skill_loader' | 'env' | 'bootstrap' | 'skill_manager';
  filePath: string;
  loadStatements: string[];
  exists: boolean;
}

// ════════════════════════════════════════════════════════════
// 文件解析
// ════════════════════════════════════════════════════════════

/**
 * 读取文件并提取所有 load("filename") 或 load(filename) 语句。
 *
 * 支持格式：
 *   - load("my_skill")       → my_skill
 *   - load("my_skill.il")    → my_skill
 *   - load(my_skill)         → my_skill
 *
 * @param filePath 要扫描的文件路径
 * @returns 加载的 Skill 名称列表（不含 .il 扩展名，去重）
 */
export function checkLoadStatementsInFile(
  filePath: string,
  visited = new Set<string>(),
  depth = 0,
): string[] {
  try {
    const normalizedFilePath = path.normalize(filePath);
    const visitKey = normalizedFilePath.toLowerCase();
    if (!fs.existsSync(normalizedFilePath) || visited.has(visitKey) || depth > 32) return [];
    visited.add(visitKey);

    const content = fs.readFileSync(normalizedFilePath, 'utf-8');
    const loaded: string[] = [];
    const seen = new Set<string>();
    const nestedFiles = new Set<string>();

    const recordReference = (rawReference: string) => {
      const raw = rawReference.trim();
      const basename = path.basename(raw.replace(/\\/g, '/'));
      const name = basename.replace(/\.(?:il|ile|cls)$/i, '');
      if (name && !seen.has(name)) {
        seen.add(name);
        loaded.push(name);
      }

      const candidate = path.isAbsolute(raw)
        ? path.normalize(raw)
        : path.resolve(path.dirname(normalizedFilePath), raw);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) nestedFiles.add(candidate);
    };

    // 允许 load("file.ile" "context") 等带额外参数的形式。
    const quotedRegex = /load\s*\(\s*["']([^"']+)["'][^)]*\)/gi;
    let match: RegExpExecArray | null;
    while ((match = quotedRegex.exec(content)) !== null) recordReference(match[1]);

    // 包内常见形式：load(strcat(root "/module.il"))。
    const strcatRegex = /load\s*\(\s*strcat\s*\([^)]*["']([^"']+\.(?:il|ile|cls))["'][^)]*\)\s*\)/gi;
    while ((match = strcatRegex.exec(content)) !== null) {
      recordReference(match[1].replace(/^[/\\]+/, ''));
    }

    const bareRegex = /load\s*\(\s*([a-zA-Z_][a-zA-Z0-9_\-]*)\s*\)/gi;
    while ((match = bareRegex.exec(content)) !== null) recordReference(match[1]);

    for (const nestedFile of nestedFiles) {
      for (const nestedName of checkLoadStatementsInFile(nestedFile, visited, depth + 1)) {
        if (!seen.has(nestedName)) {
          seen.add(nestedName);
          loaded.push(nestedName);
        }
      }
    }
    return loaded;
  } catch {
    return [];
  }
}

// ════════════════════════════════════════════════════════════
// 加载源扫描
// ════════════════════════════════════════════════════════════

/**
 * 加载源的可读名称映射
 */
const SOURCE_TYPE_LABELS: Record<string, string> = {
  ilinit: 'allegro.ilinit',
  skill_loader: 'generated_skill_loader.il',
  env: 'env:load',
  bootstrap: 'bootstrap.il',
  skill_manager: 'skill_manager',
};

/**
 * 扫描所有可能的 Skill 加载源位置，提取其中的 load 语句。
 *
 * 扫描位置：
 *   1. allegro.ilinit           — 用户 Allegro 初始化文件
 *   2. generated_skill_loader.il — ATM 生成的 Skill 加载器
 *   3. env                      — 用户环境文件（可能含有 load 语句）
 *   4. bootstrap.il             — ATM 引导文件
 *   5. skill/package.json       — Skill 管理器依赖声明
 *
 * @param envInfo 环境信息
 * @returns 加载源列表
 */
export function scanLoadSources(envInfo: EnvironmentInfo): LoadSource[] {
  const sources: LoadSource[] = [];

  // 1. allegro.ilinit
  if (envInfo.ilinitFilePath) {
    const exists = fs.existsSync(envInfo.ilinitFilePath);
    sources.push({
      sourceType: 'ilinit',
      filePath: envInfo.ilinitFilePath,
      loadStatements: exists ? checkLoadStatementsInFile(envInfo.ilinitFilePath) : [],
      exists,
    });
  }

  // 2. ATM generated skill loader
  if (envInfo.atmGeneratedPath) {
    const loaderPath = path.join(envInfo.atmGeneratedPath, 'generated_skill_loader.il');
    const exists = fs.existsSync(loaderPath);
    sources.push({
      sourceType: 'skill_loader',
      filePath: loaderPath,
      loadStatements: exists ? checkLoadStatementsInFile(loaderPath) : [],
      exists,
    });
  }

  // 3. User env file (may also contain load statements)
  if (envInfo.envFilePath) {
    const exists = fs.existsSync(envInfo.envFilePath);
    sources.push({
      sourceType: 'env',
      filePath: envInfo.envFilePath,
      loadStatements: exists ? checkLoadStatementsInFile(envInfo.envFilePath) : [],
      exists,
    });
  }

  // 4. ATM bootstrap file
  if (envInfo.atmGeneratedPath) {
    const bootstrapPath = path.join(envInfo.atmGeneratedPath, 'bootstrap.il');
    const exists = fs.existsSync(bootstrapPath);
    sources.push({
      sourceType: 'bootstrap',
      filePath: bootstrapPath,
      loadStatements: exists ? checkLoadStatementsInFile(bootstrapPath) : [],
      exists,
    });
  }

  // 5. Skill manager — package.json in user skill dir
  if (envInfo.pcbenvPath) {
    const userSkillDir = path.join(envInfo.pcbenvPath, 'skill');
    const packageJsonPath = path.join(userSkillDir, 'package.json');
    const exists = fs.existsSync(packageJsonPath);
    sources.push({
      sourceType: 'skill_manager',
      filePath: packageJsonPath,
      loadStatements: exists ? checkLoadStatementsInFile(packageJsonPath) : [],
      exists,
    });
  }

  return sources;
}

// ════════════════════════════════════════════════════════════
// 加载状态检测
// ════════════════════════════════════════════════════════════

/**
 * 检查单个 Skill 的加载状态。
 *
 * 判断逻辑（优先级从高到低）：
 *   a. 在 skillRegistry 中找到 & tier === 'company'     → readonly_reference
 *   b. 在 skillRegistry 中找到 & enabled === true        → loaded_configured
 *   c. 在 skillRegistry 中找到 & enabled === false       → maybe_unloaded
 *   d. 出现在任何加载源的 load 语句中                     → loaded_configured
 *   e. 出现在任何加载源的 load 语句中（模糊匹配）         → loaded_configured (medium)
 *   f. 未在任何位置找到                                   → maybe_unloaded
 *
 * @param skillName    要检查的 Skill 名称
 * @param loadSources  预先扫描好的加载源列表
 * @param skillRegistry 命令注册中心（含 enabled/tier 状态）
 * @returns 加载状态结果
 */
export function checkSkillLoad(
  skillName: string,
  loadSources: LoadSource[],
  skillRegistry: any,
): SkillLoadResult {
  // ── 第 1 步：检查 skillRegistry ──────────────────────
  let registryEnabled: boolean | null = null;
  let registryTier: string | null = null;

  if (skillRegistry && typeof skillRegistry.commands === 'object') {
    const commands: Record<string, { source: string; tier: string; enabled: boolean }[]> =
      skillRegistry.commands;

    for (const entries of Object.values(commands)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        // 匹配 source 字段（可能是 Skill 名称或文件路径）
        const sourceMatch =
          entry.source === skillName ||
          entry.source === skillName + '.il' ||
          entry.source.endsWith('/' + skillName) ||
          entry.source.endsWith('\\' + skillName) ||
          entry.source.endsWith('/' + skillName + '.il') ||
          entry.source.endsWith('\\' + skillName + '.il') ||
          entry.source.includes(skillName);

        if (sourceMatch) {
          // 优先取 enabled=true 的结果
          if (registryEnabled === null || entry.enabled) {
            registryEnabled = entry.enabled;
            registryTier = entry.tier;
          }
        }
      }
    }
  }

  // ── 第 2 步：检查加载源中的 load 语句 ────────────────
  const matchingSources: string[] = [];
  const skillNameLower = skillName.toLowerCase();

  for (const source of loadSources) {
    const label = SOURCE_TYPE_LABELS[source.sourceType] || source.sourceType;
    const found = source.loadStatements.some(
      (stmt) => stmt.toLowerCase() === skillNameLower,
    );
    if (found && !matchingSources.includes(label)) {
      matchingSources.push(label);
    }
  }

  // ── 第 3 步：综合判定 ────────────────────────────────

  // 公司只读 Skill
  if (registryTier === 'company') {
    return {
      skillName,
      status: 'readonly_reference',
      sources: matchingSources,
      detail: `Skill "${skillName}" 是公司只读 Skill，加载状态由管理员统一管理`,
      confidence: 'medium',
    };
  }

  // Skill 管理器中已启用
  if (registryEnabled === true) {
    const srcList = matchingSources.length > 0 ? matchingSources.join('、') : 'Skill 管理器';
    return {
      skillName,
      status: 'loaded_configured',
      sources: matchingSources.length > 0 ? matchingSources : ['skill_manager'],
      detail: `Skill "${skillName}" 已在 Skill 管理器中启用，通过 ${srcList} 加载`,
      confidence: 'high',
    };
  }

  // Skill 管理器中已禁用
  if (registryEnabled === false) {
    return {
      skillName,
      status: 'maybe_unloaded',
      sources: matchingSources,
      detail: `Skill "${skillName}" 在 Skill 管理器中已禁用，虽然加载源 ${matchingSources.length > 0 ? '可能仍有引用' : '中未找到'}`, // prettier-ignore
      confidence: 'high',
    };
  }

  // 在 load 语句中找到精确匹配
  if (matchingSources.length > 0) {
    return {
      skillName,
      status: 'loaded_configured',
      sources: matchingSources,
      detail: `Skill "${skillName}" 已在 ${matchingSources.join('、')} 中配置加载`,
      confidence: 'high',
    };
  }

  // 在 load 语句中模糊匹配（文件名包含 skillName）
  for (const source of loadSources) {
    const label = SOURCE_TYPE_LABELS[source.sourceType] || source.sourceType;
    const fuzzyMatch = source.loadStatements.some(
      (stmt) => stmt.toLowerCase().includes(skillNameLower),
    );
    if (fuzzyMatch) {
      return {
        skillName,
        status: 'loaded_configured',
        sources: [`${label}（模糊匹配）`],
        detail: `Skill "${skillName}" 可能在 ${label} 中加载（模糊匹配 "${fuzzyMatch}"）`,
        confidence: 'medium',
      };
    }
  }

  // 未在任何位置找到
  return {
    skillName,
    status: 'maybe_unloaded',
    sources: [],
    detail: `Skill "${skillName}" 未在任何加载源中找到配置，可能尚未加载到 Allegro 环境`,
    confidence: 'low',
  };
}

/**
 * 批量检查所有指定 Skill 的加载状态。
 *
 * @param skillNames   要检查的 Skill 名称数组
 * @param envInfo      环境信息（用于定位加载源文件）
 * @param skillRegistry 命令注册中心（可选，用于获取启用/禁用状态）
 * @returns Skill 名称 → SkillLoadResult 的映射
 */
export async function checkAllSkillLoadStatuses(
  skillNames: string[],
  envInfo: EnvironmentInfo,
  skillRegistry: any,
): Promise<Record<string, SkillLoadResult>> {
  const loadSources = scanLoadSources(envInfo);
  const results: Record<string, SkillLoadResult> = {};

  for (const skillName of skillNames) {
    results[skillName] = checkSkillLoad(skillName, loadSources, skillRegistry);
  }

  return results;
}

// ════════════════════════════════════════════════════════════
// 显示工具
// ════════════════════════════════════════════════════════════

/**
 * 根据加载状态返回显示信息。
 *
 * @param status 加载状态值
 * @returns 包含中文标签、CSS 类名和图标的显示信息
 */
export function getLoadStatusDisplay(status: LoadStatusValue): {
  label: string;
  cssClass: string;
  icon: string;
} {
  switch (status) {
    case 'loaded_configured':
      return { label: '已配置加载', cssClass: 'status-loaded', icon: '✓' };
    case 'maybe_unloaded':
      return { label: '可能未加载', cssClass: 'status-warning', icon: '⚠️' };
    case 'unknown':
      return { label: '未知', cssClass: 'status-unknown', icon: '?' };
    case 'readonly_reference':
      return { label: '参考来源，无法确认', cssClass: 'status-reference', icon: 'ℹ️' };
  }
}
