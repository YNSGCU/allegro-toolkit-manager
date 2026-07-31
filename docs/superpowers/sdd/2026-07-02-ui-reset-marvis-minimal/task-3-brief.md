### Task 3: 閲嶅啓鍏ㄥ眬鐧借壊瑙嗚绯荤粺涓庤交瀵艰埅

**Files:**
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\components\Layout.tsx`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\App.css`

**Interfaces:**
- Consumes: `APP_NAV_ITEMS`
- Produces: white minimal shell classes: `.marvis-shell`, `.marvis-sidebar`, `.marvis-main`

- [ ] **Step 1: Write the failing render test**

```tsx
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\tests\minimalSurface.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from '../src/components/Layout';

describe('layout shell', () => {
  it('renders the lightweight core navigation labels', () => {
    render(
      <MemoryRouter initialEntries={['/hotkeys']}>
        <Layout>
          <div>page</div>
        </Layout>
      </MemoryRouter>,
    );

    expect(screen.getByText('蹇嵎閿?)).toBeInTheDocument();
    expect(screen.getByText('Skill')).toBeInTheDocument();
    expect(screen.getByText('鑿滃崟')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run tests/minimalSurface.test.tsx`

Expected: FAIL until the renderer test harness and current component imports are complete.

- [ ] **Step 3: Write the minimal implementation**

```tsx
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\components\Layout.tsx (structure excerpt)
return (
  <div className="marvis-shell">
    <aside className="marvis-sidebar">
      <div className="marvis-brand">ATM</div>
      <div className="marvis-search" aria-hidden="true" />
      <nav className="marvis-nav">
        {primaryItems.map((item) => (
          <NavLink key={item.path} to={item.path} className="marvis-nav-item">
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="marvis-nav-group-label">杈呭姪椤甸潰</div>
      <nav className="marvis-nav">
        {utilityItems.map((item) => (
          <NavLink key={item.path} to={item.path} className="marvis-nav-item">
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
    <main className="marvis-main">{children}</main>
  </div>
);
```

```css
/* C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\App.css (new shell excerpt) */
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #faf8f5;
  --bg-surface: #ffffff;
  --bg-hover: #f5f5f5;
  --bg-input: #fbf8f3;
  --text-primary: #171717;
  --text-secondary: #8c867f;
  --text-muted: #b1aaa2;
  --accent-blue: #0f8f84;
  --border-color: #ece9e5;
}

.marvis-shell {
  display: grid;
  grid-template-columns: 210px minmax(0, 1fr);
  gap: 42px;
  min-height: 100vh;
  background: #ffffff;
  padding: 18px 22px;
}

.marvis-sidebar {
  border-right: 1px solid var(--border-color);
  padding-right: 18px;
}

.marvis-nav-item {
  min-height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  padding: 0 12px;
}

.marvis-nav-item.active {
  background: var(--bg-hover);
  color: var(--text-primary);
  font-weight: 700;
}
```

- [ ] **Step 4: Run test and type check**

Run:

```powershell
npx.cmd vitest run tests/minimalSurface.test.tsx
npx.cmd tsc --noEmit
```

Expected: both PASS

- [ ] **Step 5: Write checkpoint**

Run: `Write-Output "Checkpoint: global shell converted to Marvis-style white navigation."`

Expected: outputs the checkpoint line.


