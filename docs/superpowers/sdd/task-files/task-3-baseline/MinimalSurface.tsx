import React from 'react';

interface MinimalSurfaceCard {
  id: string;
  title: string;
  meta: string;
}

interface MinimalSurfaceProps {
  title: string;
  subtitle: string;
  prompt: string;
  summaryLine: string[];
  cards: MinimalSurfaceCard[];
}

const MinimalSurface: React.FC<MinimalSurfaceProps> = ({
  title,
  subtitle,
  prompt,
  summaryLine,
  cards,
}) => {
  return (
    <section className="minimal-surface" aria-label={title}>
      <div className="minimal-surface-copy">
        <p className="minimal-surface-kicker">工作入口</p>
        <h1 className="minimal-surface-title">{title}</h1>
        <p className="minimal-surface-subtitle">{subtitle}</p>
      </div>

      <div className="minimal-surface-prompt">
        <p className="minimal-surface-prompt-label">当前提示</p>
        <p className="minimal-surface-prompt-copy">{prompt}</p>
      </div>

      <div className="minimal-surface-summary" aria-label="摘要">
        {summaryLine.map((item) => (
          <span key={item} className="minimal-surface-summary-item">
            {item}
          </span>
        ))}
      </div>

      <div className="minimal-surface-cards" aria-label="快捷入口">
        {cards.map((card) => (
          <article key={card.id} className="minimal-surface-card">
            <h2>{card.title}</h2>
            <p>{card.meta}</p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default MinimalSurface;
