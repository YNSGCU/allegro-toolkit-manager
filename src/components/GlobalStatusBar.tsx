import StatusStrip, { type StatusStripItem } from '../shared/ui/workspace/StatusStrip';

export interface StatusItem {
  label: string;
  value: string;
  status: 'ok' | 'warning' | 'error' | 'muted';
  tooltip?: string;
}

interface GlobalStatusBarProps {
  items: StatusItem[];
  envPath?: string;
  needsRestart?: boolean;
}

export default function GlobalStatusBar({
  items,
  envPath,
  needsRestart,
}: GlobalStatusBarProps) {
  const statusItems: StatusStripItem[] = items.map((item) => ({
    label: item.label,
    value: item.value,
    tone: item.status,
    tooltip: item.tooltip,
  }));

  if (envPath) {
    statusItems.push({
      label: '环境',
      value: envPath,
      tone: 'info',
      tooltip: envPath,
    });
  }

  if (needsRestart !== undefined) {
    statusItems.push({
      label: 'Allegro',
      value: needsRestart ? '需要重启' : '无需重启',
      tone: needsRestart ? 'warning' : 'muted',
    });
  }

  return <StatusStrip items={statusItems} label="工作区状态" />;
}
