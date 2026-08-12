/**
 * ATM - DRC 设计问题报告看板页面
 *
 * 功能（M3-M4）：
 *   1. 导入 Allegro DRC 报告（.rpt / Extracta CSV），预览后落盘
 *   2. 报告列表 + 详情浏览 + 原文回看（定位违规行）
 *   3. 按层 / 网络 / 规则 / 类型分组统计，点击下钻筛选
 *   4. 违规明细表：关键词 / 维度筛选，单条与批量状态标记（只存 ATM）
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Cable, Download, FileUp, MoreHorizontal } from 'lucide-react';
import type {
  DrcBridgeFetchResult,
  DrcExportFormat,
  DrcParseFileResult,
  DrcReport,
  DrcReportSummary,
  DrcStatus,
  DrcViolation,
} from '../types/drc';
import GlobalStatusBar from '../components/GlobalStatusBar';
import ConfirmDialog from '../components/common/ConfirmDialog';
import ToastContainer, { useToast } from '../components/common/Toast';
import DrcReportList from '../components/drc/DrcReportList';
import DrcSummaryCards from '../components/drc/DrcSummaryCards';
import DrcGroupTabs, { type DrcGroupKey } from '../components/drc/DrcGroupTabs';
import DrcViolationTable from '../components/drc/DrcViolationTable';
import DrcImportDialog from '../components/drc/DrcImportDialog';
import DrcRawViewDialog from '../components/drc/DrcRawViewDialog';
import DrcExportDialog from '../components/drc/DrcExportDialog';
import { formatUserError, PageState, WorkspaceHeader, WorkspacePage } from '../shared/ui';
import './drc-page.css';

interface DrcFilter {
  keyword: string;
  layer: string;
  net: string;
  rule: string;
  type: string;
  severity: '' | 'error' | 'warning';
  status: '' | DrcStatus;
}

const EMPTY_FILTER: DrcFilter = {
  keyword: '',
  layer: '',
  net: '',
  rule: '',
  type: '',
  severity: '',
  status: '',
};

function matchKeyword(violation: DrcViolation, keyword: string): boolean {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    violation.rule,
    violation.description,
    violation.layer,
    violation.net,
    violation.component,
    violation.pin,
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(needle);
}

const DrcPage: React.FC = () => {
  const { toasts, addToast, removeToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState<DrcReportSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [report, setReport] = useState<DrcReport | null>(null);
  const [filter, setFilter] = useState<DrcFilter>(EMPTY_FILTER);
  const [groupKey, setGroupKey] = useState<DrcGroupKey>('layer');
  const [importPreview, setImportPreview] = useState<DrcParseFileResult | null>(null);
  const [importFilePath, setImportFilePath] = useState<string | null>(null);
  const [bridgeImport, setBridgeImport] = useState<Pick<DrcBridgeFetchResult, 'rawText' | 'parsed'> | null>(null);
  const [bridgeState, setBridgeState] = useState<{ connected: boolean; message?: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DrcReportSummary | null>(null);
  const [rawView, setRawView] = useState<{ text: string; highlightLine?: number } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const loadReports = useCallback(async (preferId?: string) => {
    if (typeof window.atm === 'undefined') {
      setLoading(false);
      return;
    }
    try {
      const result = await window.atm.drcListReports();
      if (!result.success) {
        addToast('error', formatUserError(result.error, '读取报告列表失败'));
        return;
      }
      const list = result.data ?? [];
      setReports(list);
      const targetId = preferId ?? (list.length > 0 ? list[0].id : null);
      if (targetId) {
        setSelectedId(targetId);
        const detail = await window.atm.drcGetReport(targetId);
        if (detail.success && detail.data) {
          setReport(detail.data);
        }
      } else {
        setSelectedId(null);
        setReport(null);
      }
    } catch (err) {
      addToast('error', formatUserError(err, '加载 DRC 报告失败'));
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  useEffect(() => {
    if (typeof window.atm === 'undefined') return;
    window.atm.drcBridgeProbe()
      .then((result) => {
        if (result.success && result.data) {
          setBridgeState({ connected: !!result.data.connected, message: result.data.message });
        }
      })
      .catch(() => undefined);
  }, []);

  const selectReport = useCallback(async (id: string) => {
    setSelectedId(id);
    setReport(null);
    try {
      const detail = await window.atm.drcGetReport(id);
      if (detail.success && detail.data) {
        setReport(detail.data);
      } else {
        addToast('error', formatUserError(detail.error, '读取报告详情失败'));
      }
    } catch (err) {
      addToast('error', formatUserError(err, '加载报告详情失败'));
    }
  }, [addToast]);

  const handleImport = useCallback(async () => {
    try {
      const picked = await window.atm.drcOpenDialog();
      if (!picked.success || !picked.data) return;
      setBusy(true);
      const parsed = await window.atm.drcParseFile(picked.data);
      if (!parsed.success || !parsed.data) {
        addToast('error', formatUserError(parsed.error, '解析 DRC 报告失败'));
        return;
      }
      setImportFilePath(picked.data);
      setImportPreview(parsed.data);
    } catch (err) {
      addToast('error', formatUserError(err, '导入流程失败'));
    } finally {
      setBusy(false);
    }
  }, [addToast]);

  const handleBridgeFetch = useCallback(async () => {
    setBusy(true);
    try {
      const result = await window.atm.drcBridgeFetch();
      if (!result.success || !result.data || !result.data.connected) {
        addToast('error', formatUserError(result.error, result.data?.message ?? '在线抓取失败'));
        return;
      }
      const data = result.data;
      setBridgeImport({ rawText: data.rawText, parsed: data.parsed });
      setImportPreview({
        fileName: 'Vibe Bridge 在线抓取',
        byteSize: new TextEncoder().encode(data.rawText).length,
        rawHash: data.rawHash,
        parsed: data.parsed,
      });
    } catch (err) {
      addToast('error', formatUserError(err, '在线抓取失败'));
    } finally {
      setBusy(false);
    }
  }, [addToast]);

  const confirmImport = useCallback(async () => {
    setBusy(true);
    try {
      const result = bridgeImport
        ? await window.atm.drcBridgeImport({ rawText: bridgeImport.rawText, parsed: bridgeImport.parsed })
        : importFilePath
          ? await window.atm.drcImportReport({ filePath: importFilePath })
          : null;
      if (!result) return;
      if (!result.success || !result.data) {
        addToast('error', formatUserError(result.error, '导入 DRC 报告失败'));
        return;
      }
      addToast(
        result.data.duplicate ? 'warning' : 'success',
        result.data.duplicate
          ? '报告内容与已有报告相同，未重复导入。'
          : `已导入报告「${result.data.report.name}」。`,
      );
      setImportPreview(null);
      setImportFilePath(null);
      setBridgeImport(null);
      await loadReports(result.data.report.id);
    } catch (err) {
      addToast('error', formatUserError(err, '导入流程失败'));
    } finally {
      setBusy(false);
    }
  }, [addToast, bridgeImport, importFilePath, loadReports]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      const result = await window.atm.drcDeleteReport(deleteTarget.id);
      if (!result.success) {
        addToast('error', formatUserError(result.error, '删除报告失败'));
        return;
      }
      addToast('success', `已删除报告「${deleteTarget.name}」。`);
      setDeleteTarget(null);
      if (selectedId === deleteTarget.id) {
        setSelectedId(null);
        setReport(null);
      }
      await loadReports();
    } catch (err) {
      addToast('error', formatUserError(err, '删除流程失败'));
    }
  }, [addToast, deleteTarget, loadReports, selectedId]);

  const updateStatus = useCallback(async (violation: DrcViolation, status: DrcStatus) => {
    if (!report) return;
    try {
      const result = await window.atm.drcUpdateStatus({
        reportId: report.id,
        violationIds: [violation.id],
        status,
      });
      if (result.success && result.data) {
        setReport(result.data.report);
        setReports((prev) => prev.map((item) => (
          item.id === report.id
            ? { ...item, summary: result.data!.report.summary }
            : item
        )));
      } else {
        addToast('error', formatUserError(result.error, '更新状态失败'));
      }
    } catch (err) {
      addToast('error', formatUserError(err, '更新状态失败'));
    }
  }, [addToast, report]);

  const filteredViolations = useMemo(() => {
    if (!report) return [];
    return report.violations.filter((v) => {
      if (!matchKeyword(v, filter.keyword)) return false;
      if (filter.layer && v.layer !== filter.layer) return false;
      if (filter.net && v.net !== filter.net) return false;
      if (filter.rule && v.rule !== filter.rule) return false;
      if (filter.type && v.constraintType !== filter.type && v.category !== filter.type) return false;
      if (filter.severity && v.severity !== filter.severity) return false;
      if (filter.status && v.status !== filter.status) return false;
      return true;
    });
  }, [filter, report]);

  const batchUpdateStatus = useCallback(async (status: DrcStatus) => {
    if (!report || filteredViolations.length === 0) return;
    setBusy(true);
    try {
      const result = await window.atm.drcUpdateStatus({
        reportId: report.id,
        violationIds: filteredViolations.map((v) => v.id),
        status,
      });
      if (result.success && result.data) {
        setReport(result.data.report);
        addToast('success', `已将 ${filteredViolations.length} 条标记为「${status === 'resolved' ? '已解决' : status === 'ignored' ? '已忽略' : '未处理'}」。`);
      } else {
        addToast('error', formatUserError(result.error, '批量更新状态失败'));
      }
    } catch (err) {
      addToast('error', formatUserError(err, '批量更新失败'));
    } finally {
      setBusy(false);
    }
  }, [addToast, filteredViolations, report]);

  const openRaw = useCallback(async (highlightLine?: number) => {
    if (!report) return;
    try {
      const result = await window.atm.drcGetRaw(report.id);
      if (result.success && result.data) {
        setRawView({ text: result.data.text, highlightLine });
      } else {
        addToast('error', formatUserError(result.error, '读取原始报告失败'));
      }
    } catch (err) {
      addToast('error', formatUserError(err, '读取原文失败'));
    }
  }, [addToast, report]);

  const handleExport = useCallback(async (format: DrcExportFormat) => {
    if (!report) return;
    setBusy(true);
    try {
      const result = await window.atm.drcExportReport({
        reportId: report.id,
        format,
        violationIds: filteredViolations.map((v) => v.id),
      });
      if (!result.success) {
        addToast('error', formatUserError(result.error, '导出失败'));
        return;
      }
      if (result.data) {
        addToast('success', `已导出 ${result.data.count} 条违规到 ${result.data.filePath}`);
      }
      setExportOpen(false);
    } catch (err) {
      addToast('error', formatUserError(err, '导出失败'));
    } finally {
      setBusy(false);
    }
  }, [addToast, filteredViolations, report]);

  const toggleGroupPick = useCallback((key: DrcGroupKey, name: string) => {
    setFilter((prev) => {
      const next = { ...prev };
      next.layer = '';
      next.net = '';
      next.rule = '';
      next.type = '';
      if (key === 'layer') next.layer = prev.layer === name ? '' : name;
      else if (key === 'net') next.net = prev.net === name ? '' : name;
      else if (key === 'rule') next.rule = prev.rule === name ? '' : name;
      else next.type = prev.type === name ? '' : name;
      return next;
    });
  }, []);

  const hasFilter = filter.keyword !== ''
    || filter.layer !== ''
    || filter.net !== ''
    || filter.rule !== ''
    || filter.type !== ''
    || filter.severity !== ''
    || filter.status !== '';

  const statusItems = [
    { label: '报告', value: String(reports.length), status: 'muted' as const },
    {
      label: 'Bridge',
      value: bridgeState ? (bridgeState.connected ? '已连接' : '未连接') : '检测中',
      status: bridgeState ? (bridgeState.connected ? 'ok' as const : 'muted' as const) : 'muted' as const,
      tooltip: bridgeState?.message,
    },
    { label: '待处理', value: report ? String(report.summary.total - report.summary.resolved - report.summary.ignored) : '0', status: report && report.summary.errors > 0 ? 'warning' as const : 'ok' as const },
    { label: '错误', value: report ? String(report.summary.errors) : '0', status: report && report.summary.errors > 0 ? 'error' as const : 'ok' as const },
    { label: '已解决', value: report ? String(report.summary.resolved) : '0', status: 'ok' as const },
  ];

  const activeGroupName = filter.layer || filter.net || filter.rule || filter.type || null;

  return (
    <WorkspacePage className="drc-page">
      <WorkspaceHeader
        eyebrow="Design Rules Check"
        title="DRC 看板"
        description="导入或抓取 DRC 报告，按层 / 网络 / 规则分组统计，跟踪问题解决状态。"
        actions={
          <>
            <button type="button" className="ui-button ui-button--primary" onClick={() => void handleImport()} disabled={busy}>
              <FileUp aria-hidden="true" /> 导入报告
            </button>
            <button type="button" className="ui-button drc-fetch-button" onClick={() => void handleBridgeFetch()} disabled={busy}>
              <Cable aria-hidden="true" /> 在线抓取
            </button>
          </>
        }
      />
      <GlobalStatusBar items={statusItems} />

      <div className="drc-toolbar">
        <span className="drc-toolbar-title">报告管理</span>
        <button
          type="button"
          className="ui-button drc-toolbar-more"
          onClick={() => { if (report) setDeleteTarget(reports.find((r) => r.id === report.id) ?? null); }}
          disabled={!report}
          title="删除当前报告"
        >
          <MoreHorizontal aria-hidden="true" /> 更多
        </button>
      </div>

      {loading ? (
        <PageState kind="loading" title="正在加载 DRC 报告" />
      ) : (
        <div className="drc-layout">
          <aside className="drc-sidebar">
            <DrcReportList
              reports={reports}
              selectedId={selectedId}
              onSelect={(id) => void selectReport(id)}
              onDelete={(id) => setDeleteTarget(reports.find((r) => r.id === id) ?? null)}
            />
          </aside>
          <section className="drc-detail">
            {!report ? (
              <PageState
                kind="empty"
                title="暂无 DRC 报告"
                description="点击「导入报告」选择 Allegro 导出的 DRC 报告文件开始分析。"
              />
            ) : (
              <>
                <div className="drc-detail-head">
                  <div>
                    <h2>{report.name}</h2>
                    <p>
                      {report.designName ?? '未知设计'}
                      {report.allegroVersion ? ` · ${report.allegroVersion}` : ''}
                      {report.units ? ` · ${report.units}` : ''}
                    </p>
                  </div>
                  <div className="drc-detail-actions">
                    <button
                      type="button"
                      className="ui-button"
                      onClick={() => setExportOpen(true)}
                      disabled={report.violations.length === 0}
                    >
                      <Download aria-hidden="true" /> 导出
                    </button>
                    <button type="button" className="ui-button" onClick={() => void openRaw()}>
                      查看原文
                    </button>
                  </div>
                </div>

                <DrcSummaryCards summary={report.summary} />

                <div className="drc-group-and-filter">
                  <DrcGroupTabs
                    groupKey={groupKey}
                    summary={report.summary}
                    activeName={activeGroupName}
                    onChange={setGroupKey}
                    onPick={(name) => toggleGroupPick(groupKey, name)}
                  />
                  <div className="drc-filter-panel">
                    <input
                      className="drc-filter-input"
                      placeholder="搜索规则 / 描述 / 层 / 网络 / 元件…"
                      value={filter.keyword}
                      onChange={(event) => setFilter((prev) => ({ ...prev, keyword: event.target.value }))}
                    />
                    <select
                      className="drc-filter-select"
                      aria-label="按严重度筛选"
                      value={filter.severity}
                      onChange={(event) => setFilter((prev) => ({ ...prev, severity: event.target.value as DrcFilter['severity'] }))}
                    >
                      <option value="">全部严重度</option>
                      <option value="error">错误</option>
                      <option value="warning">警告</option>
                    </select>
                    <select
                      className="drc-filter-select"
                      aria-label="按状态筛选"
                      value={filter.status}
                      onChange={(event) => setFilter((prev) => ({ ...prev, status: event.target.value as DrcFilter['status'] }))}
                    >
                      <option value="">全部状态</option>
                      <option value="unresolved">未处理</option>
                      <option value="resolved">已解决</option>
                      <option value="ignored">已忽略</option>
                    </select>
                    {hasFilter ? (
                      <button
                        type="button"
                        className="drc-filter-clear"
                        onClick={() => setFilter(EMPTY_FILTER)}
                      >
                        清除筛选
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="drc-table-header">
                  <span>明细（{filteredViolations.length} / {report.violations.length}）</span>
                  <div className="drc-batch-actions">
                    <button type="button" className="ui-button" disabled={filteredViolations.length === 0 || busy} onClick={() => void batchUpdateStatus('resolved')}>
                      批量标记已解决
                    </button>
                    <button type="button" className="ui-button" disabled={filteredViolations.length === 0 || busy} onClick={() => void batchUpdateStatus('ignored')}>
                      批量忽略
                    </button>
                  </div>
                </div>

                <DrcViolationTable
                  violations={filteredViolations}
                  onStatusChange={(v, status) => void updateStatus(v, status)}
                  onInspect={(v) => void openRaw(v.sourceLine || undefined)}
                />
              </>
            )}
          </section>
        </div>
      )}

      <DrcImportDialog
        preview={importPreview}
        busy={busy}
        onConfirm={() => void confirmImport()}
        onClose={() => { setImportPreview(null); setImportFilePath(null); setBridgeImport(null); }}
      />

      <DrcRawViewDialog
        open={rawView !== null}
        text={rawView?.text ?? ''}
        highlightLine={rawView?.highlightLine}
        onClose={() => setRawView(null)}
      />

      <DrcExportDialog
        open={exportOpen}
        count={filteredViolations.length}
        busy={busy}
        onExport={(format) => void handleExport(format)}
        onClose={() => setExportOpen(false)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除 DRC 报告"
        message={deleteTarget ? `确定删除「${deleteTarget.name}」吗？原始文件与状态标注将一并删除，此操作不可撤销。` : ''}
        confirmLabel="删除"
        variant="danger"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </WorkspacePage>
  );
};

export default DrcPage;
