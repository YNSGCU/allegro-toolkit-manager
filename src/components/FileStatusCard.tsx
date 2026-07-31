/**
 * ATM - 文件状态卡片组件
 */
import React from 'react';

export interface FileStatusCardProps {
  title: string;
  path: string | null;
  exists: boolean;
  readable?: boolean;
  writable?: boolean;
}

const FileStatusCard: React.FC<FileStatusCardProps> = ({
  title,
  path,
  exists,
  readable,
  writable,
}) => {
  const getStatusIcon = () => {
    if (!exists) return <span className="status-dot error" />;
    if (!writable) return <span className="status-dot warning" />;
    return <span className="status-dot ok" />;
  };

  const getStatusText = () => {
    if (!path) return '未检测';
    if (!exists) return '文件不存在';
    if (!readable) return '不可读';
    if (!writable) return '只读';
    return '正常';
  };

  const getStatusClass = () => {
    if (!exists) return 'badge-error';
    if (!writable) return 'badge-warning';
    return 'badge-success';
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            {getStatusIcon()}
            {title}
          </div>
          <div className="path-display">{path || '—'}</div>
        </div>
        <span className={`badge ${getStatusClass()}`}>{getStatusText()}</span>
      </div>
      {exists && (
        <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
          <span>可读: {readable ? '✓' : '✗'}</span>
          <span>可写: {writable ? '✓' : '✗'}</span>
        </div>
      )}
    </div>
  );
};

export default FileStatusCard;
