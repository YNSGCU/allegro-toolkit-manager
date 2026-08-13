/**
 * ATM - DRC 看板页面组件测试
 * 测试场景：
 *   1. 报告列表 + 详情 + 摘要卡 + 明细表渲染
 *   2. 空列表空状态
 *   3. 关键词 / 严重度 / 状态筛选
 *   4. 单条与批量状态更新
 *   5. 分组 Tab 下钻
 *   6. 原文回看定位
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DrcPage from '../src/pages/DrcPage';
import { parseDrcReport } from '../core/drc/drcReportParser';
import { buildSummary } from '../core/drc/drcStats';
import type { DrcReport, DrcReportSummary } from '../src/types/drc';

const FIXTURES_DIR = path.join(__dirname, '..', 'test-fixtures', 'drc');

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}

function buildReport(id: string, name: string, content: string): DrcReport {
  const parsed = parseDrcReport(content);
  return {
    ...parsed,
    id,
    name,
    sourceType: 'file',
    importedAt: '2026-08-12T08:00:00.000Z',
    rawHash: 'a'.repeat(64),
  };
}

function toSummary(report: DrcReport): DrcReportSummary {
  return {
    id: report.id,
    name: report.name,
    sourceType: report.sourceType,
    format: report.format,
    designName: report.designName,
    allegroVersion: report.allegroVersion,
    units: report.units,
    exportedAt: report.exportedAt,
    importedAt: report.importedAt,
    rawHash: report.rawHash,
    summary: report.summary,
  };
}

const basicReport = buildReport('drc_basic', 'DRC Report', readFixture('drc.basic.rpt'));
const basicSummary = toSummary(basicReport);

function mockAtm(options?: {
  reports?: DrcReportSummary[];
  getReport?: (id: string) => Promise<{ success: boolean; data?: DrcReport; error?: string }>;
}) {
  const reports = options?.reports ?? [basicSummary];
  const getReport = options?.getReport ?? vi.fn().mockResolvedValue({ success: true, data: basicReport });
  Object.defineProperty(window, 'atm', {
    writable: true,
    configurable: true,
    value: {
      drcListReports: vi.fn().mockResolvedValue({ success: true, data: reports }),
      drcGetReport: getReport,
      drcBridgeProbe: vi.fn().mockResolvedValue({ success: true, data: { connected: false, message: '未连接' } }),
      drcBridgeFetch: vi.fn().mockResolvedValue({ success: false, error: '未连接' }),
      drcBridgeImport: vi.fn().mockResolvedValue({ success: true, data: { report: basicReport, duplicate: false } }),
      drcGetRaw: vi.fn().mockResolvedValue({ success: true, data: { id: 'drc_basic', text: readFixture('drc.basic.rpt') } }),
      drcOpenDialog: vi.fn().mockResolvedValue({ success: true, data: null }),
      drcParseFile: vi.fn().mockResolvedValue({ success: true, data: null }),
      drcImportReport: vi.fn().mockResolvedValue({ success: true, data: null }),
      drcDeleteReport: vi.fn().mockResolvedValue({ success: true, data: { id: 'drc_basic' } }),
      drcUpdateStatus: vi.fn().mockImplementation(async (input: { reportId: string; violationIds: string[]; status: string }) => {
        const next: DrcReport = {
          ...basicReport,
          violations: basicReport.violations.map((v) => (
            input.violationIds.includes(v.id) ? { ...v, status: input.status as DrcReport['violations'][number]['status'] } : v
          )),
        };
        next.summary = buildSummary(next.violations);
        return { success: true, data: { report: next } };
      }),
    },
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('DrcPage - 渲染', () => {
  it('应渲染报告列表、摘要卡与违规明细表', async () => {
    mockAtm();
    const { container } = render(<DrcPage />);

    await waitFor(() => {
      expect(container.querySelector('.drc-list-item')).not.toBeNull();
    });

    expect(screen.getByRole('heading', { name: 'DRC 看板' })).toBeInTheDocument();
    expect(screen.getAllByText('DRC Report').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.drc-summary-card')).toHaveLength(5);
    expect(container.querySelector('.drc-summary-card--error .drc-summary-card-value')?.textContent).toBe('3');
    expect(container.querySelector('.drc-summary-card--warning .drc-summary-card-value')?.textContent).toBe('1');
    expect(container.querySelectorAll('.drc-table tbody tr')).toHaveLength(4);
    expect(container.querySelector('.drc-cell-rule')?.textContent).toBe('SPMHCS-1');
  });

  it('空列表应显示空状态', async () => {
    mockAtm({ reports: [] });
    const { container } = render(<DrcPage />);

    await waitFor(() => {
      expect(container.querySelector('.drc-list-empty')).not.toBeNull();
    });
    expect(screen.getByText('还没有 DRC 报告')).toBeInTheDocument();
    expect(container.querySelector('.drc-table')).toBeNull();
  });
});

describe('DrcPage - 筛选与分组', () => {
  it('关键词筛选应过滤明细行', async () => {
    mockAtm();
    const { container } = render(<DrcPage />);
    await waitFor(() => {
      expect(container.querySelectorAll('.drc-table tbody tr')).toHaveLength(4);
    });

    const search = container.querySelector('.drc-filter-input') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'VCC' } });
    expect(container.querySelectorAll('.drc-table tbody tr')).toHaveLength(2);

    fireEvent.change(search, { target: { value: '' } });
    expect(container.querySelectorAll('.drc-table tbody tr')).toHaveLength(4);
  });

  it('按网络分组点击应下钻筛选并显示"清除筛选"', async () => {
    mockAtm();
    const { container } = render(<DrcPage />);
    await waitFor(() => {
      expect(container.querySelector('.drc-group-tab')).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('tab', { name: '按网络' }));
    const vccRow = [...container.querySelectorAll('.drc-group-row')].find(
      (row) => row.querySelector('.drc-group-name')?.textContent === 'VCC',
    ) as HTMLElement;
    expect(vccRow).toBeDefined();
    fireEvent.click(vccRow);

    expect(container.querySelectorAll('.drc-table tbody tr')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '清除筛选' })).toBeInTheDocument();
  });

  it('严重度筛选应只保留错误', async () => {
    mockAtm();
    const { container } = render(<DrcPage />);
    await waitFor(() => {
      expect(container.querySelectorAll('.drc-table tbody tr')).toHaveLength(4);
    });

    const selects = container.querySelectorAll('.drc-filter-select');
    const severitySelect = selects[0] as HTMLSelectElement;
    fireEvent.change(severitySelect, { target: { value: 'error' } });
    expect(container.querySelectorAll('.drc-table tbody tr')).toHaveLength(3);
  });

  it('按类型下钻「未分类」应保留无约束类型的违规', async () => {
    const mixedReport: DrcReport = {
      ...buildReport('drc_mixed', 'Mixed', readFixture('drc.basic.rpt')),
    };
    mixedReport.violations[0].constraintType = undefined;
    mixedReport.violations[0].category = undefined;
    mixedReport.summary = buildSummary(mixedReport.violations);

    mockAtm({
      reports: [toSummary(mixedReport)],
      getReport: vi.fn().mockResolvedValue({ success: true, data: mixedReport }),
    });
    const { container } = render(<DrcPage />);
    await waitFor(() => {
      expect(container.querySelectorAll('.drc-table tbody tr')).toHaveLength(4);
    });

    fireEvent.click(screen.getByRole('tab', { name: '按类型' }));
    const uncategorizedRow = [...container.querySelectorAll('.drc-group-row')].find(
      (row) => row.querySelector('.drc-group-name')?.textContent === '未分类',
    ) as HTMLElement;
    expect(uncategorizedRow).toBeDefined();
    fireEvent.click(uncategorizedRow);

    expect(container.querySelectorAll('.drc-table tbody tr')).toHaveLength(1);
    expect(container.querySelector('.drc-cell-rule')?.textContent).toBe('SPMHCS-1');
  });
});

describe('DrcPage - 状态跟踪', () => {
  it('单条状态修改应调用 drcUpdateStatus', async () => {
    mockAtm();
    const { container } = render(<DrcPage />);
    await waitFor(() => {
      expect(container.querySelectorAll('.drc-table tbody tr')).toHaveLength(4);
    });

    const firstRow = container.querySelector('.drc-table tbody tr') as HTMLElement;
    const statusSelect = within(firstRow).getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: 'resolved' } });

    await waitFor(() => {
      expect(window.atm.drcUpdateStatus).toHaveBeenCalledWith(
        expect.objectContaining({ reportId: 'drc_basic', status: 'resolved' }),
      );
    });
  });

  it('批量标记应调用 drcUpdateStatus 并更新摘要', async () => {
    mockAtm();
    const { container } = render(<DrcPage />);
    await waitFor(() => {
      expect(container.querySelectorAll('.drc-table tbody tr')).toHaveLength(4);
    });

    fireEvent.click(screen.getByRole('button', { name: '批量标记已解决' }));

    await waitFor(() => {
      expect(window.atm.drcUpdateStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'resolved' }),
      );
    });
    expect(container.querySelector('.drc-summary-card--ok .drc-summary-card-value')?.textContent).toBe('4');
  });
});

describe('DrcPage - 原文回看', () => {
  it('点击位置链接应打开原文弹窗并定位行号', async () => {
    mockAtm();
    const { container } = render(<DrcPage />);
    await waitFor(() => {
      expect(container.querySelector('.drc-location-link')).not.toBeNull();
    });

    fireEvent.click(container.querySelector('.drc-location-link') as HTMLElement);

    await waitFor(() => {
      expect(window.atm.drcGetRaw).toHaveBeenCalledWith('drc_basic');
      expect(screen.getByRole('heading', { name: '原始报告' })).toBeInTheDocument();
    });
    expect(container.querySelectorAll('.drc-raw-line.highlighted')).toHaveLength(1);
  });
});

describe('DrcPage - Bridge 在线抓取', () => {
  it('抓取成功后显示预览并可确认导入', async () => {
    const bridgeParsed = { ...basicReport, format: 'bridge' as const, name: 'DRC 报告（4 条）' };
    mockAtm({
      reports: [],
      getReport: vi.fn().mockResolvedValue({ success: true, data: basicReport }),
    });
    window.atm.drcBridgeFetch = vi.fn().mockResolvedValue({
      success: true,
      data: {
        connected: true,
        total: 4,
        rawHash: 'c'.repeat(64),
        rawText: 'SUCCESS 4\nR|SPMHCS-1|ERROR|0|3|TOP|VCC|U1|5|1|2|nil|nil',
        parsed: bridgeParsed,
      },
    });

    const { container } = render(<DrcPage />);
    await waitFor(() => {
      expect(container.querySelector('.drc-list-empty')).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: '在线抓取' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '导入 DRC 报告' })).toBeInTheDocument();
    });
    expect(screen.getByText('Vibe Bridge 在线抓取')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '确认导入' }));

    await waitFor(() => {
      expect(window.atm.drcBridgeImport).toHaveBeenCalledWith(
        expect.objectContaining({ rawText: expect.stringContaining('SUCCESS') }),
      );
    });
  });
});
