import React, { useCallback, useEffect, useState } from 'react';
import type { RawLineContext } from '../types/hotkey';

interface RawLineViewProps {
  filePath: string;
  lineNumber: number;
  isReference?: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

export const RawLineView: React.FC<RawLineViewProps> = ({
  filePath,
  lineNumber,
  isReference,
  onClose,
  onEdit,
}) => {
  const [data, setData] = useState<RawLineContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadRawLine = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await window.atm.readRawLine(filePath, lineNumber, isReference);
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || '读取失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取异常');
    } finally {
      setLoading(false);
    }
  }, [filePath, isReference, lineNumber]);

  useEffect(() => {
    void loadRawLine();
  }, [loadRawLine]);

  const handleCopy = async () => {
    if (!data?.lineContent) {
      return;
    }

    try {
      await navigator.clipboard.writeText(data.lineContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = data.lineContent;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="raw-line-view">
      {loading ? (
        <div className="loading-spinner">加载中...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : data ? (
        <>
          <div className="raw-line-header">
            <span className="raw-line-title">
              原始行 #{lineNumber}
              {isReference ? <span className="raw-line-readonly-badge">只读参考</span> : null}
            </span>

            <div className="raw-line-actions">
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleCopy}
                title="复制原始行"
              >
                {copied ? '已复制' : '复制'}
              </button>

              {!isReference && onEdit ? (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={onEdit}
                  title="编辑此快捷键"
                >
                  编辑
                </button>
              ) : null}

              <button type="button" className="btn btn-sm" onClick={onClose}>
                关闭
              </button>
            </div>
          </div>

          <div className="raw-line-file-path">
            <span className="detail-label">文件</span>
            <code className="detail-value">{filePath}</code>
          </div>

          <div className="raw-line-context">
            {data.contextBefore.map((line, index) => (
              <div key={index} className="raw-line-context-line">
                {line}
              </div>
            ))}

            <div className="raw-line-target-line">
              {lineNumber}
              {'\t'}
              {data.lineContent}
            </div>

            {data.contextAfter.map((line, index) => (
              <div key={index} className="raw-line-context-line">
                {line}
              </div>
            ))}
          </div>

          {!isReference ? (
            <div className="raw-line-footer">
              <span className="raw-line-editable-hint">该来源为用户 env，可继续编辑</span>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

export default RawLineView;
