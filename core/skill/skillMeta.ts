/**
 * ATM - Skill 元数据管理模块
 * Skill 中文备注、自动简介生成、持久化存储
 *
 * 数据存储：atm_data/skill_metadata.json
 * 不修改任何 .il 源文件
 */
import fs from 'fs';
import path from 'path';
import type { SkillFileItem, SkillMeta, ConfidenceLevel } from '../../src/types/skill';

// ════════════════════════════════════════════════════════════
// 持久化
// ════════════════════════════════════════════════════════════

/** 元数据文件路径（相对于 pcbenv） */
function getMetaFilePath(pcbenvPath: string): string {
  const dataDir = path.join(pcbenvPath, 'atm_data');
  return path.join(dataDir, 'skill_metadata.json');
}

/** 确保 atm_data 目录存在 */
function ensureDataDir(pcbenvPath: string): void {
  const dataDir = path.join(pcbenvPath, 'atm_data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

/** 加载所有 Skill 元数据 */
export function loadAllSkillMeta(pcbenvPath: string): Record<string, SkillMeta> {
  try {
    ensureDataDir(pcbenvPath);
    const filePath = getMetaFilePath(pcbenvPath);
    if (!fs.existsSync(filePath)) {
      return {};
    }
    const raw = fs.readFileSync(filePath, { encoding: 'utf-8' });
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const map = parsed as Record<string, SkillMeta>;
      // 迁移：对缺少 originalName 的旧数据，从 filePath 恢复
      let needsSave = false;
      for (const meta of Object.values(map)) {
        if (!meta.originalName && meta.filePath) {
          meta.originalName = extractOriginalName(meta.filePath);
          needsSave = true;
        }
        // 迁移：旧数据 displayName → userName
        if (!meta.userName && meta.displayName) {
          meta.userName = meta.displayName;
          needsSave = true;
        }
      }
      if (needsSave) {
        try {
          fs.writeFileSync(filePath, JSON.stringify(map, null, 2), { encoding: 'utf-8' });
        } catch { /* 静默处理迁移保存失败 */ }
      }
      return map;
    }
    return {};
  } catch {
    return {};
  }
}

/** 保存单个 Skill 元数据 */
export function saveSkillMeta(
  pcbenvPath: string,
  skillId: string,
  meta: Partial<SkillMeta>,
): { success: boolean; error?: string; data?: SkillMeta } {
  try {
    ensureDataDir(pcbenvPath);
    const allMeta = loadAllSkillMeta(pcbenvPath);

    const existing = allMeta[skillId] || {
      skillId,
      filePath: '',
      originalName: '',
      displayName: undefined,
      userName: undefined,
      userNote: undefined,
      autoSummary: undefined,
      autoName: undefined,
      autoCategory: undefined,
      userCategory: undefined,
      tags: [],
      confidence: 'low' as ConfidenceLevel,
      generatedAt: undefined,
      updatedAt: undefined,
    };

    const updatedMeta: SkillMeta = {
      ...existing,
      ...meta,
      skillId,
      updatedAt: new Date().toISOString(),
    };

    // 永远不覆盖 originalName（防止外部传入空值）
    if (!meta.originalName && existing.originalName) {
      updatedMeta.originalName = existing.originalName;
    }

    allMeta[skillId] = updatedMeta;

    const filePath = getMetaFilePath(pcbenvPath);
    fs.writeFileSync(filePath, JSON.stringify(allMeta, null, 2), { encoding: 'utf-8' });

    return { success: true, data: updatedMeta };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `保存元数据失败: ${message}` };
  }
}

/** 批量保存元数据（用于初始化/重新分析全部） */
export function saveAllSkillMeta(
  pcbenvPath: string,
  allMeta: Record<string, SkillMeta>,
): { success: boolean; error?: string } {
  try {
    ensureDataDir(pcbenvPath);
    const filePath = getMetaFilePath(pcbenvPath);

    // 统一更新 updatedAt
    const now = new Date().toISOString();
    for (const meta of Object.values(allMeta)) {
      meta.updatedAt = now;
    }

    fs.writeFileSync(filePath, JSON.stringify(allMeta, null, 2), { encoding: 'utf-8' });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `保存元数据失败: ${message}` };
  }
}

