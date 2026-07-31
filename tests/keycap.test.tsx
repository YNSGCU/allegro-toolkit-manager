import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Keycap from '../src/components/Keycap';

afterEach(() => {
  cleanup();
});

describe('modifier keycap layout', () => {
  it('renders active modifier content in a dedicated vertical stack', () => {
    render(
      <Keycap
        keyDef={{ label: 'Ctrl', names: ['Ctrl'], width: 1.25, type: 'modifier' }}
        status="selected"
        hasFunckey={false}
        hasAlias={false}
        tooltip="Ctrl layer"
        dimmed={false}
        onClick={() => {}}
        isModifier
        isActiveModifier
      />,
    );

    expect(screen.getByText('Ctrl')).toBeInTheDocument();
    const activeStack = document.querySelector('.keycap-modifier-stack--active');
    expect(activeStack).not.toBeNull();
    expect(activeStack?.querySelector('.keycap-modifier-indicator')).not.toBeNull();
  });
});
