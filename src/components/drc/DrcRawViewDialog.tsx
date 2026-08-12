/**
 * ATM - DRC 原始报告回看弹窗
 */
import { useMemo } from 'react';
import { BusinessDialog } from '../../shared/ui';

interface DrcRawViewDialogProps {
  open: boolean;
  text: string;
  highlightLine?: number;
  onClose: () => void;
}

export default function DrcRawViewDialog({
  open,
  text,
  highlightLine,
  onClose,
}: DrcRawViewDialogProps) {
  const lines = useMemo(() => text.split(/\r?\n/), [text]);

  return (
    <BusinessDialog
      open={open}
      title="原始报告"
      description={highlightLine ? `已定位到第 ${highlightLine} 行` : '只读查看导入的原始文本'}
      onClose={onClose}
      size="xl"
      footer={
        <button type="button" className="ui-button" onClick={onClose}>
          关闭
        </button>
      }
      bodyClassName="drc-raw-body"
    >
      <pre className="drc-raw-view">
        {lines.map((line, index) => {
          const lineNumber = index + 1;
          const highlighted = lineNumber === highlightLine;
          return (
            <div key={lineNumber} className={highlighted ? 'drc-raw-line highlighted' : 'drc-raw-line'}>
              <span className="drc-raw-lineno">{lineNumber}</span>
              <span className="drc-raw-text">{line || ' '}</span>
            </div>
          );
        })}
      </pre>
    </BusinessDialog>
  );
}
