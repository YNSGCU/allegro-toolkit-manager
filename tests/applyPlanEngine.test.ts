import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import iconv from 'iconv-lite';
import { afterEach, describe, expect, it } from 'vitest';
import { createApplyPlan, executeApplyPlan } from '../core/apply/applyPlanEngine';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('菜单 Apply Plan 执行引擎', () => {
  it('将生成计划绑定到环境元数据', () => {
    const plan = createApplyPlan({
      title: '绑定环境',
      module: 'menu',
      environmentId: 'env-174',
      environmentPcbenvPath: 'C:\\Users\\test\\pcbenv',
      steps: [],
    });
    expect(plan.environmentId).toBe('env-174');
    expect(plan.environmentPcbenvPath).toContain('pcbenv');
  });

  it('真实写入菜单脚本、bootstrap 和 allegro.ilinit，并保留备份与历史', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-menu-plan-'));
    tempDirs.push(root);
    const profilePath = path.join(root, 'menu_profile.json');
    const menuPath = path.join(root, 'generated_menu.il');
    const bootstrapPath = path.join(root, 'bootstrap.il');
    const ilinitPath = path.join(root, 'allegro.ilinit');
    const backupPath = path.join(root, 'backups', 'menu_profile.json.bak');

    fs.writeFileSync(profilePath, '{"old":true}', 'utf8');
    fs.writeFileSync(ilinitPath, '; existing init', 'utf8');

    const plan = createApplyPlan({
      title: '应用菜单修改',
      module: 'menu',
      backups: [{ sourceFile: profilePath, backupFile: backupPath, required: true }],
      steps: [
        {
          type: 'backup_file',
          title: '备份菜单方案',
          targetFile: profilePath,
          backupTo: backupPath,
        },
        {
          type: 'update_json',
          title: '更新菜单方案',
          targetFile: profilePath,
          after: '{"new":true}',
        },
        {
          type: 'generate_menu',
          title: '生成菜单脚本',
          targetFile: menuPath,
          after: ';; generated menu\naxlUIMenuInsert(nil \'popup "中文菜单")',
        },
        {
          type: 'ensure_bootstrap',
          title: '更新 bootstrap',
          targetFile: bootstrapPath,
          after: 'load("generated_menu.il")',
        },
        {
          type: 'modify_ilinit',
          title: '更新 allegro.ilinit',
          targetFile: ilinitPath,
          after: '; existing init\nload("bootstrap.il")',
        },
      ],
    });

    const result = await executeApplyPlan(plan, {
      backupDir: path.join(root, 'backups'),
      historyDir: path.join(root, 'history'),
    });

    expect(result.success).toBe(true);
    expect(fs.readFileSync(profilePath, 'utf8')).toBe('{"new":true}');
    const menuBytes = fs.readFileSync(menuPath);
    expect(iconv.decode(menuBytes, 'gbk')).toContain('"中文菜单"');
    expect(menuBytes.equals(Buffer.from(';; generated menu\naxlUIMenuInsert(nil \'popup "中文菜单")', 'utf8'))).toBe(false);
    expect(fs.readFileSync(bootstrapPath, 'utf8')).toContain('generated_menu.il');
    expect(fs.readFileSync(ilinitPath, 'utf8')).toContain('bootstrap.il');
    expect(fs.readFileSync(backupPath, 'utf8')).toBe('{"old":true}');
    expect(fs.existsSync(path.join(root, 'history', 'apply_plan_history.json'))).toBe(true);
  });
});
