/** 统一的内联错误面板。 */
import React from 'react';
import { AlertCircle, Lightbulb } from 'lucide-react';

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
  title = '操作失败', message, detail, suggestion, onRetry, onDismiss, compact,
}) => (
  <section className={`ui-error-panel${compact ? ' ui-error-panel--compact' : ''}`} role="alert">
    <AlertCircle className="ui-error-panel-icon" aria-hidden="true" />
    <div className="ui-error-panel-content">
      <h3>{title}</h3>
      <p>{message}</p>
      {detail ? <pre>{detail}</pre> : null}
      {suggestion ? (
        <div className="ui-error-panel-suggestion"><Lightbulb aria-hidden="true" /><span>{suggestion}</span></div>
      ) : null}
      {onRetry || onDismiss ? (
        <div className="ui-error-panel-actions">
          {onRetry ? <button className="btn btn-sm btn-primary" onClick={onRetry}>重试</button> : null}
          {onDismiss ? <button className="btn btn-sm" onClick={onDismiss}>关闭</button> : null}
        </div>
      ) : null}
    </div>
  </section>
);

export default ErrorPanel;
