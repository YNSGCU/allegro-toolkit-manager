/**
 * ATM - Skill 管理 IPC 处理器（V5.4 拆分版）
 *
 * 为了更好的可维护性，此文件已被拆分为以下子模块：
 *   - skill.scan.ipc.ts   → 扫描、解析、加载检查、增强扫描
 *   - skill.apply.ipc.ts   → Toggle、Apply Plan、影响分析、导出
 *   - skill.refs.ipc.ts    → 引用验证、增强引用检查、失效引用
 *   - skill.usage.ipc.ts   → 使用状态、健康度、关系树、配置文件、README
 *   - skillMeta.ipc.ts     → 元数据管理（V5.0，独立）
 *
 * 本文件保留仅做向后兼容，所有 handler 已在各自的子模块中注册。
 * 如需修改 handler 逻辑，请找到对应的子模块文件进行修改。
 */
export { registerSkillScanIpc } from './skill.scan.ipc';
export { registerSkillApplyIpc } from './skill.apply.ipc';
export { registerSkillRefsIpc } from './skill.refs.ipc';
export { registerSkillUsageIpc } from './skill.usage.ipc';
