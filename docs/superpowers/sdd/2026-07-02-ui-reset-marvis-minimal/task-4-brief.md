### Task 4: 鍒涘缓鍏变韩鏋佺畝棣栧睆妯℃澘骞惰惤鍦板揩鎹烽敭椤?
**Files:**
- Create: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\components\MinimalSurface.tsx`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\HotkeyPage.tsx`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\App.css`

**Interfaces:**
- Consumes: `PageSurface`, existing page state like `stats`, `profiles`, `plan`
- Produces: `MinimalSurface(props)` with `title`, `subtitle`, `prompt`, `summaryLine`, `cards`

- [ ] **Step 1: Write the failing component test**

```tsx
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\tests\minimalSurface.test.tsx (append)
import MinimalSurface from '../src/components/MinimalSurface';

it('renders a single prompt panel and quick entry cards', () => {
  render(
    <MinimalSurface
      title="蹇嵎閿伐浣滃彴"
      subtitle="褰撳墠鏂规銆佸啿绐佹儏鍐靛拰閿綅缂栬緫閮芥敹鍦ㄨ繖閲屻€?
      prompt="褰撳墠鏂规锛氳嚜鐢紝缁х画缂栬緫鎴栫洿鎺ュ簲鐢ㄣ€?
      summaryLine={['36 鏉″揩鎹烽敭', '0 鍐茬獊', '鐢ㄦ埛灞?env']}
      cards={[
        { id: 'overview', title: '蹇€熻繘鍏ラ敭鐩樻€昏', meta: '榛樿鍏ュ彛' },
        { id: 'conflicts', title: '澶勭悊鍐茬獊涓庝繚鐣欓敭', meta: '0 涓緟澶勭悊' },
      ]}
    />,
  );

  expect(screen.getByText('蹇嵎閿伐浣滃彴')).toBeInTheDocument();
  expect(screen.getByText('蹇€熻繘鍏ラ敭鐩樻€昏')).toBeInTheDocument();
  expect(screen.getByText('36 鏉″揩鎹烽敭')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run tests/minimalSurface.test.tsx`

Expected: FAIL with `Cannot find module '../src/components/MinimalSurface'`.

- [ ] **Step 3: Write the minimal implementation**

```tsx
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\components\MinimalSurface.tsx
import React from 'react';

interface SurfaceCard {
  id: string;
  title: string;
  meta: string;
}

interface MinimalSurfaceProps {
  title: string;
  subtitle: string;
  prompt: string;
  summaryLine: string[];
  cards: SurfaceCard[];
}

const MinimalSurface: React.FC<MinimalSurfaceProps> = ({
  title,
  subtitle,
  prompt,
  summaryLine,
  cards,
}) => {
  return (
    <section className="minimal-surface">
      <header className="minimal-surface-header">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </header>
      <div className="minimal-surface-prompt">
        <div className="minimal-surface-prompt-copy">{prompt}</div>
      </div>
      <div className="minimal-surface-summary">
        {summaryLine.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <div className="minimal-surface-grid">
        {cards.map((card) => (
          <article key={card.id} className="minimal-surface-card">
            <h2>{card.title}</h2>
            <p>{card.meta}</p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default MinimalSurface;
```

```tsx
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\HotkeyPage.tsx (top excerpt)
const hotkeySurface = getPageSurface('hotkeys');

return (
  <div className="marvis-page">
    <MinimalSurface
      title={hotkeySurface.title}
      subtitle={hotkeySurface.subtitle}
      prompt={`褰撳墠鏂规锛?{activeProfileName}锛?{plan ? '瀛樺湪寰呭簲鐢ㄥ彉鏇淬€? : '鍙互缁х画缂栬緫鎴栫洿鎺ュ簲鐢ㄣ€?}`}
      summaryLine={[
        `${stats.total} 鏉″揩鎹烽敭`,
        `${stats.errorCount + stats.warningCount} 涓棶棰榒,
        envInfo?.envFilePath ? '鐢ㄦ埛灞?env' : '鐜鏈畾浣?,
      ]}
      cards={hotkeySurface.actions}
    />
    {/* 鍘熸湁閲嶅瀷缂栬緫鍖轰笅绉讳负浜岀骇鍐呭 */}
  </div>
);
```

- [ ] **Step 4: Run tests and build checks**

Run:

```powershell
npx.cmd vitest run tests/minimalSurface.test.tsx
npx.cmd tsc --noEmit
npm run build:renderer
```

Expected: all PASS

- [ ] **Step 5: Write checkpoint**

Run: `Write-Output "Checkpoint: hotkey page converted to minimal prompt-first entry surface."`

Expected: outputs the checkpoint line.


