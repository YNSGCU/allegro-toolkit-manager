/**
 * ATM - Vibe Bridge 自动加载安装器单元测试
 */
import { describe, it, expect } from 'vitest';
import {
  buildBridgeLoadLine,
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