/** 获取单个 Skill 元数据 */
export function getSkillMeta(
  pcbenvPath: string,
  skillId: string,
): SkillMeta | null {
  const allMeta = loadAllSkillMeta(pcbenvPath);
  return allMeta[skillId] || null;
}

// ════════════════════════════════════════════════════════════
// 自动分析引擎（本地规则）
// ════════════════════════════════════════════════════════════

/** 关键词 → 中文标签映射表 */
const KEYWORD_MAP: Array<{ patterns: RegExp[]; tags: string[]; categories: string[] }> = [
  // 吸附 / 坐标 / 定位
  { patterns: [/snap/i, /pick/i, /cursor/i, /point/i, /xy/i, /coord/i], tags: ['吸附', '坐标', '定位'], categories: ['辅助操作', '精准定位'] },
  // 布线
  { patterns: [/route/i, /connect/i, /trace/i, /line/i, /wire/i, /fanout/i], tags: ['布线'], categories: ['布线辅助'] },
  // 过孔 / 焊盘
  { patterns: [/via/i, /pin/i, /pad/i, /net/i], tags: ['Via', '焊盘', '网络'], categories: ['过孔', '网络'] },
  // Shape / 铜皮
  { patterns: [/shape/i, /copper/i, /dynamic/i, /void/i, /thermal/i], tags: ['Shape', '铜皮'], categories: ['Shape', '铜皮'] },
  // 网格
  { patterns: [/grid/i, /snap/i], tags: ['网格', '设置'], categories: ['环境设置'] },
  // 单位
  { patterns: [/unit/i, /mil/i, /mm/i, /metric/i, /imperial/i], tags: ['单位', '切换'], categories: ['环境设置'] },
  // 器件聚拢 / 符号
  { patterns: [/gather/i, /symbol/i, /component/i, /instance/i], tags: ['器件', '符号'], categories: ['器件管理'] },
  // 删除 / 清理
  { patterns: [/delete/i, /remove/i, /clear/i, /clean/i, /purge/i], tags: ['删除', '清理'], categories: ['辅助操作'] },
  // DRC / 检查
  { patterns: [/check/i, /drc/i, /report/i, /audit/i, /verify/i], tags: ['检查', '报告'], categories: ['检查', '报告'] },
  // 裁剪 / 分割
  { patterns: [/cut/i, /trim/i, /split/i, /divide/i, /chop/i], tags: ['裁剪', '分割'], categories: ['Shape', '铜皮'] },
  // 等距 / 分布
  { patterns: [/distribute/i, /align/i, /space/i, /equal/i], tags: ['等距', '分布', '对齐'], categories: ['布线辅助'] },
  // 导出 / 导入
  { patterns: [/export/i, /import/i, /save/i, /load/i, /write/i, /read/i], tags: ['导入', '导出'], categories: ['文件操作'] },
  // 选择 / 高亮
  { patterns: [/select/i, /highlight/i, /pick/i, /choose/i], tags: ['选择', '高亮'], categories: ['辅助操作'] },
  // 属性
  { patterns: [/property/i, /attr/i, /param/i, /option/i, /setting/i], tags: ['属性', '设置'], categories: ['环境设置'] },
  // 层
  { patterns: [/layer/i, /class/i, /subclass/i], tags: ['层', 'Class'], categories: ['层管理'] },
  // 文本
  { patterns: [/text/i, /label/i, /note/i, /string/i], tags: ['文本', '标签'], categories: ['文本处理'] },
  // 颜色
  { patterns: [/color/i, /colour/i, /display/i, /highlight/i], tags: ['颜色', '显示'], categories: ['显示设置'] },
  // 窗口 / 视图
  { patterns: [/window/i, /view/i, /zoom/i, /pan/i], tags: ['窗口', '视图'], categories: ['视图控制'] },
  // 测量
  { patterns: [/measure/i, /dist/i, /length/i, /angle/i], tags: ['测量', '距离'], categories: ['辅助操作'] },
  // 搜索 / 查找
  { patterns: [/find/i, /search/i, /locate/i, /lookup/i], tags: ['搜索', '查找'], categories: ['辅助操作'] },
  // 撤销 / 重做
  { patterns: [/undo/i, /redo/i, /revert/i], tags: ['撤销', '重做'], categories: ['编辑操作'] },
  // 复制 / 粘贴
  { patterns: [/copy/i, /paste/i, /duplicate/i, /clone/i], tags: ['复制', '粘贴'], categories: ['编辑操作'] },
  // 移动
  { patterns: [/move/i, /shift/i, /drag/i, /translate/i], tags: ['移动', '调整'], categories: ['辅助操作'] },
  // 旋转
  { patterns: [/rotate/i, /flip/i, /mirror/i, /spin/i], tags: ['旋转', '翻转'], categories: ['辅助操作'] },
  // 组
  { patterns: [/group/i, /module/i, /block/i, /reuse/i], tags: ['组', '模块'], categories: ['模块化设计'] },
  // 约束 / 规则
  { patterns: [/constraint/i, /rule/i, /cm/i, /cns/i], tags: ['约束', '规则'], categories: ['约束管理'] },
  // 交叉 / 参考
  { patterns: [/cross/i, /xref/i, /ref/i, /reference/i], tags: ['交叉引用'], categories: ['辅助操作'] },
  // 差分对
  { patterns: [/diff/i, /differential/i, /pair/i, /match/i], tags: ['差分对', '匹配'], categories: ['布线辅助'] },
  // 测试点
  { patterns: [/test/i, /probe/i, /point/i, /fp/i], tags: ['测试点'], categories: ['测试'] },
  // 孔 / 钻孔
  { patterns: [/hole/i, /drill/i, /bore/i], tags: ['钻孔', '孔'], categories: ['过孔', '钻孔'] },
  // 飞线
  { patterns: [/rat/i, /ratsnest/i, /unroute/i], tags: ['飞线', 'Rats'], categories: ['布线辅助'] },
  // 总线
  { patterns: [/bus/i, /bundle/i], tags: ['总线'], categories: ['布线辅助'] },
  // 电源 / 地
  { patterns: [/power/i, /ground/i, /gnd/i, /vcc/i, /plane/i], tags: ['电源', '地'], categories: ['电源管理'] },
  // 帮助 / about
  { patterns: [/help/i, /about/i, /info/i, /version/i], tags: ['帮助', '关于'], categories: ['辅助操作'] },
  // 管理 / 工具
  { patterns: [/manager/i, /tool/i, /util/i, /kit/i], tags: ['工具', '管理'], categories: ['工具集'] },
  // Smart 系列
  { patterns: [/smart/i], tags: ['智能'], categories: ['智能工具'] },
  // Allegro 内置
  { patterns: [/allegro/i, /axl/i], tags: ['Allegro'], categories: ['Allegro 内置'] },
];

