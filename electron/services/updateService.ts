import fs from 'fs';
import path from 'path';
import type { AppUpdater, ProgressInfo } from 'electron-updater';
import type { UpdateFailure, UpdateSettings, UpdateSettingsView, UpdateState } from '../../src/types/updates';

const SETTINGS_FILE = 'update-settings.json';
export const OFFICIAL_UPDATE_FEED_URL = 'https://github.com/YNSGCU/allegro-toolkit-manager/releases/latest/download';
const UPDATE_CHECK_TIMEOUT_MS = 30_000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function classifyFailure(error: unknown): UpdateFailure['code'] {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (/invalid url|unsupported protocol|feedurl|app-update\.yml/.test(message)) return 'configuration';
  if (/sha|checksum|integrity|signature|notsigned|unsigned|code signing/.test(message)) return 'integrity';
  if (/latest\.yml|404|not found|metadata|yaml/.test(message)) return 'metadata';
  if (/eacces|eperm|permission|access denied/.test(message)) return 'permission';
  if (/enet|econn|dns|network|socket|timeout|proxy|tls|certificate|超时|网络|代理/.test(message)) return 'network';
  return 'unknown';
}

function isValidFeedUrl(value: string): boolean {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname) && !parsed.username && !parsed.password && !parsed.search && !parsed.hash;
  } catch {
    return false;
  }
}

function releaseNotesText(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (!Array.isArray(value)) return undefined;
  const notes = value.map((entry) => (entry && typeof entry.note === 'string' ? entry.note.trim() : '')).filter(Boolean).join('\n\n');
  return notes || undefined;
}

export class UpdateService {
  private stateValue: UpdateState;
  private settingsView: UpdateSettingsView;
  private busy = false;

  constructor(
    private readonly updater: AppUpdater,
    private readonly currentVersion: string,
    private readonly packaged: boolean,
    private readonly userDataPath: string,
    private readonly publish: (state: UpdateState) => void,
    defaultFeedUrl = '',
  ) {
    const environmentUrl = process.env.ATM_UPDATE_URL?.trim() || '';
    const saved = this.readSavedSettings();
    const savedUrl = saved?.feedUrl?.trim() || '';
    const embeddedUrl = defaultFeedUrl.trim();
    const feedUrl = environmentUrl || savedUrl || embeddedUrl || OFFICIAL_UPDATE_FEED_URL;
    this.settingsView = {
      settings: { feedUrl, connectionMode: saved?.connectionMode || 'system' },
      source: environmentUrl ? 'environment' : savedUrl ? 'saved' : 'default',
    };
    this.stateValue = {
      status: !packaged ? 'unsupported' : feedUrl ? 'idle' : 'unconfigured',
      currentVersion,
      message: !packaged ? '开发模式不执行应用更新' : feedUrl ? '可以检查更新' : '尚未配置更新源',
    };
    this.updater.autoDownload = false;
    this.updater.autoInstallOnAppQuit = false;
    this.bindEvents();
  }

  state(): UpdateState { return { ...this.stateValue }; }
  settings(): UpdateSettingsView { return { settings: { ...this.settingsView.settings }, source: this.settingsView.source }; }

  async saveSettings(settings: UpdateSettings): Promise<UpdateSettingsView> {
    const normalized = { feedUrl: settings.feedUrl.trim().replace(/\/+$/, ''), connectionMode: settings.connectionMode };
    if (!isValidFeedUrl(normalized.feedUrl)) throw new Error('更新源必须是有效的 HTTPS 地址，且不能包含凭据、查询参数或片段');
    fs.mkdirSync(this.userDataPath, { recursive: true });
    fs.writeFileSync(path.join(this.userDataPath, SETTINGS_FILE), JSON.stringify(normalized, null, 2), 'utf8');
    this.settingsView = { settings: normalized, source: 'saved' };
    await this.configure();
    return this.settings();
  }

  async configure(): Promise<UpdateState> {
    const feedUrl = this.settingsView.settings.feedUrl;
    if (!this.packaged) return this.setState({ status: 'unsupported', message: '开发模式不执行应用更新' });
    if (!feedUrl) return this.setState({ status: 'unconfigured', message: '尚未配置更新源' });
    if (!isValidFeedUrl(feedUrl)) return this.setError('configure', new Error('更新源配置无效'));
    try {
      await this.prepareNetwork();
      this.updater.setFeedURL({ provider: 'generic', url: feedUrl });
      return this.setState({ status: 'idle', message: this.settingsView.settings.connectionMode === 'system' ? '已配置，可使用系统代理检查更新' : '已配置，可直接连接检查更新' });
    } catch (error) {
      return this.setError('configure', error);
    }
  }

