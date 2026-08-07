import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { CompatibilityEvidenceRecord } from '../../src/types/environment';
import { getEnvironmentRegistryPath } from './environmentRegistry';

function recordPath(): string {
  return path.join(path.dirname(getEnvironmentRegistryPath()), 'compatibility-records.json');
}

export function loadCompatibilityRecords(): CompatibilityEvidenceRecord[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(recordPath(), 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCompatibilityRecord(
  input: Omit<CompatibilityEvidenceRecord, 'id' | 'checkedAt'> & Partial<Pick<CompatibilityEvidenceRecord, 'id' | 'checkedAt'>>,
): CompatibilityEvidenceRecord {
  const records = loadCompatibilityRecords();
  const record: CompatibilityEvidenceRecord = {
    ...input,
    id: input.id || `compat_${crypto.randomUUID()}`,
    checkedAt: input.checkedAt || new Date().toISOString(),
  };
  const existing = records.findIndex((item) =>
    item.environmentId === record.environmentId
    && item.scope === record.scope
    && item.subjectId === record.subjectId
    && item.evidenceSource === record.evidenceSource,
  );
  if (existing >= 0) records[existing] = record;
  else records.unshift(record);
  const filePath = recordPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(records.slice(0, 500), null, 2), 'utf-8');
  fs.renameSync(tmp, filePath);
  return record;
}

export function listCompatibilityRecords(filters?: Partial<Pick<CompatibilityEvidenceRecord, 'environmentId' | 'scope' | 'subjectId'>>): CompatibilityEvidenceRecord[] {
  return loadCompatibilityRecords().filter((record) =>
    (!filters?.environmentId || record.environmentId === filters.environmentId)
    && (!filters?.scope || record.scope === filters.scope)
    && (!filters?.subjectId || record.subjectId === filters.subjectId),
  );
}