/** 已知的中文名称 Map（文件名 → 中文名） */
const KNOWN_NAMES: Record<string, string> = {
  'smart-snap': '智能吸附工具',
  'setGrid': '网格设置工具',
  'unit_switch': '单位切换工具',
  'CutShape': 'Shape 裁剪工具',
  'ChangeViaNet': '过孔网络修改工具',
  'distribute_traces': '走线等距分布工具',
  'diff_pair_tune': '差分对调谐工具',
  'auto_router': '自动布线器',
  'batch_drc': '批量 DRC 检查',
  'layer_manager': '层管理器',
  'palette_tool': '调色板工具',
  'text_editor': '文本编辑器',
  'symbol_browser': '符号浏览器',
  'property_editor': '属性编辑器',
  'cross_probe': '交叉探测工具',
  'testpoint_gen': '测试点生成工具',
  'via_array': '过孔阵列工具',
  'bus_router': '总线布线工具',
  'fanout_tool': '扇出工具',
  'plane_split': '电源层分割工具',
  'thermal_relief': '花焊盘设置工具',
  'update_symbols': '更新符号工具',
  'backdrill': '背钻工具',
  'skew_tune': '等长调谐工具',
  'pin_swap': '引脚交换工具',
  'gate_swap': '门交换工具',
};

