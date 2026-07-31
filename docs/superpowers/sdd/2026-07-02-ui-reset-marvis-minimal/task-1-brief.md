### Task 1: 寤虹珛 Renderer 娴嬭瘯鏀拺

**Files:**
- Create: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\vitest.config.ts`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\package.json`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\tests\setup.ts`

**Interfaces:**
- Produces: `vitest.config.ts` with `environment: 'jsdom'`
- Produces: test setup loading renderer assertions before UI work starts

- [ ] **Step 1: Write the failing test harness config**

```ts
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
```

- [ ] **Step 2: Run test command to verify it fails**

Run: `npx.cmd vitest run tests/minimalSurface.test.tsx`

Expected: FAIL with 鈥淐annot find module鈥?or 鈥淣o test files found鈥? because the UI harness and test file do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```json
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\package.json (devDependencies excerpt)
{
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.6.3",
    "jsdom": "^26.1.0"
  }
}
```

```ts
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\tests\setup.ts
import '@testing-library/jest-dom/vitest';
import { beforeAll } from 'vitest';

beforeAll(() => {
  process.env.HOME = 'C:\\Users\\testuser';
  process.env.USERPROFILE = 'C:\\Users\\testuser';
  process.env.HOMEDRIVE = 'C:';
  process.env.HOMEPATH = '\\Users\\testuser';
});
```

- [ ] **Step 4: Run tests to verify harness is live**

Run: `npx.cmd vitest --help`

Expected: command runs without config parse errors, and later UI tests can use `jsdom`.

- [ ] **Step 5: Write checkpoint**

Run: `Write-Output "Checkpoint: renderer test harness added; repo has no .git so no commit created."`

Expected: outputs the checkpoint line.