  async check(): Promise<UpdateState> {
    if (!this.packaged) return this.setState({ status: 'unsupported', message: '开发模式不执行应用更新' });
    if (!this.settingsView.settings.feedUrl) {
      return this.setState({ status: 'unconfigured', message: '尚未配置更新源，请展开“配置更新源”后保存' });
    }
    if (this.busy) return this.state();
    this.busy = true;
    try {
      const configured = await this.configure();
      if (configured.status !== 'idle') return configured;
      this.setState({ status: 'checking', message: '正在连接更新服务器' });
      await withTimeout(
        this.updater.checkForUpdates(),
        UPDATE_CHECK_TIMEOUT_MS,
        '检查更新超时，请检查 GitHub 网络或系统代理',
      );
    } catch (error) {
      this.setError('check', error);
    } finally {
      this.busy = false;
    }
    return this.state();
  }

  async download(): Promise<UpdateState> {
    if (this.stateValue.status !== 'available' || this.busy) return this.state();
    this.busy = true;
    this.setState({ status: 'downloading', progress: 0, message: '正在下载更新' });
    try { await this.prepareNetwork(); await this.updater.downloadUpdate(); } catch (error) { this.setError('download', error); } finally { this.busy = false; }
    return this.state();
  }

  install(): void {
    if (this.stateValue.status !== 'downloaded') throw new Error('更新尚未下载完成');
    this.updater.quitAndInstall(true, true);
  }

  private readSavedSettings(): UpdateSettings | null {
    try {
      const value = JSON.parse(fs.readFileSync(path.join(this.userDataPath, SETTINGS_FILE), 'utf8')) as UpdateSettings;
      return value && typeof value.feedUrl === 'string' && (value.connectionMode === 'system' || value.connectionMode === 'direct') ? value : null;
    } catch { return null; }
  }

  private async prepareNetwork(): Promise<void> {
    await this.updater.netSession.setProxy({ mode: this.settingsView.settings.connectionMode === 'direct' ? 'direct' : 'system' });
    await this.updater.netSession.closeAllConnections();
  }

  private bindEvents(): void {
    this.updater.on('checking-for-update', () => this.setState({ status: 'checking', message: '正在检查更新' }));
    this.updater.on('update-available', (info) => this.setState({ status: 'available', availableVersion: info.version, releaseNotes: releaseNotesText(info.releaseNotes), message: `发现新版本 ${info.version}` }));
    this.updater.on('update-not-available', () => this.setState({ status: 'idle', message: '当前已是最新版本' }));
    this.updater.on('download-progress', (progress: ProgressInfo) => this.setState({ status: 'downloading', progress: Math.max(0, Math.min(100, progress.percent)), message: `正在下载更新 ${Math.round(progress.percent)}%` }));
    this.updater.on('update-downloaded', (info) => this.setState({ status: 'downloaded', availableVersion: info.version, progress: 100, releaseNotes: releaseNotesText(info.releaseNotes), message: '更新已下载，确认后重启安装' }));
    this.updater.on('error', (error) => this.setError(this.stateValue.status === 'downloading' ? 'download' : 'check', error));
  }

  private setError(operation: UpdateFailure['operation'], error: unknown): UpdateState {
    const code = classifyFailure(error);
    const retryAction: UpdateFailure['retryAction'] = operation === 'download' ? 'download' : operation === 'install' || code === 'permission' ? 'none' : 'check';
    const failure: UpdateFailure = { operation, code, occurredAt: new Date().toISOString(), recoverable: retryAction !== 'none', retryAction };
    const description = code === 'network' ? '网络或代理连接不可用' : code === 'metadata' ? '更新元数据不可用' : code === 'integrity' ? '下载内容未通过完整性校验' : code === 'permission' ? '系统权限不足' : code === 'configuration' ? '更新源配置无效' : '更新服务返回未知错误';
    return this.setState({ status: 'error', message: `更新${operation === 'download' ? '下载' : operation === 'check' ? '检查' : '配置'}失败：${description}`, failure });
  }

  private setState(next: Omit<UpdateState, 'currentVersion'>): UpdateState { this.stateValue = { currentVersion: this.currentVersion, ...next }; const state = this.state(); this.publish(state); return state; }
}

export { isValidFeedUrl };