/** 已知的中文分类 Map（文件名 → 自动分类） */
const KNOWN_CATEGORIES: Record<string, string[]> = {
  'smart-snap': ['辅助操作', '精准定位'],
  'setGrid': ['环境设置'],
  'unit_switch': ['环境设置'],
  'CutShape': ['Shape', '铜皮'],
  'ChangeViaNet': ['过孔', '网络'],
  'distribute_traces': ['布线辅助'],
  'diff_pair_tune': ['布线辅助'],
  'auto_router': ['布线辅助'],
  'batch_drc': ['检查', '报告'],
  'layer_manager': ['层管理'],
  'palette_tool': ['显示设置'],
  'cross_probe': ['辅助操作'],
  'fanout_tool': ['布线辅助'],
  'plane_split': ['电源管理'],
  'thermal_relief': ['Shape', '铜皮'],
  'backdrill': ['过孔', '钻孔'],
  'skew_tune': ['布线辅助'],
  'pin_swap': ['编辑操作'],
  'gate_swap': ['编辑操作'],
};

/** 已知分类的标准中文描述 */
const CATEGORY_DESC: Record<string, string> = {
  '辅助操作': '辅助操作',
  '精准定位': '精准定位',
  '布线辅助': '布线辅助',
  '过孔': '过孔',
  '网络': '网络',
  'Shape': 'Shape',
  '铜皮': '铜皮',
  '环境设置': '环境设置',
  '器件管理': '器件管理',
  '检查': '检查',
  '报告': '报告',
  '文件操作': '文件操作',
  '层管理': '层管理',
  '文本处理': '文本处理',
  '显示设置': '显示设置',
  '视图控制': '视图控制',
  '编辑操作': '编辑操作',
  '模块化设计': '模块化设计',
  '约束管理': '约束管理',
  '测试': '测试',
  '电源管理': '电源管理',
  '工具集': '工具集',
  '智能工具': '智能工具',
  'Allegro 内置': 'Allegro 内置',
};

/**
 * 从文件路径提取原始文件名（不含扩展名）
 * "D:/skill/smart-snap.il" → "smart-snap"
 */
function extractOriginalName(filePath: string): string {
  try {
    const parsed = path.parse(filePath);
    return parsed.name; // 不含扩展名的文件名
  } catch {
    return '';
  }
}

