/**
 * ATM - 公司 Skill 目录管理组件
 * 支持手动添加只读 Skill 目录、移除、重新扫描
 */
import React, { useState } from 'react';
import type { ReadonlySkillDirectory, SkillFileItem } from '../types/skill';

interface CompanySkillManagerProps {
  directories: ReadonlySkillDirectory[];
  skills: SkillFileItem[];
  onAddDirectory: () => void;
  onRemoveDirectory: (dirId: string) => void;
  onRescanDirectory: (dirId: string) => void;
  onOpenDirectory: (dirPath: string) => void;
  onRefresh: () => void;
  scanning?: boolean;
}

const CompanySkillManager: React.FC<CompanySkillManagerProps> = ({
  directories,
  skills,
  onAddDirectory,
  onRemoveDirectory,
  onRescanDirectory,
  onOpenDirectory,
  onRefresh,
  scanning = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  const companySkills = skills.filter((s) => s.tier === 'company');

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div
        className="card-header"
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🏢 公司 Skill（只读）— {companySkills.length} 个 Skill</span>
          {directories.length > 0 && (
            <span className="badge badge-info" style={{ fontSize: 10 }}>{directories.length} 个目录</span>
          )}
        </div>
        <span>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ padding: '8px 0' }}>
          {/* 环境变量提示 */}
          {directories.length === 0 && (
            <div className="empty-state" style={{ padding: 12, fontSize: 12 }}>
              <p>未配置公司 Skill 目录</p>
              <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                可通过环境变量 CDS_SITE 和 SKILL_PATH 自动发现，或手动添加只读目录
              </p>
            </div>
          )}

          {/* 手动添加目录 */}
          <div style={{ marginBottom: 12 }}>
            <button className="btn btn-sm" onClick={onAddDirectory} disabled={scanning}>
              {scanning ? '🔄 扫描中...' : '📂 添加只读 Skill 目录'}
            </button>
            <button className="btn btn-sm" onClick={onRefresh} disabled={scanning} style={{ marginLeft: 8 }}>
              🔄 重新扫描全部
            </button>
          </div>

          {/* 目录列表 */}
          {directories.length > 0 && (
            <div className="company-dir-list" style={{ marginBottom: 12 }}>
              <div className="skill-detail-section-title" style={{ fontSize: 12 }}>已配置的目录</div>
              {directories.map((dir) => (
                <div key={dir.id} className="company-dir-row">
                  <div className="company-dir-info">
                    <span className="company-dir-path" title={dir.path}>{dir.path}</span>
                    <span className="badge badge-info" style={{ fontSize: 10 }}>
                      {dir.sourceType === 'company_skill' ? '公司' : dir.sourceType === 'readonly_skill' ? '只读' : '参考'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {dir.skillCount} 个 Skill
                    </span>
                  </div>
                  <div className="company-dir-actions">
                    <button className="btn btn-sm" onClick={() => onRescanDirectory(dir.id)} title="重新扫描">
                      🔄
                    </button>
                    <button className="btn btn-sm" onClick={() => onOpenDirectory(dir.path)} title="打开目录">
                      📁
                    </button>
                    <button className="btn btn-sm atm-btn-danger" onClick={() => onRemoveDirectory(dir.id)} title="移除">
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 公司 Skill 列表 */}
          {companySkills.length > 0 && (
            <div>
              <div className="skill-detail-section-title" style={{ fontSize: 12 }}>已发现的 Skill</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {companySkills.slice(0, 10).map((skill) => (
                  <div key={skill.id} className="company-skill-row">
                    <code style={{ fontSize: 12, color: 'var(--accent-purple)' }}>{skill.name}</code>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }} title={skill.path}>
                      {skill.path}
                    </span>
                    <span className="badge badge-success" style={{ fontSize: 10, marginLeft: 'auto' }}>
                      {skill.entryCommands.length} 个命令
                    </span>
                  </div>
                ))}
                {companySkills.length > 10 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: 4 }}>
                    ... 还有 {companySkills.length - 10} 个
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CompanySkillManager;
