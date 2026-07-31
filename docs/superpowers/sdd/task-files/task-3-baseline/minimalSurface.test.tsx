import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import MinimalSurface from '../src/components/MinimalSurface';

describe('minimal surface', () => {
  it('renders a single prompt panel and quick entry cards', () => {
    render(
      <MinimalSurface
        title="快捷键工作台"
        subtitle="当前方案、冲突情况和键位编辑都收在这里。"
        prompt="当前方案：自由，继续编辑或直接应用。"
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
        prompt="当前方案：自由，继续编辑或直接应用。"
        summaryLine={['36 条快捷键', '0 冲突', '用户层 env']}
        cards={[
          { id: 'overview', title: '快速进入键盘总览', meta: '默认入口' },
        ]}
      />,
    );

    expect(screen.getAllByText('工作入口').length).toBeGreaterThan(0);
    expect(screen.getAllByText('当前提示').length).toBeGreaterThan(0);
    expect(screen.queryByText('Prompt-first workspace')).not.toBeInTheDocument();
    expect(screen.queryByText('Next move')).not.toBeInTheDocument();
  });
});
