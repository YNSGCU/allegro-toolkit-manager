/**
 * ATM - Env 可视化编辑器页面
 *
 * 把当前环境的 env 文件按条目可视化编辑：funckey / alias / set 变量，
 * 新增、修改、注释删除，经 Apply Plan 安全写入。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FilePenLine, Plus, Scale, Trash2, Undo2 } from 'lucide-react';
import type {
  EnvCompareResult,
  EnvEditorEntry,
  EnvEditorEntryType,
  EnvEditorLoadResult,
  EnvEditorPreviewResult,
  EnvEditStep,
} from '../types/envEditor';
import type { EnvSource } from '../types/environment';
import GlobalStatusBar from '../components/GlobalStatusBar';
import ApplyPlanUndoBar from '../components/ApplyPlanUndoBar';
import ConfirmDialog from '../components/common/ConfirmDialog';
import ToastContainer, { useToast } from '../components/common/Toast';
import { BusinessDialog, formatUserError, PageState, WorkspaceHeader, WorkspacePage } from '../shared/ui';
import './env-editor-page.css';

const TYPE_LABELS: Record<EnvEditorEntryType, string> = {
  funckey: '快捷键',
  alias: '别名',
  variable: '变量',
  comment: '注释',
  blank: '空行',
  raw: '原始',
};

const EDITABLE_TYPES: EnvEditorEntryType[] = ['funckey', 'alias', 'variable'];

function newId(): string {
  return `new_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

interface EditDraft {
  entry: EnvEditorEntry;
  type: EnvEditorEntryType;
  key: string;
  value: string;
  isNew: boolean;
}

const EnvEditorPage: React.FC = () => {
  const { toasts, addToast, removeToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadResult, setLoadResult] = useState<EnvEditorLoadResult | null>(null);
  const [entries, setEntries] = useState<EnvEditorEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [preview, setPreview] = useState<EnvEditorPreviewResult | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<'' | EnvEditorEntryType>('');
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareResult, setCompareResult] = useState<EnvCompareResult | null>(null);
  const [compareSources, setCompareSources] = useState<EnvSource[]>([]);
  const [appliedToken, setAppliedToken] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (typeof window.atm === 'undefined') {
        throw new Error('未连接到 Electron 主进程，请在 ATM 桌面应用中打开。');
      }
      const result = await window.atm.envEditorLoad();
      if (!result.success || !result.data) {
        addToast('error', formatUserError(result.error, '加载 env 失败'));
        return;
      }
      setLoadResult(result.data);
      setEntries(result.data.document.entries);
    } catch (err) {
      addToast('error', formatUserError(err, '加载 env 失败'));
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirtyEntries = useMemo(() => entries.filter((e) => e.dirty || e.deleted), [entries]);

  const visibleEntries = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return entries.filter((entry) => {
      if (typeFilter && entry.type !== typeFilter) return false;
      if (!needle) return true;
      const haystack = [
        entry.key,
        entry.value,
        entry.raw,
        TYPE_LABELS[entry.type],
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [entries, keyword, typeFilter]);

  const openEdit = (entry: EnvEditorEntry) => {
    setEditDraft({
      entry,
      type: entry.type,
      key: entry.key ?? '',
      value: entry.value ?? '',
      isNew: entry.lineNumber === 0,
    });
  };

  const openNew = (type: EnvEditorEntryType) => {
    setEditDraft({
      entry: {
        id: newId(),
        type,
        key: '',
        value: '',
        raw: '',
        lineNumber: 0,
        source: 'user_original',
        dirty: true,
        deleted: false,
      },
      type,
      key: '',
      value: '',
      isNew: true,
    });
  };

  const saveEdit = () => {
    if (!editDraft) return;
    const { entry, type, key, value } = editDraft;
    if (!key.trim()) {
      addToast('warning', '键名不能为空');
      return;
    }
    const patch = {
      id: entry.id,
      type,
      key: key.trim(),
      value: value.trim() || undefined,
    };
    const next = entry.lineNumber === 0
      ? [...entries, {
          id: entry.id,
          type,
          key: key.trim(),
          value: value.trim() || undefined,
          raw: '',
          lineNumber: 0,
          source: 'user_original' as const,
          dirty: true,
          deleted: false,
        }]
      : entries.map((item) => (
          item.id === entry.id
            ? { ...item, type, key: key.trim(), value: value.trim() || undefined, dirty: true }
            : item
        ));
    setEntries(next);
    setEditDraft(null);
  };

  const toggleDelete = (entry: EnvEditorEntry) => {
    if (entry.lineNumber === 0) {
      setEntries((prev) => prev.filter((item) => item.id !== entry.id));
      return;
    }
    setEntries((prev) => prev.map((item) => (
      item.id === entry.id ? { ...item, deleted: !item.deleted, dirty: true } : item
    )));
  };

  const handlePreview = async () => {
    try {
      const result = await window.atm.envEditorPreview(entries);
      if (!result.success || !result.data) {
        addToast('error', formatUserError(result.error, '生成预览失败'));
        return;
      }
      setPreview(result.data);
    } catch (err) {
      addToast('error', formatUserError(err, '生成预览失败'));
    }
  };

  const handleApply = async () => {
    if (!loadResult) return;
    setBusy(true);
    try {
      const result = await window.atm.envEditorApply({
        entries,
        encoding: loadResult.encoding,
        expectedHash: loadResult.contentHash,
      });
      if (!result.success) {
        addToast('error', formatUserError(result.error, '应用失败'));
        return;
      }
      addToast('success', 'env 文件已应用，重启 Allegro 后生效。');
      setPreview(null);
      setConfirmApply(false);
      setAppliedToken((t) => t + 1);
      await load();
    } catch (err) {
      addToast('error', formatUserError(err, '应用失败'));
    } finally {
      setBusy(false);
    }
  };

  const runCompare = useCallback(async (referencePath?: string) => {
    setCompareLoading(true);
    try {
      const res = await window.atm.envCompareSources(referencePath);
      if (res.success && res.data) {
        setCompareResult(res.data.result);
        setCompareSources(res.data.sources ?? []);
      } else {
        addToast('error', formatUserError(res.error, '对比 env 失败'));
      }
    } catch (err) {
      addToast('error', formatUserError(err, '对比 env 失败'));
    } finally {
      setCompareLoading(false);
    }
  }, [addToast]);

  const openCompare = useCallback(async () => {
    setCompareOpen(true);
    setCompareResult(null);
    setCompareSources([]);
    await runCompare();
  }, [runCompare]);

  const copyMissingToUser = () => {
    if (!compareResult) return;
    const existing = new Set(entries.map((e) => `${e.type}:${e.key}`));
    const missing = compareResult.diffs.filter(
      (d) => d.status === 'only_b' && !existing.has(`${d.type}:${d.key}`),
    );
    if (missing.length === 0) {
      addToast('info', '参考 env 中没有可复制的缺失条目。');
      return;
    }
    const newEntries: EnvEditorEntry[] = missing.map((d) => ({
      id: newId(),
      type: d.type,
      key: d.key,
      value: d.bValue,
      raw: '',
      lineNumber: 0,
      source: 'user_original' as const,
      dirty: true,
      deleted: false,
    }));
    setEntries([...entries, ...newEntries]);
    setCompareOpen(false);
    addToast('success', `已将 ${newEntries.length} 个缺失条目加入草稿，点击「审阅并应用」写入 env。`);
  };

  const statusItems = [
    { label: '环境', value: loadResult ? loadResult.document.filePath : '-', status: 'muted' as const },
    { label: '编码', value: loadResult ? loadResult.encoding.toUpperCase() : '-', status: 'muted' as const },
    { label: '条目', value: String(entries.length), status: 'muted' as const },
    { label: '待应用', value: String(dirtyEntries.length), status: dirtyEntries.length > 0 ? 'warning' as const : 'ok' as const },
  ];

  if (loading) {
    return (
      <WorkspacePage>
        <WorkspaceHeader title="Env 编辑器" description="可视化编辑当前环境的 env 文件。" />
        <PageState kind="loading" title="正在加载 env" />
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage className="env-editor-page">
      <WorkspaceHeader
        eyebrow="Environment"
        title="Env 编辑器"
        description="可视化编辑当前环境的 env 文件，写入前预览改动并经备份确认。"
        actions={
          <>
            <select
              className="btn env-editor-add-type"
              aria-label="选择新增条目类型"
              value=""
              onChange={(event) => {
                if (event.target.value) openNew(event.target.value as EnvEditorEntryType);
                event.target.value = '';
              }}
            >
              <option value="" disabled>新增条目…</option>
              {EDITABLE_TYPES.map((type) => (
                <option key={type} value={type}>{TYPE_LABELS[type]}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn"
              onClick={() => void openCompare()}
              title="对比当前用户 env 与参考 env"
            >
              <Scale aria-hidden="true" />
              对比参考
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void handlePreview()} disabled={dirtyEntries.length === 0}>
              审阅并应用
            </button>
          </>
        }
      />
      <GlobalStatusBar items={statusItems} />

      <ApplyPlanUndoBar
        refreshToken={appliedToken}
        onError={(message) => addToast('error', message)}
        onUndone={() => addToast('success', '已撤销上次应用。')}
      />

      {entries.length === 0 ? (
        <PageState kind="empty" title="env 文件为空" description="点击右上角「新增条目」添加内容。" />
      ) : (
        <>
          <div className="env-editor-filter">
            <input
              className="env-editor-search"
              placeholder="搜索键名 / 值 / 内容…"
              value={keyword}
              aria-label="搜索条目"
              onChange={(event) => setKeyword(event.target.value)}
            />
            <select
              className="env-editor-type-filter"
              aria-label="按类型筛选"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as '' | EnvEditorEntryType)}
            >
              <option value="">全部类型</option>
              {(Object.keys(TYPE_LABELS) as EnvEditorEntryType[]).map((type) => (
                <option key={type} value={type}>{TYPE_LABELS[type]}</option>
              ))}
            </select>
            {(keyword || typeFilter) ? (
              <button
                type="button"
                className="env-editor-filter-clear"
                onClick={() => { setKeyword(''); setTypeFilter(''); }}
              >
                清除
              </button>
            ) : null}
            <span className="env-editor-filter-count">{visibleEntries.length} / {entries.length}</span>
          </div>
          {visibleEntries.length === 0 ? (
            <PageState kind="empty" title="没有匹配的条目" description="调整搜索关键词或类型筛选后重试。" />
          ) : (
            <div className="env-editor-list" role="list">
              {visibleEntries.map((entry) => (
            <div
              key={entry.id}
              role="listitem"
              className={`env-editor-row${entry.deleted ? ' deleted' : ''}${entry.dirty ? ' dirty' : ''}`}
            >
              <span className={`env-editor-type env-editor-type--${entry.type}`}>
                {TYPE_LABELS[entry.type]}
              </span>
              <span className="env-editor-content" title={entry.raw}>
                {entry.type === 'comment' || entry.type === 'blank' || entry.type === 'raw'
                  ? entry.raw || ' '
                  : `${entry.key ?? ''}${entry.value ? ` → ${entry.value}` : ''}`}
              </span>
              <span className="env-editor-actions">
                {EDITABLE_TYPES.includes(entry.type) ? (
                  <>
                    <button
                      type="button"
                      className="env-editor-icon-btn"
                      title={entry.deleted ? '恢复' : '编辑'}
                      onClick={() => openEdit(entry)}
                      disabled={entry.deleted}
                    >
                      {entry.deleted ? <Undo2 aria-hidden="true" /> : <FilePenLine aria-hidden="true" />}
                    </button>
                    <button
                      type="button"
                      className="env-editor-icon-btn danger"
                      title={entry.deleted ? '恢复' : '删除'}
                      onClick={() => toggleDelete(entry)}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </>
                ) : null}
              </span>
            </div>
          ))}
            </div>
          )}
        </>
      )}

      <BusinessDialog
        open={editDraft !== null}
        title={editDraft?.isNew ? '新增条目' : '编辑条目'}
        description="修改后会进入「待应用」清单，点击审阅并应用后才会写入 env。"
        onClose={() => setEditDraft(null)}
        size="sm"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setEditDraft(null)}>取消</button>
            <button type="button" className="btn btn-primary" onClick={saveEdit}>保存到草稿</button>
          </>
        }
      >
        {editDraft ? (
          <div className="env-editor-form">
            <label className="env-editor-field">
              <span>类型</span>
              <select
                value={editDraft.type}
                onChange={(event) => setEditDraft((prev) => prev ? { ...prev, type: event.target.value as EnvEditorEntryType } : prev)}
              >
                {EDITABLE_TYPES.map((type) => (
                  <option key={type} value={type}>{TYPE_LABELS[type]}</option>
                ))}
              </select>
            </label>
            <label className="env-editor-field">
              <span>{editDraft.type === 'variable' ? '变量名' : '键名'}</span>
              <input
                value={editDraft.key}
                onChange={(event) => setEditDraft((prev) => prev ? { ...prev, key: event.target.value } : prev)}
                placeholder={editDraft.type === 'funckey' ? 'F1' : editDraft.type === 'alias' ? 'zc' : 'CDS_SITE'}
              />
            </label>
            <label className="env-editor-field">
              <span>{editDraft.type === 'variable' ? '值（可空）' : '命令'}</span>
              <input
                value={editDraft.value}
                onChange={(event) => setEditDraft((prev) => prev ? { ...prev, value: event.target.value } : prev)}
                placeholder={editDraft.type === 'funckey' ? 'zoom fit' : editDraft.type === 'alias' ? 'zoom center' : '. lib'}
              />
            </label>
          </div>
        ) : null}
      </BusinessDialog>

      <BusinessDialog
        open={preview !== null}
        title="审阅 env 改动"
        description={`共 ${preview?.steps.length ?? 0} 处改动，写入前会自动备份当前 env。`}
        onClose={() => setPreview(null)}
        size="lg"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setPreview(null)}>取消</button>
            <button type="button" className="btn btn-primary" onClick={() => setConfirmApply(true)} disabled={busy}>
              应用这些改动
            </button>
          </>
        }
      >
        <EnvDiffList steps={preview?.steps ?? []} />
      </BusinessDialog>

      <ConfirmDialog
        open={confirmApply}
        title="确认写入 env"
        message="确定要将这些改动写入 env 文件吗？写入后会生成备份并记录变更历史，Allegro 需重启后生效。"
        confirmLabel="写入"
        variant="warning"
        onConfirm={() => void handleApply()}
        onCancel={() => setConfirmApply(false)}
      />

      <BusinessDialog
        open={compareOpen}
        title="对比参考 env"
        description="比较当前用户 env 与参考 env（安装默认 / 站点 / 手动参考）的可编辑条目。"
        onClose={() => setCompareOpen(false)}
        size="lg"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setCompareOpen(false)}>关闭</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!compareResult || compareResult.summary.onlyB === 0}
              onClick={copyMissingToUser}
              title="把参考 env 中有而用户 env 缺失的条目复制进草稿"
            >
              复制缺失项（{compareResult?.summary.onlyB ?? 0}）
            </button>
          </>
        }
      >
        {compareResult ? (
          <div className="env-compare">
            <div className="env-compare-head">
              <label className="env-compare-picker">
                <span>参考来源</span>
                <select
                  value={compareResult.bPath}
                  onChange={(event) => void runCompare(event.target.value)}
                  disabled={compareLoading}
                >
                  {compareSources
                    .filter((source) => source.role !== 'user_env' && source.exists)
                    .map((source) => (
                      <option key={source.id} value={source.path}>{source.displayName}</option>
                    ))}
                </select>
              </label>
              <div className="env-compare-summary">
                <span>仅在用户 {compareResult.summary.onlyA}</span>
                <span>仅在参考 {compareResult.summary.onlyB}</span>
                <span>值不同 {compareResult.summary.different}</span>
              </div>
            </div>
            <EnvCompareList result={compareResult} />
          </div>
        ) : (
          <div className="env-compare-empty">
            {compareLoading ? '正在对比…' : '未找到可对比的参考 env（请确认已检测到安装默认 / 站点 env）。'}
          </div>
        )}
      </BusinessDialog>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </WorkspacePage>
  );
};

function EnvDiffList({ steps }: { steps: EnvEditStep[] }) {
  if (steps.length === 0) {
    return <div className="env-editor-empty-diff">没有改动</div>;
  }
  return (
    <div className="env-editor-diff">
      {steps.map((step, index) => (
        <div key={index} className={`env-editor-diff-step env-editor-diff-step--${step.opType}`}>
          <div className="env-editor-diff-head">
            <span>{step.description}</span>
            <span className={`env-editor-diff-tag env-editor-diff-tag--${step.opType}`}>
              {step.opType === 'add' ? '新增' : step.opType === 'delete' ? '删除' : '修改'}
            </span>
          </div>
          {step.before ? <div className="env-editor-diff-line before">- {step.before}</div> : null}
          <div className="env-editor-diff-line after">+ {step.after}</div>
        </div>
      ))}
    </div>
  );
}

function EnvCompareList({ result }: { result: EnvCompareResult }) {
  if (result.diffs.length === 0) {
    return <div className="env-compare-empty">两份 env 的可编辑条目完全一致。</div>;
  }
  return (
    <div className="env-compare-list">
      {result.diffs.map((diff, index) => (
        <div key={index} className={`env-compare-row env-compare-row--${diff.status}`}>
          <span className={`env-editor-type env-editor-type--${diff.type}`}>{TYPE_LABELS[diff.type]}</span>
          <span className="env-compare-key">{diff.key}</span>
          {diff.status === 'different' ? (
            <span className="env-compare-values">
              <span className="env-compare-a">{diff.aValue}</span>
              <span className="env-compare-arrow">→</span>
              <span className="env-compare-b">{diff.bValue}</span>
            </span>
          ) : (
            <span className="env-compare-values">
              {diff.status === 'only_a' ? diff.aValue : diff.bValue}
            </span>
          )}
          <span className={`env-compare-tag env-compare-tag--${diff.status}`}>
            {diff.status === 'only_a' ? '仅在用户' : diff.status === 'only_b' ? '仅在参考' : '值不同'}
          </span>
        </div>
      ))}
    </div>
  );
}

export default EnvEditorPage;
