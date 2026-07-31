/**
 * ATM - 统一错误面板组件（V5.4）
 *
 * 用于显示执行失败的详细错误，包含错误原因和建议。
 * 所有失败应显示中文错误信息。
 */
import React from 'react';

interface ErrorPanelProps {
  title?: string;
  message: string;
  detail?: string;
  suggestion?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  compact?: boolean;
}

const ErrorPanel: React.FC<ErrorPanelProps> = ({
  title = '操作失败',
  message,
  detail,
  suggestion,
  onRetry,
  onDismiss,
  compact,
}) => {
  return (
    <div
      style={{
        background: '#2a1515',
        border: '1px solid #5a2020',
        borderRadius: 8,
        padding: compact ? 10 : 14,
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: 16, lineHeight: '20px' }}>❌</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#e88', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
            {title}
          </div>
          <div style={{ color: '#ccc', fontSize: 13, lineHeight: 1.4, marginBottom: detail ? 8 : 0 }}>
            {message}
          </div>
          {detail && (
            <pre
              style={{
                background: '#111',
                color: '#aaa',
                fontSize: 12,
                padding: 8,
                borderRadius: 4,
                margin: '6px 0',
                maxHeight: 200,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {detail}
            </pre>
          )}
          {suggestion && (
            <div style={{ color: '#da7', fontSize: 12, marginTop: 6 }}>
              💡 {suggestion}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {onRetry && (
              <button className="btn btn-sm" onClick={onRetry}>
                重试
              </button>
            )}
            {onDismiss && (
              <button
                className="btn btn-sm"
                onClick={onDismiss}
                style={{ background: '#333', color: '#aaa', border: '1px solid #555' }}
              >
                关闭
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorPanel;
