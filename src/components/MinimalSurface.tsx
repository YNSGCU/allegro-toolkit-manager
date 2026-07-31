import React from 'react';
import { Link } from 'react-router-dom';

interface MinimalSurfaceCard {
  id: string;
  title: string;
  meta: string;
  to?: string;
}

interface MinimalSurfaceProps {
  title: string;
  subtitle: string;
  prompt: string;
  summaryLine: string[];
  cards: MinimalSurfaceCard[];
  density?: 'default' | 'compact' | 'dense' | 'balanced';
  showCopy?: boolean;
  showPrompt?: boolean;
  summaryPosition?: 'after-prompt' | 'below-copy';
}

const MinimalSurface: React.FC<MinimalSurfaceProps> = ({
  title,
  subtitle,
  prompt,
  summaryLine,
  cards,
  density = 'default',
  showCopy = true,
  showPrompt = true,
  summaryPosition = 'after-prompt',
}) => {
  const densityClass =
    density === 'dense'
      ? 'minimal-surface minimal-surface--dense'
      : density === 'compact'
        ? 'minimal-surface minimal-surface--compact'
        : density === 'balanced'
          ? 'minimal-surface minimal-surface--balanced'
          : 'minimal-surface';

  const summaryNode = (
    <div className="minimal-surface-summary" aria-label="摘要">
      {summaryLine.map((item) => (
        <span key={item} className="minimal-surface-summary-item">
          {item}
        </span>
      ))}
    </div>
  );

  return (
    <section
      className={`${densityClass} ${
        summaryPosition === 'below-copy' ? 'minimal-surface--summary-below-copy' : ''
      } ${
        showCopy ? '' : 'minimal-surface--copy-hidden'
      }`.trim()}
      aria-label={title}
    >
      {showCopy ? (
        <div className="minimal-surface-copy">
          <p className="minimal-surface-kicker">工作入口</p>
          <h1 className="minimal-surface-title">{title}</h1>
          <p className="minimal-surface-subtitle">{subtitle}</p>
        </div>
      ) : null}

      {summaryPosition === 'below-copy' ? summaryNode : null}

      {showPrompt ? (
        <div className="minimal-surface-prompt">
          <p className="minimal-surface-prompt-label">当前提示</p>
          <p className="minimal-surface-prompt-copy">{prompt}</p>
        </div>
      ) : null}

      {summaryPosition === 'after-prompt' ? summaryNode : null}

      <div className="minimal-surface-cards" aria-label="快捷入口">
        {cards.map((card) => {
          const content = (
            <>
              <h2>{card.title}</h2>
              <p>{card.meta}</p>
            </>
          );

          return card.to ? (
            <Link
              key={card.id}
              to={card.to}
              className="minimal-surface-card minimal-surface-card--link"
            >
              {content}
            </Link>
          ) : (
            <article key={card.id} className="minimal-surface-card">
              {content}
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default MinimalSurface;
