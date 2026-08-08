/**
 * ATM - 配色撤销快照模块单元测试（V6.1）
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  deleteColorUndoSnapshot,
  getColorUndoDir,
  listColorUndoSnapshots,
  loadColorUndoSnapshot,
  saveColorUndoSnapshot,
} from '../core/color/colorUndo';
import type { ColorSchemeSnapshot } from '../src/types/color';

let configHome = '';

beforeEach(() => {
  configHome = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-color-undo-'));
  process.env.ATM_CONFIG_HOME = configHome;
});

afterEach(() => {
  delete process.env.ATM_CONFIG_HOME;
  try {
    fs.rmSync(configHome, { recursive: true, force: true });
  } catch {
    // 忽略清理错误
  }
});

function makeSnapshot(): ColorSchemeSnapshot {
  return {
    palette: [{ index: 1, rgb: { r: 255, g: 255, b: 255 } }],
    background: { r: 0, g: 0, b: 0 },
    layers: [{ className: 'ETCH', subclassName: 'TOP', colorIndex: 1, visible: true }],
    source: { capturedAt: new Date().toISOString() },
  };
}

describe('colorUndo snapshots', () => {
  it('saves, loads and lists snapshots under ATM config home', () => {
    const undo = saveColorUndoSnapshot(makeSnapshot(), '测试方案');

    expect(undo.id).toMatch(/^color_undo_/);
    expect(fs.existsSync(path.join(getColorUndoDir(), `${undo.id}.json`))).toBe(true);

    const loaded = loadColorUndoSnapshot(undo.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.schemeName).toBe('测试方案');
    expect(loaded!.snapshot.layers).toHaveLength(1);

    const listed = listColorUndoSnapshots();
    expect(listed.map((item) => item.id)).toContain(undo.id);
  });

  it('returns null for missing or corrupted snapshot', () => {
    expect(loadColorUndoSnapshot('color_undo_missing')).toBeNull();

    const undo = saveColorUndoSnapshot(makeSnapshot(), '方案');
    fs.writeFileSync(
      path.join(getColorUndoDir(), `${undo.id}.json`),
      '{ broken json',
      'utf-8',
    );
    expect(loadColorUndoSnapshot(undo.id)).toBeNull();
  });

  it('deletes snapshot after use', () => {
    const undo = saveColorUndoSnapshot(makeSnapshot(), '方案');
    deleteColorUndoSnapshot(undo.id);
    expect(loadColorUndoSnapshot(undo.id)).toBeNull();
    expect(listColorUndoSnapshots()).toHaveLength(0);
  });
});
