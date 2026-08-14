/**
 * ATM - Vibe Bridge 自动加载安装器单元测试
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildAllEnvironmentsBridgeEnablePlan,
  buildBridgeLoadLine,
  checkBridgeSetupForEnvironments,
  hasBridgeLoadInIlinit,
  insertBridgeLoadToIlinit,
} from '../core/color/vibeBridgeInstaller';

const SERVER = 'C:\\Users\\test\\.codex\\skills\\allegro-vibe-bridge\\vibe_server.il';

describe('buildBridgeLoadLine', () => {
  it('generates load line with forward slashes', () => {
    expect(buildBridgeLoadLine(SERVER)).toBe(
      'load("C:/Users/test/.codex/skills/allegro-vibe-bridge/vibe_server.il")',
    );
  });
});

describe('hasBridgeLoadInIlinit', () => {
  it('detects configured load line (with and without extension)', () => {
    expect(hasBridgeLoadInIlinit('load("C:/Users/test/.codex/skills/allegro-vibe-bridge/vibe_server.il")', SERVER)).toBe(true);
    expect(hasBridgeLoadInIlinit('load("C:/Users/test/.codex/skills/allegro-vibe-bridge/vibe_server")', SERVER)).toBe(true);
  });

  it('does not match unrelated load lines', () => {
    expect(hasBridgeLoadInIlinit('load("C:/other/skill.il")', SERVER)).toBe(false);
    expect(hasBridgeLoadInIlinit('', SERVER)).toBe(false);
  });

  it('matches case-insensitively and with backslashes', () => {
    expect(hasBridgeLoadInIlinit('load("c:/users/test/.codex/skills/allegro-vibe-bridge/vibe_server.il")', SERVER)).toBe(true);
    expect(hasBridgeLoadInIlinit('load("C:\\Users\\test\\.codex\\skills\\allegro-vibe-bridge\\vibe_server.il")', SERVER)).toBe(true);
  });
});

describe('insertBridgeLoadToIlinit', () => {
  it('appends load line with marker comment', () => {
    const result = insertBridgeLoadToIlinit('; existing\n', buildBridgeLoadLine(SERVER), SERVER);
    expect(result).toContain('; ATM Vibe Bridge auto-load - managed by ATM');
    expect(result).toContain(buildBridgeLoadLine(SERVER));
    expect(result).toContain('; existing');
  });

  it('returns null when already configured', () => {
    const content = 'load("C:/Users/test/.codex/skills/allegro-vibe-bridge/vibe_server.il")\n';
    expect(insertBridgeLoadToIlinit(content, buildBridgeLoadLine(SERVER), SERVER)).toBeNull();
  });

  it('handles empty file', () => {
    const result = insertBridgeLoadToIlinit('', buildBridgeLoadLine(SERVER), SERVER);
    expect(result).not.toBeNull();
    expect(result).toContain(buildBridgeLoadLine(SERVER));
  });
});

describe('checkBridgeSetupForEnvironments / buildAllEnvironmentsBridgeEnablePlan', () => {
  const originalBridgeHome = process.env.ATM_VIBE_BRIDGE_HOME;

  afterEach(() => {
    if (originalBridgeHome === undefined) {
      delete process.env.ATM_VIBE_BRIDGE_HOME;
    } else {
      process.env.ATM_VIBE_BRIDGE_HOME = originalBridgeHome;
    }
  });

  function withTempBridgeRoot(run: (serverPath: string, bridgeHome: string) => void): void {
    const bridgeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-bridge-'));
    const serverPath = path.join(bridgeHome, 'vibe_server.il');
    fs.writeFileSync(serverPath, '; server\n', 'utf8');
    process.env.ATM_VIBE_BRIDGE_HOME = bridgeHome;
    try {
      run(serverPath, bridgeHome);
    } finally {
      fs.rmSync(bridgeHome, { recursive: true, force: true });
    }
  }

  it('按环境版本编码检查多环境配置状态', () => {
    withTempBridgeRoot((serverPath) => {
      const pcbenv = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-pcbenv-'));
      const configuredIlinit = path.join(pcbenv, 'configured.ilinit');
      const missingIlinit = path.join(pcbenv, 'missing.ilinit');
      fs.writeFileSync(configuredIlinit, buildBridgeLoadLine(serverPath) + '\n', 'utf8');

      const statuses = checkBridgeSetupForEnvironments([
        { environmentId: 'env_a', allegroVersion: '17.4', ilinitPath: configuredIlinit },
        { environmentId: 'env_b', allegroVersion: '17.2', ilinitPath: missingIlinit },
      ]);

      expect(statuses).toHaveLength(2);
      expect(statuses[0].configured).toBe(true);
      expect(statuses[0].canEnable).toBe(false);
      expect(statuses[1].ilinitExists).toBe(false);
      expect(statuses[1].configured).toBe(false);
      expect(statuses[1].canEnable).toBe(true);

      fs.rmSync(pcbenv, { recursive: true, force: true });
    });
  });

  it('只生成未配置环境的写入步骤，并携带每个环境的备份', () => {
    withTempBridgeRoot((serverPath) => {
      const pcbenv = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-pcbenv-'));
      const existing = path.join(pcbenv, 'existing.ilinit');
      const configured = path.join(pcbenv, 'configured.ilinit');
      const missing = path.join(pcbenv, 'missing.ilinit');
      fs.writeFileSync(existing, '; existing\n', 'utf8');
      fs.writeFileSync(configured, buildBridgeLoadLine(serverPath) + '\n', 'utf8');

      const plan = buildAllEnvironmentsBridgeEnablePlan(
        [
          { environmentId: 'env_a', allegroVersion: '17.4', ilinitPath: existing },
          { environmentId: 'env_b', allegroVersion: '17.2', ilinitPath: configured },
          { environmentId: 'env_c', allegroVersion: '17.2', ilinitPath: missing },
        ],
        serverPath,
        path.join(pcbenv, 'atm_generated', 'backup', 'ts'),
      );

      expect(plan).not.toBeNull();
      const writeSteps = plan!.steps.filter((step) => step.type === 'modify_ilinit');
      expect(writeSteps).toHaveLength(2);
      expect(plan!.targetFiles).toContain(existing);
      expect(plan!.targetFiles).toContain(missing);
      expect(plan!.targetFiles).not.toContain(configured);
      expect(plan!.backups).toHaveLength(2);
      expect(plan!.backups.every((backup) => backup.required)).toBe(true);

      fs.rmSync(pcbenv, { recursive: true, force: true });
    });
  });

  it('所有环境均已配置时返回 null', () => {
    withTempBridgeRoot((serverPath) => {
      const pcbenv = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-pcbenv-'));
      const ilinit = path.join(pcbenv, 'configured.ilinit');
      fs.writeFileSync(ilinit, buildBridgeLoadLine(serverPath) + '\n', 'utf8');

      const plan = buildAllEnvironmentsBridgeEnablePlan(
        [{ environmentId: 'env_a', allegroVersion: '17.4', ilinitPath: ilinit }],
        serverPath,
        path.join(pcbenv, 'atm_generated', 'backup', 'ts'),
      );

      expect(plan).toBeNull();
      fs.rmSync(pcbenv, { recursive: true, force: true });
    });
  });
});
