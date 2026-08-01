import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  preloadWorkspaceRoute: vi.fn(() => Promise.resolve()),
}));

vi.mock('../src/config/routePageLoaders', () => ({
  preloadWorkspaceRoute: mocks.preloadWorkspaceRoute,
}));

import Layout from '../src/components/Layout';

afterEach(() => {
  cleanup();
  mocks.preloadWorkspaceRoute.mockClear();
});

describe('workspace navigation preload', () => {
  it('preloads a page on pointer intent and keyboard focus', () => {
    render(
      <MemoryRouter initialEntries={['/hotkeys']}>
        <Layout><div>当前页面</div></Layout>
      </MemoryRouter>,
    );

    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Skill' }));
    expect(mocks.preloadWorkspaceRoute).toHaveBeenCalledWith('/skills');

    fireEvent.focus(screen.getByRole('link', { name: '菜单' }));
    expect(mocks.preloadWorkspaceRoute).toHaveBeenCalledWith('/menu');
  });
});
