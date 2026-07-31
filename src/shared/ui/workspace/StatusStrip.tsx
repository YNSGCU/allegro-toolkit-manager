import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Info,
} from 'lucide-react';

export type StatusTone = 'ok' | 'warning' | 'error' | 'info' | 'muted';

export interface StatusStripItem {
  label: string;
  value: string;
  tone: StatusTone;
  tooltip?: string;
}

interface StatusStripProps {
  items: StatusStripItem[];
  label?: string;
}

const icons = {
  ok: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,
  muted: CircleDashed,
};

export default function StatusStrip({ items, label = '当前状态' }: StatusStripProps) {
  return (
    <section className="ui-status-strip" aria-label={label}>
      {items.map((item) => {
        const Icon = icons[item.tone];
        return (
          <div
            key={`${item.label}-${item.value}`}
            className={`ui-status-item ui-status-item--${item.tone}`}
            title={item.tooltip || `${item.label}: ${item.value}`}
          >
            <Icon aria-hidden="true" />
            <span className="ui-status-item-label">{item.label}</span>
            <span className="ui-status-item-value">{item.value}</span>
          </div>
        );
      })}
    </section>
  );
}
