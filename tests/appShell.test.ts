import { describe, expect, it } from 'vitest';
import {
  APP_NAV_ITEMS,
  PRIMARY_WORKSPACES,
  getDefaultWorkspaceRoute,
} from '../src/config/appShell';

describe('app shell config', () => {
  it('uses hotkeys as the default workspace route', () => {
    expect(getDefaultWorkspaceRoute()).toBe('/hotkeys');
  });

  it('keeps hotkeys, skills and menu as primary workspaces', () => {
    expect(PRIMARY_WORKSPACES.map((item) => item.key)).toEqual([
      'hotkeys',
      'skills',
      'menu',
    ]);
  });

  it('keeps overview and environment as utility entries', () => {
    const utilityItems = APP_NAV_ITEMS.filter((item) => item.group === 'utility');

    expect(utilityItems.map((item) => item.key)).toEqual([
      'overview',
      'environment',
    ]);
  });
});
