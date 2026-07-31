import path from 'path';

export interface RendererRequestResolution {
  requestPath: string;
  filePath: string;
}

export function normalizeRendererRequestPath(requestUrl?: string): string {
  if (!requestUrl || requestUrl === '/') {
    return '/index.html';
  }

  const parsed = new URL(requestUrl, 'http://127.0.0.1');
  return parsed.pathname || '/index.html';
}

export function shouldFallbackToIndexHtml(requestPath: string): boolean {
  return path.extname(requestPath) === '';
}

export function resolveRendererRequest(
  distDir: string,
  requestUrl?: string,
): RendererRequestResolution {
  const requestPath = normalizeRendererRequestPath(requestUrl);
  const normalizedRequestPath =
    requestPath === '/' ? '/index.html' : requestPath;

  return {
    requestPath: normalizedRequestPath,
    filePath: path.join(distDir, normalizedRequestPath),
  };
}
