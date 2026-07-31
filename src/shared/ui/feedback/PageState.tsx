import type { ReactNode } from 'react';
import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react';

interface PageStateProps {
  kind: 'loading' | 'empty' | 'error';
  title: string;
  description?: string;
  action?: ReactNode;
}

const icons = {
  loading: LoaderCircle,
  empty: Inbox,
  error: AlertCircle,
};

export default function PageState({ kind, title, description, action }: PageStateProps) {
  const Icon = icons[kind];
  const liveProps = kind === 'error'
    ? { role: 'alert' as const }
    : { 'aria-live': 'polite' as const };

  return (
    <section className={`ui-page-state ui-page-state--${kind}`} {...liveProps}>
      <div className="ui-page-state-content">
        <Icon
          className={`ui-page-state-icon${kind === 'loading' ? ' is-spinning' : ''}`}
          aria-hidden="true"
        />
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
        {action ? <div className="ui-page-state-action">{action}</div> : null}
      </div>
    </section>
  );
}
