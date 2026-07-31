/**
 * ATM - 文件状态卡片组件
 */
import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

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
  const StatusIcon = !exists ? AlertCircle : writable === false ? AlertTriangle : CheckCircle2;

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
    <article className={`ui-file-status ui-file-status--${!exists ? 'error' : writable === false ? 'warning' : 'ok'}`}>
      <div className="ui-file-status-main">
        <div className="ui-file-status-copy">
          <div className="ui-file-status-title">
            <StatusIcon aria-hidden="true" />
            <span>{title}</span>
          </div>
          <div className="path-display" title={path || undefined}>{path || '—'}</div>
        </div>
        <span className={`badge ${getStatusClass()}`}>{getStatusText()}</span>
      </div>
      {exists && (
        <div className="ui-file-status-access">
          <span>可读：{readable === undefined ? '未检查' : readable ? '是' : '否'}</span>
          <span>可写：{writable === undefined ? '未检查' : writable ? '是' : '否'}</span>
        </div>
      )}
    </article>
  );
};

export default FileStatusCard;
