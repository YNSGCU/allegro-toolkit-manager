import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import KeyboardVisualizer from '../src/components/KeyboardVisualizer';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('KeyboardVisualizer skill source hover', () => {
  it('shows the skill name in the hover source text for direct skill bindings', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class ResizeObserver {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );

    render(
      <KeyboardVisualizer
        bindings={[]}
        reservedBindings={[
          {
            id: 'skill-direct-zsq-1',
            key: '1',
            command: 'zsqlayer_etchlayerall',
            type: 'funckey',
            bindingSource: 'skill_direct',
            commandSource: 'user_skill',
            skillName: 'zsqLayer',
            status: 'reserved',
            editable: false,
          },
        ]}
        conflicts={[]}
        selectedKey={null}
        onSelectKey={() => {}}
        viewMode="my"
      />,
    );

    const oneKey = screen
      .getAllByText('1')
      .find((element) => element.classList.contains('keycap-label'))
      ?.closest('.keycap');

    expect(oneKey).not.toBeNull();

    fireEvent.mouseEnter(oneKey!);

    expect(screen.getByText('zsqLayer')).toBeInTheDocument();
    expect(screen.getByText('来源: Skill 直接注册 · zsqLayer')).toBeInTheDocument();
  });
});