/** 分析单个 Skill 并生成元数据 */
export function analyzeSkillMeta(
  skill: SkillFileItem,
  fileContent?: string,
): Omit<SkillMeta, 'skillId' | 'filePath'> {
  const fileName = path.parse(skill.name).name;
  const fileNameLower = fileName.toLowerCase();
  const filePathLower = skill.path.toLowerCase();
  const originalName = extractOriginalName(skill.path);

  // 收集所有分析线索
  const clues: string[] = [];

  // 1. 文件名
  clues.push(fileName);

  // 2. 函数名
  const funcNames = [
    ...skill.entryCommands.map((c) => c.name),
    ...skill.internalFunctions.map((f) => f.name),
  ];
  clues.push(...funcNames);

  // 3. 快捷键引用命令名
  const hotkeyCommands = skill.hotkeyRefs.map((r) => r.command);
  clues.push(...hotkeyCommands);

  // 4. 菜单引用
  const menuPaths = skill.menuRefs.map((r) => r.path);
  clues.push(...menuPaths);

  // 5. 从文件内容中提取注释（如果有）
  let comments: string[] = [];
  if (fileContent) {
    const commentLines = fileContent.match(/;.*$|;;.*$/gm) || [];
    comments = commentLines
      .map((l) => l.replace(/^;+\s*/, '').trim())
      .filter((l) => l.length > 2 && l.length < 100);
    clues.push(...comments.slice(0, 10));
  }

  // ════════════════════════════════════════════
  // 生成中文名称
  // ════════════════════════════════════════════

  let autoName = KNOWN_NAMES[fileName] || '';

  if (!autoName) {
    // 尝试从文件名推断
    // CamelCase → 中文拆分
    const nameParts = fileName
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    // 从关键词匹配生成名称
    const matchedTags = matchKeywords(clues);
    if (matchedTags.length > 0) {
      autoName = matchedTags.slice(0, 3).join('') + '工具';
    } else {
      // 直接音译/保留部分
      autoName = nameParts.map(capitalize).join(' ') + ' 工具';
    }
  }

  // ════════════════════════════════════════════
  // 生成自动分类
  // ════════════════════════════════════════════

  let autoCategory = '';
  const knownCat = KNOWN_CATEGORIES[fileName];
  if (knownCat) {
    autoCategory = knownCat.join(' / ');
  } else {
    const matchedCategories = findMatchingCategories(clues);
    if (matchedCategories.length > 0) {
      autoCategory = matchedCategories.slice(0, 3).join(' / ');
    } else {
      autoCategory = '辅助操作';
    }
  }

  // ════════════════════════════════════════════
  // 生成自动简介
  // ════════════════════════════════════════════

  let autoSummary = generateSummary(skill, fileName, autoName, autoCategory, comments, clues);

  // ════════════════════════════════════════════
  // 标签
  // ════════════════════════════════════════════

  const tags = generateTags(skill, fileName, autoName, clues);

  // ════════════════════════════════════════════
  // 可信度
  // ════════════════════════════════════════════

  let confidence = computeConfidence(skill, fileName, autoName, tags);

  // ════════════════════════════════════════════
  // 可读性检查
  // ════════════════════════════════════════════

  let isReadable = true;
  try {
    if (fileContent === undefined) {
      isReadable = fs.existsSync(skill.path) && fs.statSync(skill.path).size > 0;
      if (isReadable) {
        const buf = Buffer.alloc(256);
        const fd = fs.openSync(skill.path, 'r');
        fs.readSync(fd, buf, 0, 256, 0);
        fs.closeSync(fd);
        // 检查是否二进制（加密 Skill 文件通常包含非 ASCII 字符）
        const nonAscii = buf.filter((b) => b === 0 || (b > 127 && b < 32)).length;
        if (nonAscii > 10) isReadable = false;
      }
    } else {
      isReadable = fileContent.length > 0 && !fileContent.includes(' ');
    }
  } catch {
    isReadable = false;
  }

  if (!isReadable) {
    autoSummary = '源码不可读，自动简介基于文件名和命令名推断，可信度低。';
    if (!autoName) autoName = fileName + ' 工具';
    if (!autoCategory) autoCategory = '未知';
    confidence = 'low';
  }

  const now = new Date().toISOString();

  return {
    originalName,
    displayName: undefined,
    userName: undefined,
    userNote: undefined,
    userCategory: undefined,
    autoName,
    autoSummary,
    autoCategory,
    tags,
    confidence,
    generatedAt: now,
    updatedAt: now,
  };
}

// ════════════════════════════════════════════════════════════
// 辅助函数
// ════════════════════════════════════════════════════════════

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** 从线索中匹配关键词标签 */
function matchKeywords(clues: string[]): string[] {
  const matchedTags: string[] = [];
  const seen = new Set<string>();

  for (const clue of clues) {
    for (const entry of KEYWORD_MAP) {
      for (const pattern of entry.patterns) {
        if (pattern.test(clue)) {
          for (const tag of entry.tags) {
            if (!seen.has(tag)) {
              seen.add(tag);
              matchedTags.push(tag);
            }
          }
          break;
        }
      }
    }
  }

  return matchedTags;
}

