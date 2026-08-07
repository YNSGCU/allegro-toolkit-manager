import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('表单控件文字契约', () => {
  it('单行输入框统一字号、行高与水平内边距', () => {
    const controlsCss = readSource('../src/shared/ui/foundations/controls.css');

    expect(controlsCss).toMatch(
      /input\.search-input,[\s\S]*?input\[type='search'\],[\s\S]*?select\s*\{[^}]*padding:\s*0 10px;[^}]*font-family:\s*var\(--ui-font-sans\);[^}]*font-size:\s*var\(--ui-font-size-sm\);[^}]*line-height:\s*1\.4;/,
    );
  });

  it('占位文字继承控件排版且不再被浏览器降低透明度', () => {
    const controlsCss = readSource('../src/shared/ui/foundations/controls.css');
    const legacyCss = readSource('../src/App.css');

    expect(controlsCss).toMatch(
      /input::placeholder,[\s\S]*?textarea::placeholder\s*\{[^}]*color:\s*var\(--ui-text-muted\);[^}]*font:\s*inherit;[^}]*opacity:\s*1;/,
    );
    expect(legacyCss).not.toMatch(/\.search-input::placeholder\s*\{[^}]*font-size:/);
  });
});
