import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptFile), '..');
const auditRegistry = 'https://registry.npmjs.org';

const reviewedAdvisories = new Map([
  [
    'GHSA-QWWW-VCR4-C8H2',
    {
      packageName: 'react-router',
      reason:
        '仅影响 unstable RSC API；ATM 是 Electron HashRouter renderer，且发布门禁会扫描并禁止 RSC API。',
    },
  ],
]);

const rscPatterns = [
  /react-router(?:-dom)?\/rsc/i,
  /unstable[_-]?rsc/i,
  /createCallServer/i,
  /RSCStaticRouter/i,
  /routeRSCServerRequest/i,
  /react-server/i,
];

function collectSourceFiles(directory) {
  const files = [];
  if (!fs.existsSync(directory)) return files;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'dist-electron', '.git'].includes(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(absolutePath));
    } else if (/\.(?:[cm]?[jt]sx?|json)$/.test(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files;
}

function assertNoRscUsage() {
  const scanRoots = ['src', 'electron', 'core', 'scripts'].map((relativePath) =>
    path.join(projectRoot, relativePath),
  );

  const findings = [];
  for (const filePath of scanRoots.flatMap(collectSourceFiles)) {
    if (path.resolve(filePath) === path.resolve(scriptFile)) continue;
    const source = fs.readFileSync(filePath, 'utf8');
    for (const pattern of rscPatterns) {
      if (pattern.test(source)) {
        findings.push(`${path.relative(projectRoot, filePath)}: ${pattern}`);
      }
    }
  }

  if (findings.length > 0) {
    throw new Error(
      `检测到 React Router RSC API，不能继续豁免 GHSA-qwww-vcr4-c8h2：\n${findings.join('\n')}`,
    );
  }
}

function advisoryId(advisory) {
  const match = advisory.url?.match(/GHSA-[a-z0-9-]+/i);
  return match?.[0]?.toUpperCase() || String(advisory.source || 'unknown');
}

function runAudit() {
  const npmArgs = ['audit', '--omit=dev', '--audit-level=high', `--registry=${auditRegistry}`, '--json'];
  const npmCli = process.env.npm_execpath;
  if (npmCli) {
    return spawnSync(process.execPath, [npmCli, ...npmArgs], {
      cwd: projectRoot,
      encoding: 'utf8',
      windowsHide: true,
    });
  }

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return spawnSync(npmCommand, npmArgs, {
    cwd: projectRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
}

function main() {
  assertNoRscUsage();

  const result = runAudit();
  if (result.error) {
    process.stderr.write(`无法启动 npm audit：${result.error.message}\n`);
    process.exit(1);
  }
  let report;
  try {
    report = JSON.parse(result.stdout || result.stderr);
  } catch {
    process.stderr.write(result.stdout || result.stderr || 'npm audit 未返回可解析结果。\n');
    process.exit(1);
  }

  if (report.error) {
    process.stderr.write(`npm audit 失败：${report.error.summary || report.error.message || '未知错误'}\n`);
    process.exit(1);
  }

  const blocking = [];
  const reviewed = [];
  for (const [packageName, vulnerability] of Object.entries(report.vulnerabilities || {})) {
    for (const via of vulnerability.via || []) {
      if (typeof via === 'string' || !['high', 'critical'].includes(via.severity)) continue;
      const id = advisoryId(via);
      const exception = reviewedAdvisories.get(id);
      if (exception?.packageName === packageName) {
        reviewed.push({ id, packageName, reason: exception.reason });
      } else {
        blocking.push({ id, packageName, severity: via.severity, title: via.title });
      }
    }
  }

  if (blocking.length > 0) {
    process.stderr.write('发现未审阅的生产依赖高危漏洞：\n');
    for (const item of blocking) {
      process.stderr.write(`- ${item.id} ${item.packageName} [${item.severity}] ${item.title}\n`);
    }
    process.exit(1);
  }

  if (reviewed.length > 0) {
    process.stdout.write('生产依赖审计通过，包含以下不可利用的已审阅例外：\n');
    for (const item of reviewed) {
      process.stdout.write(`- ${item.id} (${item.packageName})：${item.reason}\n`);
    }
  } else {
    process.stdout.write('生产依赖审计通过：无 high/critical 漏洞。\n');
  }
}

main();
