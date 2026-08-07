export type UpdateStatus =
  | 'unconfigured'
  | 'unsupported'
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export type UpdateFailureCode = 'configuration' | 'network' | 'metadata' | 'integrity' | 'permission' | 'unknown';

export interface UpdateFailure {
  code: UpdateFailureCode;
  operation: 'configure' | 'check' | 'download' | 'install' | 'updater';
  occurredAt: string;
  recoverable: boolean;
  retryAction: 'check' | 'download' | 'none';
}

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion?: string;
  progress?: number;
  message?: string;
  releaseNotes?: string;
  failure?: UpdateFailure;
}

export interface UpdateSettings {
  feedUrl: string;
  connectionMode: 'system' | 'direct';
}

export interface UpdateSettingsView {
  settings: UpdateSettings;
  source: 'none' | 'default' | 'environment' | 'saved';
}
