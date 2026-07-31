### Task 5: 缁熶竴 Skill / 鑿滃崟 / 姒傝 / 鐜 鍥涢〉鐨勬瀬绠€璇█

**Files:**
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\SkillPage.tsx`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\MenuPage.tsx`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\DashboardPage.tsx`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\EnvironmentPage.tsx`

**Interfaces:**
- Consumes: `getPageSurface('skills' | 'menu' | 'overview' | 'environment')`
- Produces: consistent prompt-first page surfaces across all five routes

- [ ] **Step 1: Write the failing snapshot-style render test**

```tsx
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\tests\pageSurfaces.test.ts (append)
it('keeps quick-entry cards for skills and menu pages', () => {
  expect(getPageSurface('skills').actions.map((item) => item.id)).toEqual([
    'scan',
    'refs',
    'registry',
  ]);
  expect(getPageSurface('menu').actions.map((item) => item.id)).toEqual([
    'tree',
    'commands',
    'preview',
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run tests/pageSurfaces.test.ts`

Expected: FAIL if action ids or page entries are still inconsistent.

- [ ] **Step 3: Write the minimal implementation**

```tsx
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\SkillPage.tsx (excerpt)
const skillSurface = getPageSurface('skills');

return (
  <div className="marvis-page">
    <MinimalSurface
      title={skillSurface.title}
      subtitle={skillSurface.subtitle}
      prompt={skillSurface.prompt}
      summaryLine={[
        `${allSkills.length} 涓?Skill`,
        `${refStats.errors} 涓敊璇痐,
        `${userSkills.length} 涓敤鎴?Skill`,
      ]}
      cards={skillSurface.actions}
    />
    {/* 鍘熸湁 tabs 涓庣粏绮掑害鎿嶄綔涓嬬Щ */}
  </div>
);
```

```tsx
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\MenuPage.tsx (excerpt)
const menuSurface = getPageSurface('menu');

return (
  <div className="marvis-page">
    <MinimalSurface
      title={menuSurface.title}
      subtitle={menuSurface.subtitle}
      prompt={menuSurface.prompt}
      summaryLine={[
        `${items.length} 涓妭鐐筦,
        hasUnsavedChanges ? '鑽夌鏈繚瀛? : '鑽夌宸蹭繚瀛?,
        fileStatus?.ilExists ? 'IL 宸茬敓鎴? : 'IL 鏈敓鎴?,
      ]}
      cards={menuSurface.actions}
    />
    {/* 鑿滃崟鏍戜笌棰勮鍖轰笅绉?*/}
  </div>
);
```

- [ ] **Step 4: Run full verification**

Run:

```powershell
npx.cmd vitest run tests/pageSurfaces.test.ts tests/minimalSurface.test.tsx
npx.cmd tsc --noEmit
npx.cmd tsc -p tsconfig.electron.json --noEmit
npm test
npm run build:renderer
```

Expected:

- renderer tests PASS
- frontend TS PASS
- electron TS PASS
- `npm test` PASS
- renderer build PASS

- [ ] **Step 5: Write checkpoint**

Run: `Write-Output "Checkpoint: all product pages aligned to the Marvis minimal surface system."`

Expected: outputs the checkpoint line.

## Self-Review

**1. Spec coverage:** 璁″垝瑕嗙洊浜嗙粺涓€鏋佺畝璇█銆丮arvis 鐧借壊浣撶郴銆佸幓鎺夊ぇ鍦嗚澶ф柟鏍兼劅銆佸揩鎹烽敭榛樿鍏ュ彛銆佷笁涓牳蹇冮〉缁熶竴妯℃澘銆佷袱涓緟鍔╅〉璺熻繘銆佷互鍙婂畬鏁撮獙璇佽矾寰勩€傛病鏈夐仐婕忛渶瑕佸崟鐙垚璁″垝鐨勫瓙绯荤粺銆?
**2. Placeholder scan:** 鏂囨。涓病鏈?`TODO`銆乣TBD`銆乣implement later`銆乣similar to task N` 杩欑被鍗犱綅璇彞銆傛瘡涓换鍔￠兘缁欎簡鍏蜂綋鏂囦欢銆佹祴璇曞懡浠ゅ拰鏈€灏忎唬鐮侀鏋躲€?
**3. Type consistency:** 椤甸潰閰嶇疆缁熶竴浣跨敤 `PageSurfaceKey`銆乣PageSurface`銆乣getPageSurface()`锛涘叡浜灞忕粺涓€浣跨敤 `MinimalSurface`锛涢粯璁ゅ叆鍙ｇ粺涓€閫氳繃 `getDefaultWorkspaceRoute()`銆傚悗缁换鍔″紩鐢ㄧ殑鍚嶇О涓庡墠缃换鍔″畾涔変竴鑷淬€?
## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-02-ui-reset-marvis-minimal-plan.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?

