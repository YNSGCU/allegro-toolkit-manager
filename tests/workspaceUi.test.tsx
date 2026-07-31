import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PageState, StatusStrip, WorkspaceHeader, WorkspacePage } from '../src/shared/ui';

afterEach(cleanup);

describe('workspace UI foundations', () => {
  it('renders one page heading and a dedicated action area', () => {
    render(
      <WorkspacePage>
        <WorkspaceHeader
          eyebrow="能力管理"
          title="Skill 管理"
          description="扫描、检查并安全应用配置。"
          actions={<button type="button">重新扫描</button>}
        />
      </WorkspacePage>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Skill 管理' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新扫描' })).toBeInTheDocument();
  });

  it('communicates status with text and semantic icons', () => {
    const { container } = render(
      <StatusStrip
        items={[
          { label: '引用检查', value: '尚未检查', tone: 'muted' },
          { label: '加载状态', value: '正常', tone: 'ok' },
        ]}
      />,
    );

    expect(screen.getByLabelText('当前状态')).toHaveTextContent('引用检查');
    expect(screen.getByText('尚未检查')).toBeInTheDocument();
    expect(container.querySelectorAll('svg')).toHaveLength(2);
  });

  it('announces recoverable errors', () => {
    render(
      <PageState
        kind="error"
        title="加载失败"
        description="请检查环境后重试。"
        action={<button type="button">重试</button>}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('加载失败');
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });
});
