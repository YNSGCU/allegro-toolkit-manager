### Task 2: 閿佸畾椤甸潰妯℃澘閰嶇疆涓庨粯璁ゅ叆鍙?
**Files:**
- Create: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\config\pageSurfaces.ts`
- Create: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\tests\pageSurfaces.test.ts`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\config\appShell.ts`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\App.tsx`

**Interfaces:**
- Consumes: `APP_NAV_ITEMS`, `PRIMARY_WORKSPACES`, `getDefaultWorkspaceRoute(): string`
- Produces: `PAGE_SURFACES`, `getPageSurface(key): PageSurface`

- [ ] **Step 1: Write the failing tests**

```ts
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\tests\pageSurfaces.test.ts
import { describe, expect, it } from 'vitest';
import { PAGE_SURFACES, getPageSurface } from '../src/config/pageSurfaces';
import { getDefaultWorkspaceRoute } from '../src/config/appShell';

describe('page surfaces', () => {
  it('keeps hotkeys as the default route', () => {
    expect(getDefaultWorkspaceRoute()).toBe('/hotkeys');
  });

  it('defines the minimal surface copy for hotkeys', () => {
    expect(getPageSurface('hotkeys').title).toBe('蹇嵎閿伐浣滃彴');
    expect(getPageSurface('hotkeys').actions.length).toBeGreaterThanOrEqual(3);
  });

  it('defines all five page surface entries', () => {
    expect(Object.keys(PAGE_SURFACES)).toEqual([
      'hotkeys',
      'skills',
      'menu',
      'overview',
      'environment',
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run tests/pageSurfaces.test.ts`

Expected: FAIL with `Cannot find module '../src/config/pageSurfaces'`.

- [ ] **Step 3: Write the minimal implementation**

```ts
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\config\pageSurfaces.ts
export type PageSurfaceKey =
  | 'hotkeys'
  | 'skills'
  | 'menu'
  | 'overview'
  | 'environment';

export interface SurfaceAction {
  id: string;
  label: string;
  meta: string;
}

export interface PageSurface {
  key: PageSurfaceKey;
  title: string;
  subtitle: string;
  prompt: string;
  actions: SurfaceAction[];
}

export const PAGE_SURFACES: Record<PageSurfaceKey, PageSurface> = {
  hotkeys: {
    key: 'hotkeys',
    title: '蹇嵎閿伐浣滃彴',
    subtitle: '鎶婂綋鍓嶆柟妗堛€佸啿绐佹儏鍐靛拰閿綅缂栬緫鏀跺湪涓€涓共鍑€鍏ュ彛閲屻€?,
    prompt: '褰撳墠鏂规锛氳嚜鐢紝缁х画缂栬緫銆佹鏌ュ啿绐侊紝鎴栫洿鎺ュ簲鐢ㄣ€?,
    actions: [
      { id: 'overview', label: '閿洏鎬昏', meta: '榛樿鍏ュ彛' },
      { id: 'conflicts', label: '澶勭悊鍐茬獊', meta: '0 涓緟澶勭悊' },
      { id: 'apply', label: '搴旂敤鏂规', meta: 'Apply Plan' },
    ],
  },
  skills: {
    key: 'skills',
    title: 'Skill 缂栨帓鍙?,
    subtitle: '鍏堢‘璁ゅ綋鍓嶈兘鍔涚姸鎬侊紝鍐嶈繘鍏ユ壂鎻忋€佸紩鐢ㄥ拰鍚仠銆?,
    prompt: '褰撳墠 Skill 鏂规宸插姞杞斤紝缁х画鎵弿銆佹鏌ュ紩鐢ㄦ垨璋冩暣鍚仠銆?,
    actions: [
      { id: 'scan', label: '鎵弿 Skill', meta: '鍚屾鏈湴鑳藉姏' },
      { id: 'refs', label: '寮曠敤妫€鏌?, meta: '妫€鏌ュ懡浠ゅ叧鑱? },
      { id: 'registry', label: '鍛戒护娉ㄥ唽涓績', meta: '鍏ュ彛瑙嗗浘' },
    ],
  },
  menu: {
    key: 'menu',
    title: '鑿滃崟宸ヤ綔鍙?,
    subtitle: '鍏堢湅鑽夌鐘舵€侊紝鍐嶈繘鍏ヨ彍鍗曟爲銆佸懡浠よ鍥句笌鐢熸垚娴佺▼銆?,
    prompt: '褰撳墠鑿滃崟鑽夌鍙户缁紪杈戯紝涔熷彲浠ョ洿鎺ヨ繘鍏ョ敓鎴愪笌棰勮銆?,
    actions: [
      { id: 'tree', label: '鑿滃崟鏍?, meta: '涓荤紪杈戝叆鍙? },
      { id: 'commands', label: '鍛戒护瑙嗗浘', meta: '鍏宠仈鍛戒护' },
      { id: 'preview', label: '棰勮 / Apply Plan', meta: '鐢熸垚鍓嶇‘璁? },
    ],
  },
  overview: {
    key: 'overview',
    title: '姒傝',
    subtitle: '蹇€熺‘璁ゆ暣涓伐浣滃尯鐨勫仴搴蜂笌鍏ュ彛鐘舵€併€?,
    prompt: '鍏堢湅鐜涓庨厤缃姸鎬侊紝鍐嶅喅瀹氳繘鍏ュ摢涓牳蹇冮〉闈€?,
    actions: [
      { id: 'health', label: '鐜鍋ュ悍', meta: '鎬昏' },
      { id: 'hotkeys', label: '杩涘叆蹇嵎閿?, meta: '榛樿涓诲叆鍙? },
      { id: 'skills', label: '杩涘叆 Skill', meta: '鑳藉姏绠＄悊' },
    ],
  },
  environment: {
    key: 'environment',
    title: '鐜妫€娴?,
    subtitle: '妫€鏌ヨ矾寰勩€佹潈闄愬拰閰嶇疆鏉ユ簮锛屼负鍚庣画閰嶇疆鍔ㄤ綔鍏滃簳銆?,
    prompt: '瀹氫綅 pcbenv銆乪nv 鏂囦欢鍜?allegro.ilinit 鐨勫綋鍓嶇姸鎬併€?,
    actions: [
      { id: 'pcbenv', label: '閫夋嫨 pcbenv', meta: '鎵嬪姩瀹氫綅' },
      { id: 'scan', label: '鑷姩妫€娴?, meta: '閲嶆柊鎵弿' },
      { id: 'vars', label: '鐜鍙橀噺', meta: '鍩虹淇℃伅' },
    ],
  },
};

export function getPageSurface(key: PageSurfaceKey): PageSurface {
  return PAGE_SURFACES[key];
}
```

```tsx
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\App.tsx (route excerpt)
<Route path="/" element={<Navigate to={getDefaultWorkspaceRoute()} replace />} />
<Route path="/overview" element={<DashboardPage />} />
<Route path="*" element={<Navigate to={getDefaultWorkspaceRoute()} replace />} />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx.cmd vitest run tests/pageSurfaces.test.ts`

Expected: PASS

- [ ] **Step 5: Write checkpoint**

Run: `Write-Output "Checkpoint: page surface config and default route locked."`

Expected: outputs the checkpoint line.


