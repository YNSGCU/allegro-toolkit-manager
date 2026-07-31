import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  resolveRendererRequest,
  shouldFallbackToIndexHtml,
} from '../electron/rendererAssetPath';

describe('renderer asset path resolver', () => {
  const distDir = path.join('C:', 'atm', 'dist');

  it('maps root requests to index.html', () => {
    expect(resolveRendererRequest(distDir, '/').filePath).toBe(
      path.join(distDir, 'index.html'),
    );
  });

  it('strips query strings before resolving the file path', () => {
    expect(resolveRendererRequest(distDir, '/index.html?ts=1').filePath).toBe(
      path.join(distDir, 'index.html'),
    );
  });

  it('keeps asset requests on their original file path', () => {
    expect(resolveRendererRequest(distDir, '/assets/app.js?v=2').filePath).toBe(
      path.join(distDir, 'assets', 'app.js'),
    );
  });

  it('falls back to index.html for html navigations without a file extension', () => {
    expect(shouldFallbackToIndexHtml('/hotkeys')).toBe(true);
    expect(shouldFallbackToIndexHtml('/skills/overview')).toBe(true);
    expect(shouldFallbackToIndexHtml('/assets/app.js')).toBe(false);
  });
});
