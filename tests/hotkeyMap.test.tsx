import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HotkeyMap from '../src/components/HotkeyMap';
import type { HotkeyBinding } from '../src/types/hotkey';

function createBinding(overrides: Partial<HotkeyBinding> = {}): HotkeyBinding {
  return {
    id: overrides.id ?? 'binding-1',
    key: overrides.key ?? 'a',
    command: overrides.command ?? 'test command',
    type: overrides.type ?? 'funckey',
    bindingSource: overrides.bindingSource ?? 'user_env_original',
    source: overrides.source ?? 'user_original',
    status: overrides.status ?? 'normal',
    chineseName: overrides.chineseName ?? '测试命令',
    commandSource: overrides.commandSource ?? 'allegro_builtin',
    editable: overrides.editable ?? true,
    ...overrides,
  };
}

describe('hotkey map cards', () => {
  it('renders each card with a stretchable body and pinned footer structure for aligned rows', () => {
    const bindings: HotkeyBinding[] = [
      createBinding({
        id: 'binding-short',
        key: 'j',
        command: 'rats',
        chineseName: 'rats',
        lineNumber: 31,
      }),
      createBinding({
        id: 'binding-long',
        key: '"Shift+wheel_down"',
        command: '"pan 0 100"',
        chineseName: 'pan',
        lineNumber: 49,
        skillName: 'Allegro 内置',
      }),
    ];

    const { container } = render(
      <HotkeyMap
        bindings={bindings}
        reservedBindings={[]}
        conflicts={[]}
        selectedBindingId={null}
        onSelectBinding={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
        filter="all"
        onFilterChange={vi.fn()}
        onEdit={vi.fn()}
        viewMode="my"
      />,
    );

    const cards = Array.from(container.querySelectorAll('.hotkey-card'));

    expect(cards).toHaveLength(2);

    cards.forEach((card) => {
      expect(card.querySelector('.hotkey-card-body')).not.toBeNull();
      expect(card.querySelector('.hotkey-card-footer')).not.toBeNull();
      expect(card.querySelector('.hotkey-card-footer .hotkey-card-meta')).not.toBeNull();
    });
  });

  it('keeps editor cards in a denser responsive grid and lets long key text shrink', () => {
    const appCss = readFileSync(resolve(process.cwd(), 'src/App.css'), 'utf8');

    expect(appCss).toMatch(/\.hotkey-map-cards\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(160px,\s*1fr\)\)/);
    expect(appCss).toMatch(/\.hotkey-card-keyname\s*\{[\s\S]*min-width:\s*0;[\s\S]*overflow:\s*hidden;[\s\S]*text-overflow:\s*ellipsis;[\s\S]*white-space:\s*nowrap;/);
    expect(appCss).toMatch(/\.hotkey-card-cmd\s*\{[\s\S]*display:\s*block;[\s\S]*width:\s*100%;[\s\S]*min-width:\s*0;/);
  });
});
