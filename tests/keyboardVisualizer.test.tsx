import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import KeyboardVisualizer from '../src/components/KeyboardVisualizer';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('keyboard visualizer scaling', () => {
  it('reserves an overflow-safe area for edge binding badges', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class ResizeObserver {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );

    const { container } = render(
      <KeyboardVisualizer
        bindings={[]}
        conflicts={[]}
        selectedKey={null}
        onSelectKey={() => {}}
      />,
    );

    expect(container.querySelector('.keyboard-board')).toHaveClass('keyboard-board--overflow-safe');
  });

  it('uses the measured keyboard height instead of a guessed constant when fitting vertically', async () => {
    const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');

    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        if ((this as HTMLElement).classList?.contains('keyboard-wrapper')) {
          return 900;
        }
        return 0;
      },
    });

    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() {
        if ((this as HTMLElement).classList?.contains('keyboard-wrapper')) {
          return 332;
        }
        return 0;
      },
    });

    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() {
        if ((this as HTMLElement).classList?.contains('keyboard-board')) {
          return 360;
        }
        return 0;
      },
    });

    vi.stubGlobal(
      'ResizeObserver',
      class ResizeObserver {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );

    const { container } = render(
      <KeyboardVisualizer
        bindings={[]}
        conflicts={[]}
        selectedKey={null}
        onSelectKey={() => {}}
      />,
    );

    const board = container.querySelector('.keyboard-board') as HTMLElement | null;
    expect(board).not.toBeNull();

    await waitFor(() => {
      const transform = board?.style.transform ?? '';
      const match = transform.match(/scale\(([^)]+)\)/);
      expect(match).not.toBeNull();
      const scale = Number(match?.[1]);
      expect(scale).toBeCloseTo(332 / 360, 3);
      expect(scale).toBeLessThan(1);
    });

    if (originalClientWidth) {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
    }
    if (originalClientHeight) {
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
    }
    if (originalOffsetHeight) {
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
    }
  });

  it('uses the measured keyboard width instead of the fallback width when fitting horizontally', async () => {
    const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
    const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');

    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        if ((this as HTMLElement).classList?.contains('keyboard-wrapper')) {
          return 980;
        }
        return 0;
      },
    });

    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() {
        if ((this as HTMLElement).classList?.contains('keyboard-wrapper')) {
          return 520;
        }
        return 0;
      },
    });

    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get() {
        if ((this as HTMLElement).classList?.contains('keyboard-board')) {
          return 860;
        }
        return 0;
      },
    });

    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() {
        if ((this as HTMLElement).classList?.contains('keyboard-board')) {
          return 360;
        }
        return 0;
      },
    });

    vi.stubGlobal(
      'ResizeObserver',
      class ResizeObserver {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );

    const { container } = render(
      <KeyboardVisualizer
        bindings={[]}
        conflicts={[]}
        selectedKey={null}
        onSelectKey={() => {}}
      />,
    );

    const board = container.querySelector('.keyboard-board') as HTMLElement | null;
    expect(board).not.toBeNull();

    await waitFor(() => {
      const transform = board?.style.transform ?? '';
      const match = transform.match(/scale\(([^)]+)\)/);
      expect(match).not.toBeNull();
      const scale = Number(match?.[1]);
    expect(scale).toBeCloseTo((980 - 24) / 860, 3);
      expect(scale).toBeGreaterThan(1);
    });

    if (originalClientWidth) {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
    }
    if (originalClientHeight) {
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
    }
    if (originalOffsetWidth) {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
    }
    if (originalOffsetHeight) {
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
    }
  });

  it('renders keyboard-mappable alias bindings on the matching key', () => {
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
        bindings={[
          {
            id: 'alias-ctrl-c',
            key: '~C',
            command: 'swap components',
            type: 'alias',
            bindingSource: 'user_env_original',
            status: 'normal',
          },
        ]}
        conflicts={[]}
        selectedKey={null}
        onSelectKey={() => {}}
        activeLayer="ctrl"
      />,
    );

    const keycap = screen.getByText('C').closest('.keycap');
    expect(keycap).not.toBeNull();
    expect(keycap).toHaveClass('key-normal');

    fireEvent.mouseEnter(keycap!);

    expect(keycap).not.toHaveAttribute('title');
    expect(screen.getByText('swap components')).toBeInTheDocument();
    expect(screen.getByText('键位: Ctrl+C')).toBeInTheDocument();
    expect(screen.getByText('来源: 用户 env')).toBeInTheDocument();
  });

  it('marks readonly reserved occupancy as occupied in my view when the key is not free', () => {
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
            id: 'reserved-1',
            key: '1',
            command: 'skill.bound.command',
            type: 'funckey',
            bindingSource: 'skill_direct',
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

    const keycap = screen
      .getAllByText('1')
      .find((element) => element.classList.contains('keycap-label'))
      ?.closest('.keycap');
    expect(keycap).not.toBeNull();
    expect(keycap).toHaveClass('key-normal');

    fireEvent.mouseEnter(keycap!);

    expect(screen.getByText('键位: 1')).toBeInTheDocument();
    expect(screen.getByText('来源: Skill 直接注册')).toBeInTheDocument();
  });

  it('only highlights bindings that belong to the active ctrl layer', () => {
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
        bindings={[
          {
            id: 'normal-a',
            key: 'a',
            command: 'align',
            type: 'funckey',
            bindingSource: 'user_env_original',
            status: 'normal',
          },
          {
            id: 'ctrl-c',
            key: '~C',
            command: 'swap components',
            type: 'alias',
            bindingSource: 'user_env_original',
            status: 'normal',
          },
        ]}
        conflicts={[]}
        selectedKey={null}
        onSelectKey={() => {}}
        activeLayer="ctrl"
      />,
    );

    const aKey = screen.getByText('A').closest('.keycap');
    const cKey = screen.getByText('C').closest('.keycap');

    expect(aKey).not.toBeNull();
    expect(cKey).not.toBeNull();
    expect(aKey).toHaveClass('key-empty');
    expect(cKey).toHaveClass('key-normal');

    fireEvent.mouseEnter(cKey!);

    expect(screen.getByText('swap components')).toBeInTheDocument();
    expect(screen.getByText('键位: Ctrl+C')).toBeInTheDocument();
  });

  it('shows every binding inside the hover card when one key has multiple commands', () => {
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
        bindings={[
          {
            id: 'ctrl-s-user',
            key: '~S',
            command: 'save',
            type: 'alias',
            bindingSource: 'user_env_original',
            status: 'normal',
          },
          {
            id: 'ctrl-s-default',
            key: '~S',
            command: 'save all',
            type: 'alias',
            bindingSource: 'install_default_env',
            status: 'normal',
          },
        ]}
        conflicts={[]}
        selectedKey={null}
        onSelectKey={() => {}}
        activeLayer="ctrl"
      />,
    );

    const keycap = screen.getByText('S').closest('.keycap');
    expect(keycap).not.toBeNull();

    fireEvent.mouseEnter(keycap!);

    expect(screen.getByText('save')).toBeInTheDocument();
    expect(screen.getByText('save all')).toBeInTheDocument();
    expect(screen.getByText('来源: 用户 env')).toBeInTheDocument();
    expect(screen.getByText('来源: 安装默认 env')).toBeInTheDocument();
  });

  it('keeps overlay-only stacked bindings as normal when there is no real warning conflict', () => {
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
        bindings={[
          {
            id: 'ctrl-c-user',
            key: '~C',
            command: 'swap components',
            type: 'alias',
            bindingSource: 'user_env_original',
            status: 'normal',
          },
        ]}
        reservedBindings={[
          {
            id: 'ctrl-c-default',
            key: '~C',
            command: 'clipboard copy',
            type: 'alias',
            bindingSource: 'system_reserved',
            status: 'reserved',
            editable: false,
          },
        ]}
        conflicts={[]}
        selectedKey={null}
        onSelectKey={() => {}}
        activeLayer="ctrl"
        viewMode="overlay"
      />,
    );

    const cKey = screen.getByText('C').closest('.keycap');
    expect(cKey).not.toBeNull();
    expect(cKey).toHaveClass('key-normal');
    expect(cKey).not.toHaveClass('key-warning');
  });

  it('filters the keyboard to skill-related hotkeys when the skill toggle is enabled', () => {
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
        bindings={[
          {
            id: 'plain-a',
            key: 'a',
            command: 'align',
            type: 'funckey',
            bindingSource: 'user_env_original',
            commandSource: 'allegro_builtin',
            status: 'normal',
          },
          {
            id: 'skill-v',
            key: 'v',
            command: 'snp',
            type: 'funckey',
            bindingSource: 'user_env_original',
            commandSource: 'user_skill',
            status: 'normal',
          },
        ]}
        reservedBindings={[
          {
            id: 'skill-direct-1',
            key: '1',
            command: 'zsqLayer',
            type: 'funckey',
            bindingSource: 'skill_direct',
            commandSource: 'user_skill',
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

    fireEvent.click(screen.getByRole('button', { name: 'Skill' }));

    const aKey = screen.getByText('A').closest('.keycap');
    const vKey = screen.getByText('V').closest('.keycap');
    const oneKey = screen
      .getAllByText('1')
      .find((element) => element.classList.contains('keycap-label'))
      ?.closest('.keycap');

    expect(aKey).not.toBeNull();
    expect(vKey).not.toBeNull();
    expect(oneKey).not.toBeNull();

    expect(aKey).toHaveClass('key-empty');
    expect(vKey).toHaveClass('key-normal');
    expect(oneKey).toHaveClass('key-normal');
  });

  it('uses a concise skill label in the hover card for long direct skill command names', () => {
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
    expect(screen.queryByText('zsqlayer_etchlayerall')).not.toBeInTheDocument();
    expect(screen.getByText('来源: Skill 直接注册 · zsqLayer')).toBeInTheDocument();
  });
});
