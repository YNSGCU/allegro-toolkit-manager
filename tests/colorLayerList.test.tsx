import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ColorLayerList from '../src/components/color/ColorLayerList';
import type { ColorLayerEntry, ColorPaletteEntry } from '../src/types/color';

const palette: ColorPaletteEntry[] = [
  { index: 4, name: 'Green', rgb: { r: 0, g: 255, b: 106 } },
  { index: 12, name: 'Olive', rgb: { r: 116, g: 150, b: 113 } },
  { index: 24, name: 'White', rgb: { r: 255, g: 255, b: 255 } },
];

const layers: ColorLayerEntry[] = [
  { className: 'ANTI ETCH', subclassName: 'TOP', colorIndex: 4, visible: false },
  { className: 'ETCH', subclassName: 'TOP', colorIndex: 4, visible: false, layerType: 'CONDUCTOR' },
  { className: 'ETCH', subclassName: 'L2_GND1', colorIndex: 12, visible: false, layerType: 'PLANE' },
];

afterEach(cleanup);

describe('ColorLayerList', () => {
  it('prioritizes actual copper layers and collapses auxiliary classes by default', () => {
    render(<ColorLayerList layers={layers} palette={palette} />);

    const groupButtons = screen.getAllByRole('button');
    expect(groupButtons[0]).toHaveTextContent('ETCH实际铜层');
    expect(groupButtons[0]).toHaveAttribute('aria-expanded', 'true');
    expect(groupButtons[1]).toHaveTextContent('ANTI ETCH反蚀刻辅助层');
    expect(groupButtons[1]).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('信号层')).toBeInTheDocument();
    expect(screen.getByText('平面层')).toBeInTheDocument();
  });

  it('explains palette indexes and expands a collapsed auxiliary class on click', () => {
    const onLayerColorChange = vi.fn();
    render(
      <ColorLayerList
        layers={layers}
        palette={palette}
        onLayerColorChange={onLayerColorChange}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('重新捕获');
    expect(screen.getByLabelText('ETCH/TOP 颜色')).toHaveDisplayValue('#4 · Green · #00FF6A');

    const antiEtch = screen.getByRole('button', { name: /ANTI ETCH/ });
    fireEvent.click(antiEtch);
    expect(antiEtch).toHaveAttribute('aria-expanded', 'true');
    expect(within(antiEtch.closest('.color-layer-group') as HTMLElement).getByLabelText('ANTI ETCH/TOP 颜色'))
      .toHaveDisplayValue('#4 · Green · #00FF6A');
  });

  it('opens an inline Hex editor and submits a custom color for only one layer', async () => {
    const onLayerCustomColor = vi.fn().mockResolvedValue(true);
    render(
      <ColorLayerList
        layers={layers}
        palette={palette}
        onLayerColorChange={() => {}}
        onLayerCustomColor={onLayerCustomColor}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'ETCH/TOP 自定义颜色' }));

    const editor = screen.getByRole('group', { name: 'ETCH/TOP 自定义颜色' });
    expect(within(editor).getByText('系统会自动分配安全的调色板索引，不改变其他图层的当前颜色。'))
      .toBeInTheDocument();
    expect(within(editor).getByLabelText('ETCH/TOP 自定义 Hex')).toHaveFocus();

    fireEvent.change(within(editor).getByLabelText('ETCH/TOP 自定义 Hex'), {
      target: { value: '#12ABEF' },
    });
    fireEvent.click(within(editor).getByRole('button', { name: '仅应用到此图层' }));

    await waitFor(() => {
      expect(onLayerCustomColor).toHaveBeenCalledWith(
        expect.objectContaining({ className: 'ETCH', subclassName: 'TOP' }),
        '#12ABEF',
      );
    });
    expect(screen.queryByRole('group', { name: 'ETCH/TOP 自定义颜色' })).not.toBeInTheDocument();
  });
});
