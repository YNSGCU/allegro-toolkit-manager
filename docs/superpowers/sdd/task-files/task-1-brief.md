### Task 1: 寤虹珛蹇嵎閿瓙璺敱涓庝簩绾у鑸鏋?
**Files:**
- Create: `src/components/hotkeys/hotkeyWorkspaceSections.ts`
- Create: `src/components/hotkeys/HotkeySubnav.tsx`
- Create: `src/pages/HotkeyWorkspacePage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/HotkeyPage.tsx`
- Modify: `src/App.css`
- Test: `tests/hotkeyWorkspaceRouting.test.tsx`

**Interfaces:**
- Consumes: `react-router-dom` 涓殑 `NavLink`銆乣Navigate`銆乣Route`銆乣Routes`
- Produces:
  - `HOTKEY_WORKSPACE_SECTIONS: readonly { key: 'overview' | 'editor' | 'conflicts' | 'import-export'; label: string; path: string; summary: string }[]`
  - `HotkeySubnav(): JSX.Element`
  - `HotkeyWorkspacePage(): JSX.Element`

- [ ] **Step 1: 鍐欏け璐ユ祴璇?*

```tsx
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HotkeyWorkspacePage from '../src/pages/HotkeyWorkspacePage';

function mockAtm() {
  Object.defineProperty(window, 'atm', {
    writable: true,
    value: {
      locateEnvironment: vi.fn().mockResolvedValue({ success: true, data: { envExists: false, warnings: [], pcbenvPath: null, envFilePath: null } }),
      listProfiles: vi.fn().mockResolvedValue({ success: true, data: [] }),
      getAppliedHotkeyProfile: vi.fn().mockResolvedValue({ success: true, data: { profileId: '' } }),
    },
  });
}

describe('hotkey workspace routing', () => {
  it('redirects /hotkeys to /hotkeys/overview and renders subnav labels', async () => {
    mockAtm();

    render(
      <MemoryRouter initialEntries={['/hotkeys']}>
        <Routes>
          <Route path="/hotkeys/*" element={<HotkeyWorkspacePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: '鎬昏' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '缂栬緫' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '鍐茬獊' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '瀵煎叆瀵煎嚭' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 杩愯娴嬭瘯纭瀹冨け璐?*

Run: `npx.cmd vitest run tests/hotkeyWorkspaceRouting.test.tsx`

Expected: FAIL锛屾姤閿欐壘涓嶅埌 `HotkeyWorkspacePage` 鎴栨壘涓嶅埌鈥滄€昏 / 缂栬緫 / 鍐茬獊 / 瀵煎叆瀵煎嚭鈥濆瓙瀵艰埅銆?
- [ ] **Step 3: 鍐欐渶灏忓疄鐜?*

```ts
// src/components/hotkeys/hotkeyWorkspaceSections.ts
export const HOTKEY_WORKSPACE_SECTIONS = [
  { key: 'overview', label: '鎬昏', path: '/hotkeys/overview', summary: '鏌ョ湅褰撳墠鏂规涓庨敭鐩樺崰鐢? },
  { key: 'editor', label: '缂栬緫', path: '/hotkeys/editor', summary: '鏌ユ壘銆佷慨鏀广€佹柊澧炲拰鍒犻櫎蹇嵎閿? },
  { key: 'conflicts', label: '鍐茬獊', path: '/hotkeys/conflicts', summary: '闆嗕腑澶勭悊鍐茬獊涓庤鐩栭闄? },
  { key: 'import-export', label: '瀵煎叆瀵煎嚭', path: '/hotkeys/import-export', summary: '瀵煎叆 env銆佹柟妗堜笌瀵煎嚭閫熸煡琛? },
] as const;

export type HotkeyWorkspaceSectionKey =
  (typeof HOTKEY_WORKSPACE_SECTIONS)[number]['key'];
```

```tsx
// src/components/hotkeys/HotkeySubnav.tsx
import { NavLink } from 'react-router-dom';
import { HOTKEY_WORKSPACE_SECTIONS } from './hotkeyWorkspaceSections';

export default function HotkeySubnav() {
  return (
    <nav className="hotkey-subnav" aria-label="蹇嵎閿伐浣滃尯">
      {HOTKEY_WORKSPACE_SECTIONS.map((section) => (
        <NavLink
          key={section.key}
          to={section.path}
          className={({ isActive }) => `hotkey-subnav-link${isActive ? ' active' : ''}`}
        >
          {section.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

```tsx
// src/pages/HotkeyWorkspacePage.tsx
import { Navigate, Route, Routes } from 'react-router-dom';
import HotkeySubnav from '../components/hotkeys/HotkeySubnav';

const Placeholder = ({ title }: { title: string }) => <section aria-label={title}>{title}</section>;

export default function HotkeyWorkspacePage() {
  return (
    <div className="hotkey-workspace-page">
      <HotkeySubnav />
      <Routes>
        <Route path="/" element={<Navigate to="/hotkeys/overview" replace />} />
        <Route path="/overview" element={<Placeholder title="蹇嵎閿€昏" />} />
        <Route path="/editor" element={<Placeholder title="閿綅缂栬緫" />} />
        <Route path="/conflicts" element={<Placeholder title="鍐茬獊澶勭悊" />} />
        <Route path="/import-export" element={<Placeholder title="瀵煎叆瀵煎嚭" />} />
      </Routes>
    </div>
  );
}
```

```tsx
// src/pages/HotkeyPage.tsx
import HotkeyWorkspacePage from './HotkeyWorkspacePage';

export default HotkeyWorkspacePage;
```

```tsx
// src/App.tsx
<Route path="/hotkeys/*" element={<HotkeyPage />} />
```

```css
/* src/App.css */
.hotkey-subnav {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.hotkey-subnav-link {
  color: var(--text-secondary);
  text-decoration: none;
  padding: 6px 0;
  border-bottom: 1px solid transparent;
}

.hotkey-subnav-link.active {
  color: var(--accent-teal);
  border-color: var(--accent-teal);
}
```

- [ ] **Step 4: 杩愯娴嬭瘯纭閫氳繃**

Run: `npx.cmd vitest run tests/hotkeyWorkspaceRouting.test.tsx`

Expected: PASS銆?
- [ ] **Step 5: 璁板綍鏃犳硶鎻愪氦 Git**

Run: `Test-Path .git`

Expected: `False`

Then: 鍦ㄨ鍒掓枃妗ｅ搴斾换鍔″墠鎵撳嬀锛屾槑纭敞鏄庘€滀粨搴撴湭鍒濆鍖?Git锛岃烦杩?commit鈥濄€?
