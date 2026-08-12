/**
 * ATM - DRC 摘要卡片行
 */
import type { DrcSummary } from '../../types/drc';

interface DrcSummaryCardsProps {
  summary: DrcSummary;
}

export default function DrcSummaryCards({ summary }: DrcSummaryCardsProps) {
  const cards = [
    { label: '总数', value: summary.total, tone: 'neutral' },
    { label: '错误', value: summary.errors, tone: 'error' },
    { label: '警告', value: summary.warnings, tone: 'warning' },
    { label: '已解决', value: summary.resolved, tone: 'ok' },
    { label: '已忽略', value: summary.ignored, tone: 'muted' },
  ];
  return (
    <div className="drc-summary-cards">
      {cards.map((card) => (
        <div key={card.label} className={`drc-summary-card drc-summary-card--${card.tone}`}>
          <div className="drc-summary-card-value">{card.value}</div>
          <div className="drc-summary-card-label">{card.label}</div>
        </div>
      ))}
    </div>
  );
}