/** 从线索中匹配分类 */
function findMatchingCategories(clues: string[]): string[] {
  const matchedCats: string[] = [];
  const seen = new Set<string>();

  for (const clue of clues) {
    for (const entry of KEYWORD_MAP) {
      for (const pattern of entry.patterns) {
        if (pattern.test(clue)) {
          for (const cat of entry.categories) {
            if (!seen.has(cat)) {
              seen.add(cat);
              matchedCats.push(cat);
            }
          }
          break;
        }
      }
    }
  }

  return matchedCats;
}

/** 生成中文简介 */
function generateSummary(
  skill: SkillFileItem,
  fileName: string,
  autoName: string,
  autoCategory: string,
  comments: string[],
  clues: string[],
): string {
  // 如果有注释，优先使用注释
  const zhComments = comments.filter((c) => /[一-鿿]/.test(c));
  if (zhComments.length > 0) {
    return zhComments[0].length < 100 ? zhComments[0] : zhComments[0].substring(0, 100) + '...';
  }

  // 从关键词生成描述
  const entryNames = skill.entryCommands.map((c) => c.name);
  const internalCount = skill.internalFunctions.length;
  const hotkeyCount = skill.hotkeyRefs.length;

  // 已知 Skill 生成精确描述
  const knownSummaries: Record<string, string> = {
    'smart-snap': '可能用于在 PCB 操作中快速吸附到 PIN、VIA、线段端点等对象，提高点选精度。',
    'setGrid': '可能用于快速切换或设置 Allegro 设计网格。',
    'unit_switch': '可能用于在 mil 和 mm 等单位之间快速切换。',
    'CutShape': '可能用于执行 Shape / 铜皮相关的裁剪、取消或确认操作。',
    'ChangeViaNet': '可能用于修改过孔所属网络或批量处理 VIA 网络。',
    'distribute_traces': '可能用于对多条走线进行等距分布或间距调整。',
    'diff_pair_tune': '可能用于调整差分对走线长度或相位匹配。',
    'auto_router': '可能用于自动或半自动 PCB 布线。',
    'batch_drc': '可能用于批量运行 DRC 检查并生成报告。',
    'layer_manager': '可能用于管理 PCB 层叠结构、颜色和显示状态。',
    'cross_probe': '可能用于在原理图和 PCB 之间交叉探测定位器件。',
    'fanout_tool': '可能用于 BGA 等器件的扇出布线。',
    'plane_split': '可能用于电源层分割和铜皮区域管理。',
    'thermal_relief': '可能用于管理花焊盘/热释放连接方式。',
    'backdrill': '可能用于背钻设置和背钻报告生成。',
    'skew_tune': '可能用于等长布线调谐和绕线。',
    'pin_swap': '可能用于优化器件引脚交换以减少走线交叉。',
    'gate_swap': '可能用于逻辑门交换以优化布线。',
  };

  if (knownSummaries[fileName]) {
    return knownSummaries[fileName];
  }

  // 动态生成
  let summary = `可能用于${autoCategory ? autoCategory.replace('/', '或') : '辅助'}相关的`;

  if (entryNames.length > 0) {
    summary += `操作`;
    if (entryNames.length <= 3) {
      summary += `（${entryNames.join(', ')}）`;
    }
  } else {
    summary += `功能`;
  }

  if (hotkeyCount > 0) {
    summary += `，支持快捷键操作`;
  }

  if (internalCount > 3) {
    summary += `，包含多个辅助函数`;
  }

  summary += '。';

  return summary;
}

