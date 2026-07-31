/**
 * ATM - Env 来源管理弹窗（V3.0 多 env）
 *
 * 显示所有检测到的 env 文件，支持：
 *   - 设为当前编辑 env
 *   - 添加/移除参考 env
 *   - 查看路径、角色、可读写状态、快捷键数量
 */
import React from 'react';
import type { EnvSourceList, EnvSource } from '../types/environment';
import EnvSourceTag from './EnvSourceTag';

interface EnvSourceDialogProps {
  envSources: EnvSourceList;
  onClose: () => void;
  onSetActive: (envId: string) => void;
  onAddReference: () => void;
  onRemoveReference: (envId: string) => void;
  onRefresh: () => void;
}

const ROLE_LABEL: Record<string, string> = {
  user_env: '用户配置',
  install_default_env: '安装默认',
  site_env: '站点配置',
  company_env: '公司配置',
  reference_env: '参考文件',
  unknown: '未知',
};

const EnvSourceDialog: React.FC<EnvSourceDialogProps> = ({
  envSources,
  onClose,
  onSetActive,
  onAddReference,
  onRemoveReference,
  onRefresh,
}) => {
  const { sources, activeEnvId } = envSources;

  const userSources = sources.filter((s) => s.role === 'user_env');
  const referenceSources = sources.filter((s) => s.isReference);
  const otherSources = sources.filter(
    (s) => s.role !== 'user_env' && !s.isReference,
  );

  const renderSourceRow = (src: EnvSource) => {
    const isActive = src.id === activeEnvId;
    return (
      <div
        key={src.id}
        className={`env-source-dialog__row ${isActive ? 'env-source-dialog__row--active' : ''} ${!src.exists ? 'env-source-dialog__row--missing' : ''}`}
      >
        {/* 来源标签 */}
        <div className="env-source-dialog__role">
          <EnvSourceTag
            envRole={src.role}
            envSourcePath={src.path}
            displayName={src.displayName}
          />
        </div>

        {/* 路径 */}
        <code className="env-source-dialog__path" title={src.path}>
          {src.path}
        </code>

        {/* 状态 */}
        <div className="env-source-dialog__status">
          {src.exists ? (
            <>
              {src.readable ? '可读' : '不可读'}
              {src.writable ? '可写' : '只读'}
            </>
          ) : (
            <span style={{ color: 'var(--accent-red)' }}>缺失</span>
          )}
        </div>

        {/* 快捷键数 */}
        <span className="env-source-dialog__count" title="快捷键数量">
          {src.hotkeyCount != null ? `${src.hotkeyCount} 个` : '-'}
        </span>

        {/* 最后修改 */}
        <span className="env-source-dialog__modified">
          {src.lastModified
            ? new Date(src.lastModified).toLocaleDateString('zh-CN')
            : '-'}
        </span>

        {/* 操作 */}
        <div className="env-source-dialog__actions">
          {/* 设为活动（仅可写且非活动的 user_env or 用户想覆盖的） */}
          {!isActive && src.writable && (
            <button
              className="btn btn-sm"
              onClick={() => onSetActive(src.id)}
              title="设为当前编辑 env"
            >
              设为活动
            </button>
          )}

          {/* 移除参考 */}
          {src.isReference && (
            <button
              className="btn btn-sm"
              style={{ color: 'var(--accent-red)' }}
              onClick={() => onRemoveReference(src.id)}
              title="移除参考"
            >
              移除
            </button>
          )}

          {/* 活动标识 */}
          {isActive && (
            <span className="badge badge-success" style={{ fontSize: 10 }}>
              当前编辑
            </span>
          )}

          {/* 只读标识 */}
          {src.exists && !src.writable && !isActive && (
            <span className="badge badge-warning" style={{ fontSize: 10 }}>
              只读
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 800, maxHeight: '80vh', overflowY: 'auto' }}
      >
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: 15 }}>管理 Env 来源</h3>
          <button className="btn btn-sm" onClick={onClose}>关闭</button>
        </div>

        <div className="modal-body" style={{ padding: '12px 0' }}>
          {/* ═══ 用户 env ═══ */}
          {userSources.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div className="env-source-dialog__section-title">用户配置 env</div>
              <div className="env-source-dialog__list">
                {userSources.map(renderSourceRow)}
              </div>
            </div>
          )}

          {/* ═══ 参考 env ═══ */}
          <div style={{ marginBottom: 16 }}>
            <div className="env-source-dialog__section-title">
              参考 env
              <button
                className="btn btn-sm"
                style={{ marginLeft: 8 }}
                onClick={onAddReference}
              >
                ＋ 添加参考
              </button>
            </div>
            {referenceSources.length > 0 ? (
              <div className="env-source-dialog__list">
                {referenceSources.map(renderSourceRow)}
              </div>
            ) : (
              <div className="env-source-dialog__empty">
                暂无参考 env。点击"添加参考"选择其他 env 文件。
              </div>
            )}
          </div>

          {/* ═══ 其他 env（安装默认、站点、公司） ═══ */}
          {otherSources.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div className="env-source-dialog__section-title">自动检测的 env（只读参考）</div>
              <div className="env-source-dialog__list">
                {otherSources.map(renderSourceRow)}
              </div>
            </div>
          )}

          {/* ═══ 层级说明 ═══ */}
          <div className="env-source-dialog__help">
            <p><strong>最终层级规则</strong>（从高到低）：</p>
            <ol style={{ margin: '4px 0 0 16px', fontSize: 12, color: 'var(--text-muted)' }}>
              <li>用户 env（快捷键主要编辑对象）</li>
              <li>参考 env（只读参考，不直接修改）</li>
              <li>安装默认 / 站点 / 公司 env（只读参考）</li>
              <li>allegro 默认/系统保留键（快捷键参考库）</li>
            </ol>
            <p style={{ fontSize: 12, color: 'var(--accent-yellow)', marginTop: 8 }}>
              只有当前可写的用户 env 才能被 Apply Plan 修改。
            </p>
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
          <button className="btn" onClick={onRefresh}>重新扫描</button>
          <button className="btn btn-primary" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
};

export default EnvSourceDialog;
