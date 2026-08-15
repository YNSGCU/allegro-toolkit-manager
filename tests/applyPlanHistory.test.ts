import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadApplyPlanHistory } from '../core/apply/applyPlanEngine';

const tmpDirs: string[] = [];

function tmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-hist-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('loadApplyPlanHistory', () => {
  it('空目录返回空数组', () => {
    expect(loadApplyPlanHistory(tmpDir())).toEqual([]);
  });

  it('读取已有历史文件', () => {
    const dir = tmpDir();
    const item = {
      id: 'ch_1',
      appliedAt: '2026-08-14T00:00:00.000Z',
      title: '测试 Skill 应用',
      module: 'skill',
      planId: 'p1',
      targetFiles: ['a.il'],
      steps: [],
      backups: [],
      canUndo: true,
    };
    fs.writeFileSync(path.join(dir, 'apply_plan_history.json'), JSON.stringify([item]), 'utf-8');
    const history = loadApplyPlanHistory(dir);
    expect(history).toHaveLength(1);
    expect(history[0].title).toBe('测试 Skill 应用');
    expect(history[0].canUndo).toBe(true);
  });

  it('损坏文件返回空数组', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'apply_plan_history.json'), 'not-json', 'utf-8');
    expect(loadApplyPlanHistory(dir)).toEqual([]);
  });
});
