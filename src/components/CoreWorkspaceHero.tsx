import React from 'react';

type HeroMetricTone = 'default' | 'accent' | 'warning';

interface HeroMetric {
  label: string;
  value: string;
  tone?: HeroMetricTone;
}

interface CoreWorkspaceHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  metrics: HeroMetric[];
  actions?: React.ReactNode;
}

const CoreWorkspaceHero: React.FC<CoreWorkspaceHeroProps> = ({
  eyebrow,
  title,
  description,
  metrics,
  actions,
}) => {
  return (
    <section className="workspace-hero">
      <div className="workspace-hero-copy">
        <div className="workspace-hero-eyebrow">{eyebrow}</div>
        <h2 className="workspace-hero-title">{title}</h2>
        <p className="workspace-hero-description">{description}</p>
      </div>

      <div className="workspace-hero-side">
        {actions && <div className="workspace-hero-actions">{actions}</div>}

        <div className="workspace-hero-metrics">
          {metrics.map((metric) => (
            <div
              key={`${metric.label}-${metric.value}`}
              className={`workspace-hero-metric${
                metric.tone ? ` ${metric.tone}` : ''
              }`}
            >
              <span className="workspace-hero-value">{metric.value}</span>
              <span className="workspace-hero-label">{metric.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CoreWorkspaceHero;