/** 生成标签列表 */
function generateTags(
  skill: SkillFileItem,
  fileName: string,
  autoName: string,
  clues: string[],
): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();

  // 从文件名提取标签
  const nameParts = fileName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  for (const part of nameParts) {
    const lower = part.toLowerCase();
    if (lower.length > 1 && !['the', 'for', 'and', 'with', 'tool'].includes(lower)) {
      if (!seen.has(lower)) {
        seen.add(lower);
        tags.push(capitalize(lower));
      }
    }
  }

  // 从关键词匹配添加标签
  for (const clue of clues) {
    for (const entry of KEYWORD_MAP) {
      for (const pattern of entry.patterns) {
        if (pattern.test(clue)) {
          for (const tag of entry.tags) {
            if (!seen.has(tag)) {
              seen.add(tag);
              tags.push(tag);
            }
          }
          break;
        }
      }
    }
  }

  // 限制标签数量，去重
  return tags.slice(0, 8);
}

/** 计算分析可信度 */
function computeConfidence(
  skill: SkillFileItem,
  fileName: string,
  autoName: string,
  tags: string[],
): ConfidenceLevel {
  let score = 0;

  // 1. 已知名称 → high
  if (KNOWN_NAMES[fileName]) {
    score += 30;
  }

  // 2. 有入口命令 → 加分
  if (skill.entryCommands.length > 0) {
    score += 15;
  }

  // 3. 有快捷键引用 → 加分（说明有实际使用）
  if (skill.hotkeyRefs.length > 0) {
    score += 10;
  }

  // 4. 有中文注释 → 高分
  try {
    if (fs.existsSync(skill.path)) {
      const content = fs.readFileSync(skill.path, { encoding: 'utf-8' });
      if (/[一-鿿]/.test(content)) {
        score += 20;
      }
    }
  } catch {
    // 不可读
    score -= 20;
  }

  // 5. 标签数量
  if (tags.length >= 3) {
    score += 10;
  }

  // 6. 文件名是否包含有意义的关键词
  const nameLower = fileName.toLowerCase();
  let hasKeyword = false;
  for (const entry of KEYWORD_MAP) {
    for (const pattern of entry.patterns) {
      if (pattern.test(nameLower)) {
        hasKeyword = true;
        break;
      }
    }
    if (hasKeyword) break;
  }
  if (hasKeyword) {
    score += 15;
  }

  // 7. 内部函数数量（代码复杂度）
  if (skill.internalFunctions.length >= 5) {
    score += 5;
  }

  // 阈值判断
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

/** 批量分析所有 Skill 并合并已有用户备注 */
export function analyzeAllSkills(
  skills: SkillFileItem[],
  pcbenvPath: string,
): Record<string, SkillMeta> {
  const existingMeta = loadAllSkillMeta(pcbenvPath);
  const result: Record<string, SkillMeta> = {};

  for (const skill of skills) {
    const existing = existingMeta[skill.id];
    const newAnalysis = analyzeSkillMeta(skill);

    // 从 filePath 恢复 originalName（防止旧数据没有）
    const fallbackOriginalName = extractOriginalName(skill.path);

    if (existing) {
      // 有旧数据 → 只更新自动分析字段，保留用户手动填写的内容
      result[skill.id] = {
        ...newAnalysis,
        skillId: skill.id,
        filePath: skill.path,
        // 保留 originalName（优先用已有的）
        originalName: existing.originalName || newAnalysis.originalName || fallbackOriginalName,
        // 保留用户手动填写的内容
        displayName: existing.displayName,
        userName: existing.userName,
        userNote: existing.userNote,
        userCategory: existing.userCategory,
        // 保留用户设置的显示模式
        displayMode: existing.displayMode,
        // 更新自动分析字段
        autoName: newAnalysis.autoName,
        autoSummary: newAnalysis.autoSummary,
        autoCategory: newAnalysis.autoCategory,
        tags: newAnalysis.tags,
        confidence: newAnalysis.confidence,
        generatedAt: newAnalysis.generatedAt,
        updatedAt: newAnalysis.updatedAt,
      };
    } else {
      // 全新分析
      result[skill.id] = {
        ...newAnalysis,
        skillId: skill.id,
        filePath: skill.path,
        originalName: newAnalysis.originalName || fallbackOriginalName,
      };
    }
  }

  return result;
}
