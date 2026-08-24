/**
 * ATM - 原理图 / 电源树页面
 *
 * 目标：选择 OrCAD / PDF 原理图，生成电源树与硬件框图。
 * 当前（P3a+P4）：路由骨架 + 只读电源树可视化（演示数据）+ SVG/PNG/PDF 导出。
 * 待办：OrCAD COM 抽取层 + IPC 接线（依赖 P0 spike 结果）。
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Download, Zap } from 'lucide-react';
import { buildPowerTree } from '../../core/schematic/powerTreeBuilder';
import GlobalStatusBar from '../components/GlobalStatusBar';
import PowerTreeView from '../components/PowerTreeView';
import ToastContainer, { useToast } from '../components/common/Toast';
import { formatUserError, PageState, WorkspaceHeader, WorkspacePage } from '../shared/ui';
import type { PowerTree, SchematicExportFormat } from '../types/schematic';
import { demoSchematic } from './schematic/demoDesign';
import './schematic-page.css';

const EXPORT_FORMATS: SchematicExportFormat[] = ['svg', 'png', 'pdf'];

const SchematicPage: React.FC = () => {
  const { toasts, addToast, removeToast } = useToast();
  const [tree, setTree] = useState<PowerTree | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const generate = useCallback(() => {
    setBusy(true);
    try {
      // 演示：直接对内置 IR 运行算法；真实数据将走 OrCAD COM → IPC。
      setTree(buildPowerTree(demoSchematic()));
    } finally {
      setBusy(false);
    }
  }, []);

  const exportTree = useCallback(
    async (format: SchematicExportFormat) => {
      if (!tree) return;
      setExporting(true);
      try {
        const res = await window.atm.schematicExport({ tree, format });
        if (res.success && res.data) {
          addToast('success', `已导出：${res.data.filePath}`);
        } else if (res.success) {
          addToast('info', '已取消导出。');
        } else {
          addToast('error', formatUserError(res.error, '导出失败'));
        }
      } catch (err) {
        addToast('error', formatUserError(err, '导出失败'));
      } finally {
        setExporting(false);
      }
    },
    [tree, addToast],
  );

  const statusItems = useMemo(() => {
    if (!tree) {
      return [{ label: '状态', value: '未生成', status: 'muted' as const }];
    }
    const warningCount = tree.warnings.length;
    return [
      { label: '电压轨', value: `${tree.rails.length}`, status: 'ok' as const },
      { label: '电源 IC', value: `${tree.converters.length}`, status: 'ok' as const },
      { label: '负载', value: `${tree.loads.length}`, status: 'ok' as const },
      {
        label: '告警',
        value: `${warningCount}`,
        status: warningCount > 0 ? ('warning' as const) : ('muted' as const),
      },
    ];
  }, [tree]);

  return (
    <WorkspacePage className="schematic-page">
      <WorkspaceHeader
        eyebrow="Schematic"
        title="电源树"
        description="选择 OrCAD 或 PDF 原理图，自动识别电源网络与电源 IC，生成可编辑的电源树与硬件框图。"
        actions={
          <>
            <button type="button" className="btn btn-primary" onClick={generate} disabled={busy}>
              <Zap aria-hidden="true" /> {busy ? '生成中…' : '生成示例电源树'}
            </button>
            {tree &&
              EXPORT_FORMATS.map((format) => (
                <button
                  key={format}
                  type="button"
                  className="btn"
                  onClick={() => void exportTree(format)}
                  disabled={exporting}
                >
                  <Download aria-hidden="true" /> 导出 {format.toUpperCase()}
                </button>
              ))}
          </>
        }
      />
      <GlobalStatusBar items={statusItems} />

      {!tree ? (
        <PageState
          kind="empty"
          title="尚未生成电源树"
          description="点击「生成示例电源树」预览效果；OrCAD / PDF 导入将在抽取层就绪后开放。"
        />
      ) : (
        <div className="schematic-body">
          <div className="schematic-canvas">
            <PowerTreeView tree={tree} />
          </div>

          {tree.warnings.length > 0 && (
            <section className="schematic-panel">
              <h2 className="schematic-panel-title">识别提示（{tree.warnings.length}）</h2>
              <ul className="schematic-warnings">
                {tree.warnings.map((w, i) => (
                  <li key={i} className={`schematic-warning schematic-warning--${w.severity}`}>
                    {w.message}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </WorkspacePage>
  );
};

export default SchematicPage;
