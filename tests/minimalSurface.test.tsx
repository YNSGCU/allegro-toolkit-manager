import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MinimalSurface from '../src/components/MinimalSurface';

afterEach(() => {
  cleanup();
});

describe('minimal surface', () => {
  it('renders a single prompt panel and quick entry cards', () => {
    render(
      <MinimalSurface
        title="快捷键工作台"
        subtitle="当前方案、冲突情况和键位编辑都收在这里。"
        prompt="当前方案：自用，继续编辑或直接应用。"
        summaryLine={['36 条快捷键', '0 冲突', '用户层 env']}
        cards={[
          { id: 'overview', title: '快速进入键盘总览', meta: '默认入口' },
          { id: 'conflicts', title: '处理冲突与保留键', meta: '0 个待处理' },
        ]}
      />,
    );

    expect(screen.getByText('快捷键工作台')).toBeInTheDocument();
    expect(screen.getByText('快速进入键盘总览')).toBeInTheDocument();
    expect(screen.getByText('36 条快捷键')).toBeInTheDocument();
  });

  it('uses Chinese helper labels instead of English surface copy', () => {
    render(
      <MinimalSurface
        title="快捷键工作台"
        subtitle="当前方案、冲突情况和键位编辑都收在这里。"
        prompt="当前方案：自用，继续编辑或直接应用。"
        summaryLine={['36 条快捷键', '0 冲突', '用户层 env']}
        cards={[{ id: 'overview', title: '快速进入键盘总览', meta: '默认入口' }]}
      />,
    );

    expect(screen.getAllByText('工作入口').length).toBeGreaterThan(0);
    expect(screen.getAllByText('当前提示').length).toBeGreaterThan(0);
    expect(screen.queryByText('Prompt-first workspace')).not.toBeInTheDocument();
    expect(screen.queryByText('Next move')).not.toBeInTheDocument();
  });

  it('renders linked cards when quick entries provide routes', () => {
    render(
      <MemoryRouter>
        <MinimalSurface
          title="快捷键工作台"
          subtitle="当前方案、冲突情况和键位编辑都收在这里。"
          prompt="当前方案：自用，继续编辑或直接应用。"
          summaryLine={['36 条快捷键', '0 冲突', '用户层 env']}
          cards={[
            { id: 'editor', title: '编辑键位', meta: '进入主编辑工作区', to: '/hotkeys/editor' },
            { id: 'conflicts', title: '处理冲突', meta: '集中处理覆盖与冲突', to: '/hotkeys/conflicts' },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /编辑键位/ })).toHaveAttribute('href', '/hotkeys/editor');
    expect(screen.getByRole('link', { name: /处理冲突/ })).toHaveAttribute('href', '/hotkeys/conflicts');
  });

  it('supports a balanced density for workspace pages that need readable above-the-fold space', () => {
    render(
      <MinimalSurface
        title="Comfort Surface"
        subtitle="Comfort subtitle"
        prompt="Comfort prompt"
        summaryLine={['one', 'two']}
        cards={[{ id: 'editor', title: 'Edit', meta: 'Open editor' }]}
        density="balanced"
      />,
    );

    expect(screen.getByLabelText('Comfort Surface')).toHaveClass('minimal-surface--balanced');
  });

  it('can hide the prompt block and move summary chips directly under the title area', () => {
    const { container } = render(
      <MinimalSurface
        title="Header Summary"
        subtitle="Subtitle"
        prompt="This prompt should be hidden"
        summaryLine={['36 items', '0 issues', 'Applied']}
        cards={[{ id: 'editor', title: 'Edit', meta: 'Open editor' }]}
        showPrompt={false}
        summaryPosition="below-copy"
      />,
    );

    expect(container.querySelector('.minimal-surface-prompt')).toBeNull();
    const copy = container.querySelector('.minimal-surface-copy');
    const summary = container.querySelector('.minimal-surface-summary');
    expect(copy?.nextElementSibling).toBe(summary);
    expect(screen.getByText('36 items')).toBeInTheDocument();
  });

  it('can hide the copy block while keeping summary chips and quick entry cards', () => {
    const { container } = render(
      <MinimalSurface
        title="Hidden Copy"
        subtitle="This subtitle should not render"
        prompt="Prompt"
        summaryLine={['97 items', '0 issues']}
        cards={[{ id: 'editor', title: 'Edit', meta: 'Open editor' }]}
        showCopy={false}
        showPrompt={false}
        summaryPosition="below-copy"
      />,
    );

    expect(container.querySelector('.minimal-surface-copy')).toBeNull();
    expect(screen.queryByText('Hidden Copy')).not.toBeInTheDocument();
    expect(screen.getByText('97 items')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });
});
