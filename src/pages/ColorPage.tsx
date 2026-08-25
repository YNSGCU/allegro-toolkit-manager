/**
 * ATM - 配色方案页面
 *
 * 功能：
 *   1. 从当前打开的 Allegro 板子捕获配色（调色板 + 全图层颜色/可见性）
 *   2. 可视化展示调色板与图层颜色分配
 *   3. 在另一块板子中应用已保存的配色方案（经 Apply 确认）
 *   4. 与 Allegro .col 文件互导
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera, Eye, RefreshCw } from 'lucide-react';
import type {
  ColorBridgeStatus,
  ColorLayerEntry,
  ColorPaletteEntry,
  ColorRgb,
  ColorScheme,
  ColorSchemeSnapshot,
  ColorSchemeStore,
} from '../types/color';
import type { ColorApplyPreview } from '../../core/color/vibeColorBridge';
import type { BridgeSetupSummary } from '../../core/color/vibeBridgeInstaller';
import {
  createCustomLayerColorPlan,
  createDefaultPalette,
  hexToRgb,
} from '../../core/color/colorPalette';
import ProfileBar from '../components/ProfileBar';
import GlobalStatusBar from '../components/GlobalStatusBar';
import MoreActionsMenu, { type ActionItem } from '../components/MoreActionsMenu';
import BusinessDialog from '../shared/ui/overlays/BusinessDialog';
import ToastContainer, { useToast } from '../components/common/Toast';
import { formatUserError, WorkspaceHeader, WorkspacePage } from '../shared/ui';
import ApplyPlanDialog, { type ApplyPlanViewModel } from '../shared/ui/overlays/ApplyPlanDialog';
import ColorPaletteGrid from '../components/color/ColorPaletteGrid';
import ColorLayerList from '../components/color/ColorLayerList';
import ColorApplyPreviewDialog from '../components/color/ColorApplyPreviewDialog';
import './color-page.css';

const ColorPage: React.FC = () => {
  const { toasts, addToast, removeToast } = useToast();

  const [store, setStore] = useState<ColorSchemeStore | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<ColorBridgeStatus | null>(null);
  const [bridgeSetup, setBridgeSetup] = useState<BridgeSetupSummary | null>(null);
  const [bridgeEnablePlan, setBridgeEnablePlan] = useState<ApplyPlanViewModel | null>(null);
  const [bridgeEnabling, setBridgeEnabling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [applying, setApplying] = useState(false);

  // 捕获后命名
  const [captureDialogOpen, setCaptureDialogOpen] = useState(false);
  const [captureSnapshot, setCaptureSnapshot] = useState<ColorSchemeSnapshot | null>(null);
  const [captureName, setCaptureName] = useState('');

  // 应用确认
  const [applyPreviewOpen, setApplyPreviewOpen] = useState(false);
  const [applyPreview, setApplyPreview] = useState<ColorApplyPreview | null>(null);
  const [applyPreviewLoading, setApplyPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applyVisibility, setApplyVisibility] = useState(false);
  const [lastApplyResult, setLastApplyResult] = useState<{
    schemeName: string;
    appliedLayerCount: number;
    skippedLayerCount: number;
    skippedLayers?: string[];
    undoSnapshotId?: string;
    mode?: 'apply' | 'live-preview';
  } | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const activeScheme = useMemo<ColorScheme | null>(() => {
    if (!store) return null;
    return (
      store.schemes.find((scheme) => scheme.id === store.activeSchemeId) ??
      store.schemes[0] ??
      null
    );
  }, [store]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [schemesRes, bridgeRes, setupRes] = await Promise.all([
        window.atm.colorLoadSchemes(),
        window.atm.colorCheckBridge(),
        window.atm.colorCheckBridgeSetup(),
      ]);
      if (schemesRes.success && schemesRes.data) {
        setStore(schemesRes.data);
      } else if (schemesRes.error) {
        addToast('error', schemesRes.error);
      }
      if (bridgeRes.success && bridgeRes.data) {
        setBridgeStatus(bridgeRes.data);
      }
      if (setupRes.success && setupRes.data) {
        setBridgeSetup(setupRes.data);
      }
    } catch (err) {
      addToast('error', formatUserError(err, '操作失败'));
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // ===== 捕获 =====
  // ===== 安装/启用桥接 =====
  const handleBridgeInstall = async () => {
    try {
      const res = await window.atm.colorInstallBridge();
      if (!res.success || !res.data) {
        addToast('error', res.error || '安装 Vibe Bridge 失败');
        return;
      }
      const created: string[] = [];
      if (res.data.serverCreated) created.push('vibe_server.il');
      if (res.data.workspaceCreated) created.push('workspace 目录');
      if (res.data.enablePlan) {
        // 安装完成后自动进入「启用桥接」确认，换电脑时一步到位
        addToast('success', created.length > 0
          ? `已安装 Vibe Bridge（新增 ${created.join('、')}），请确认启用自动加载`
          : 'Vibe Bridge 已就位，请确认启用自动加载');
        setBridgeEnablePlan(res.data.enablePlan as ApplyPlanViewModel);
      } else {
        addToast('success', created.length > 0
          ? `已安装 Vibe Bridge（新增 ${created.join('、')}）`
          : 'Vibe Bridge 已就位');
        await reload();
      }
    } catch (err) {
      addToast('error', formatUserError(err, '安装 Vibe Bridge 失败'));
    }
  };

  const handleBridgeEnable = async () => {
    try {
      const res = await window.atm.colorCreateBridgeEnablePlan();
      if (!res.success) {
        addToast('error', res.error || '启用桥接失败');
        return;
      }
      if (!res.data) {
        addToast('info', res.info || '桥接已配置，无需重复启用');
        return;
      }
      setBridgeEnablePlan(res.data);
    } catch (err) {
      addToast('error', formatUserError(err, '启用桥接失败'));
    }
  };

  const handleBridgeEnableConfirm = async () => {
    if (!bridgeEnablePlan) return;
    setBridgeEnabling(true);
    try {
      const res = await window.atm.colorExecuteBridgeEnablePlan(JSON.stringify(bridgeEnablePlan));
      if (res.success) {
        addToast('success', '已启用 Vibe Bridge 自动加载，请重启 Allegro 使其生效');
        setBridgeEnablePlan(null);
        await reload();
      } else {
        addToast('error', res.error || '启用失败');
      }
    } catch (err) {
      addToast('error', formatUserError(err, '启用失败'));
    } finally {
      setBridgeEnabling(false);
    }
  };

  const handleCapture = async () => {
    setCapturing(true);
    try {
      const res = await window.atm.colorCapture();
      if (!res.success || !res.data) {
        addToast('error', res.error || '捕获配色失败');
        return;
      }
      const boardName = res.data.snapshot.source?.boardName;
      const today = new Date().toLocaleDateString('zh-CN');
      setCaptureName(boardName ? `${boardName} 配色` : `配色方案 ${today}`);
      setCaptureSnapshot(res.data.snapshot);
      setCaptureDialogOpen(true);
    } catch (err) {
      addToast('error', formatUserError(err, '操作失败'));
    } finally {
      setCapturing(false);
    }
  };

  const handleCaptureSave = async () => {
    if (!captureSnapshot) return;
    const res = await window.atm.colorCreateScheme(
      captureSnapshot,
      captureName || '未命名配色方案',
      '从 Allegro 捕获',
    );
    if (res.success && res.data) {
      addToast('success', `已保存方案「${res.data.name}」`);
      setCaptureDialogOpen(false);
      setCaptureSnapshot(null);
      await reload();
    } else {
      addToast('error', res.error || '保存方案失败');
    }
  };

  // ===== 应用 =====
  const handleApplyOpen = async () => {
    if (!activeScheme) return;
    setApplyPreviewLoading(true);
    setApplyPreviewOpen(true);
    setApplyPreview(null);
    try {
      const res = await window.atm.colorApplyPreview(activeScheme.id, applyVisibility);
      if (res.success && res.data) {
        setApplyPreview(res.data.preview);
      } else {
        addToast('error', res.error || '生成应用预览失败');
        setApplyPreviewOpen(false);
      }
    } catch (err) {
      addToast('error', formatUserError(err, '生成应用预览失败'));
      setApplyPreviewOpen(false);
    } finally {
      setApplyPreviewLoading(false);
    }
  };

  const handleApplyConfirm = async () => {
    if (!activeScheme) return;
    setApplying(true);
    setApplyPreviewOpen(false);
    try {
      const res = await window.atm.colorApply(activeScheme.id, applyVisibility);
      if (res.success && res.data) {
        const { result, schemeName, sourceAllegroVersion, targetAllegroVersion, undoSnapshotId } = res.data;
        setLastApplyResult({
          schemeName,
          appliedLayerCount: result.appliedLayerCount,
          skippedLayerCount: result.skippedLayerCount,
          skippedLayers: result.skippedLayers,
          undoSnapshotId,
          mode: 'apply',
        });
        const versionNote =
          sourceAllegroVersion && targetAllegroVersion && sourceAllegroVersion !== targetAllegroVersion
            ? `（来源 ${sourceAllegroVersion} → 目标 ${targetAllegroVersion}）`
            : '';
        const skippedText = result.skippedLayerCount > 0
          ? `，${result.skippedLayerCount} 个图层在目标板子中不存在已跳过`
          : '';
        const roleText = result.roleSummary
          ? `（顶层 ${result.roleSummary.top} · 底层 ${result.roleSummary.bottom} · 平面层 ${result.roleSummary.plane} · 内部信号层 ${result.roleSummary.inner}）`
          : '';
        addToast('success', `已应用「${schemeName}」：${result.appliedLayerCount} 个图层已设置${skippedText}${versionNote}${roleText}`);
      } else {
        addToast('error', res.error || '应用配色失败');
      }
    } catch (err) {
      addToast('error', formatUserError(err, '操作失败'));
    } finally {
      setApplying(false);
    }
  };

  const handleUndoApply = async () => {
    if (!lastApplyResult?.undoSnapshotId) return;
    setUndoing(true);
    try {
      const res = await window.atm.colorUndoApply(lastApplyResult.undoSnapshotId);
      if (res.success && res.data) {
        addToast('success', `已撤销「${lastApplyResult.schemeName}」，恢复应用前的板子配色`);
        setLastApplyResult(null);
      } else {
        addToast('error', res.error || '撤销配色失败');
      }
    } catch (err) {
      addToast('error', formatUserError(err, '撤销配色失败'));
    } finally {
      setUndoing(false);
    }
  };

  const handleLivePreview = async () => {
    if (!activeScheme) return;
    if (!bridgeStatus?.connected) {
      addToast('error', '未连接到 Allegro，无法实时预览');
      return;
    }
    setPreviewing(true);
    try {
      const res = await window.atm.colorLivePalette(activeScheme.id);
      if (res.success && res.data) {
        const { schemeName, undoSnapshotId } = res.data;
        setLastApplyResult({
          schemeName,
          appliedLayerCount: 0,
          skippedLayerCount: 0,
          undoSnapshotId,
          mode: 'live-preview',
        });
        addToast('success', `已实时预览「${schemeName}」：调色板与背景色已推送到当前板子，图层分配未改动`);
      } else {
        addToast('error', res.error || '实时预览失败');
      }
    } catch (err) {
      addToast('error', formatUserError(err, '实时预览失败'));
    } finally {
      setPreviewing(false);
    }
  };

  // ===== ProfileBar 回调 =====
  const handleCreate = async (name: string) => {
    try {
      const snapshot: ColorSchemeSnapshot = {
        palette: createDefaultPalette(),
        background: { r: 0, g: 0, b: 0 },
        layers: [],
        source: { capturedAt: new Date().toISOString() },
      };
      const res = await window.atm.colorCreateScheme(snapshot, name, '新建空白方案');
      if (res.success && res.data) {
        addToast('info', `已创建方案「${res.data.name}」，可通过捕获或导入补充配色数据`);
        await reload();
      } else {
        addToast('error', res.error || '创建方案失败');
      }
    } catch (err) {
      addToast('error', formatUserError(err, '操作失败'));
    }
  };

  const handleCopy = async (schemeId: string) => {
    const res = await window.atm.colorCopyScheme(schemeId);
    if (res.success && res.data) {
      addToast('success', `已复制为「${res.data.name}」`);
      await reload();
    } else {
      addToast('error', res.error || '复制方案失败');
    }
  };

  const handleRename = async (schemeId: string, newName: string) => {
    const res = await window.atm.colorRenameScheme(schemeId, newName);
    if (res.success && res.data) {
      addToast('success', `已重命名为「${res.data.name}」`);
      await reload();
    } else {
      addToast('error', res.error || '重命名方案失败');
    }
  };

  const handleDelete = async (schemeId: string) => {
    const res = await window.atm.colorDeleteScheme(schemeId);
    if (res.success) {
      addToast('success', '已删除配色方案');
      await reload();
    } else {
      addToast('error', res.error || '删除方案失败');
    }
  };


  // ===== 方案更新 =====
  const applySchemePatch = async (updates: {
    palette?: ColorPaletteEntry[];
    layers?: ColorLayerEntry[];
  }) => {
    if (!activeScheme) return;
    setSaving(true);
    try {
      const res = await window.atm.colorUpdateScheme(activeScheme.id, updates);
      if (res.success && res.data) {
        const updated = res.data;
        setStore((prev) =>
          prev
            ? { ...prev, schemes: prev.schemes.map((s) => (s.id === updated.id ? updated : s)) }
            : prev,
        );
        return true;
      }
      addToast('error', res.error || '更新方案失败');
      return false;
    } catch (err) {
      addToast('error', formatUserError(err, '更新方案失败'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handlePaletteChange = async (index: number, rgb: ColorRgb) => {
    const current = activeScheme?.palette.find((entry) => entry.index === index);
    if (!current) {
      addToast('error', `调色板中不存在颜色 #${index}`);
      return;
    }
    const ok = await applySchemePatch({ palette: [{ ...current, rgb }] });
    if (ok) addToast('success', `已更新颜色 #${index}`);
  };

  const handleLayerColorChange = async (className: string, subclassName: string, colorIndex: number) => {
    const current = activeScheme?.layers.find(
      (layer) => layer.className === className && layer.subclassName === subclassName,
    );
    if (!current) {
      addToast('error', `方案中不存在图层 ${className}/${subclassName}`);
      return;
    }
    const ok = await applySchemePatch({ layers: [{ ...current, colorIndex }] });
    if (ok) addToast('success', `已将 ${className}/${subclassName} 设为颜色 #${colorIndex}`);
  };

  const handleLayerCustomColor = async (layer: ColorLayerEntry, hex: string): Promise<boolean> => {
    if (!activeScheme) return false;
    const rgb = hexToRgb(hex);
    if (!rgb) {
      addToast('error', '请输入完整的 6 位 Hex 色值');
      return false;
    }

    const plan = createCustomLayerColorPlan(
      activeScheme.palette,
      activeScheme.layers,
      layer,
      rgb,
    );
    if (!plan) {
      addToast('error', '没有可安全使用的调色板索引；请先释放一个未使用颜色槽');
      return false;
    }

    const ok = await applySchemePatch({
      palette: plan.palettePatch ? [plan.palettePatch] : undefined,
      layers: [plan.layerPatch],
    });
    if (ok) {
      const allocationText = plan.allocation === 'matching'
        ? '匹配现有颜色'
        : plan.allocation === 'current'
          ? '复用当前独立索引'
          : '分配未使用索引';
      addToast(
        'success',
        `${layer.className}/${layer.subclassName} 已设为 ${hex.toUpperCase()}（#${plan.colorIndex}，${allocationText}）`,
      );
    }
    return Boolean(ok);
  };

  const handleSwitch = async (schemeId: string) => {
    const res = await window.atm.colorSetActiveScheme(schemeId);
    if (res.success && res.data) {
      setLastApplyResult(null); // 切换方案后清除旧应用结果
      await reload();
    } else {
      addToast('error', res.error || '切换方案失败');
    }
  };

  const handleImportCol = async () => {
    try {
      const res = await window.atm.colorImportCol();
      if (!res.success) {
        addToast('error', res.error || '导入 .col 失败');
        return;
      }
      if (!res.data) return; // 用户取消
      const { palette, background, fileName } = res.data;
      const name = fileName.replace(/\.col$/i, '') || '导入配色';
      const snapshot: ColorSchemeSnapshot = {
        palette,
        background,
        layers: [],
        source: { capturedAt: new Date().toISOString() },
      };
      const created = await window.atm.colorCreateScheme(snapshot, name, '从 .col 文件导入');
      if (created.success && created.data) {
        addToast('info', `已从 ${fileName} 导入调色板（.col 仅包含调色板，不含图层分配）`);
        await reload();
      } else {
        addToast('error', created.error || '导入失败');
      }
    } catch (err) {
      addToast('error', formatUserError(err, '操作失败'));
    }
  };

  const handleExportCol = async (schemeId: string) => {
    try {
      const res = await window.atm.colorExportCol(schemeId);
      if (!res.success) {
        addToast('error', res.error || '导出 .col 失败');
        return;
      }
      if (res.data) {
        addToast('success', `已导出到 ${res.data}`);
      }
    } catch (err) {
      addToast('error', formatUserError(err, '操作失败'));
    }
  };

  const moreActions: ActionItem[] = [
    {
      label: '导入 .col 文件',
      onClick: () => void handleImportCol(),
    },
    {
      label: '导出 .col 文件',
      disabled: !activeScheme,
      onClick: () => activeScheme && void handleExportCol(activeScheme.id),
    },
    {
      label: '刷新',
      onClick: () => void reload(),
    },
  ];

  const statusItems = [
    {
      label: 'Vibe Bridge',
      value: bridgeStatus?.connected
        ? `已连接${bridgeStatus.allegroVersion ? ` · ${bridgeStatus.allegroVersion}` : ''}`
        : bridgeSetup?.configured
          ? '已配置 · 等待重启'
          : '未连接',
      status: (bridgeStatus?.connected ? 'ok' : bridgeSetup?.configured ? 'warning' : 'error') as 'ok' | 'warning' | 'error',
      tooltip: bridgeStatus?.connected
        ? bridgeStatus.message
        : bridgeSetup?.configured
          ? '桥接已写入 allegro.ilinit，请重启 Allegro 使其生效；当前会话仍未运行桥接服务。'
          : bridgeStatus?.message,
    },
    {
      label: '方案',
      value: store ? `${store.schemes.length} 个` : '—',
      status: 'ok' as const,
    },
    {
      label: '图层',
      value: activeScheme ? `${activeScheme.layers.length} 个` : '—',
      status: 'ok' as const,
    },
    {
      label: '来源版本',
      value: activeScheme?.source?.allegroVersion || activeScheme?.source?.boardName || '—',
      status:
        bridgeStatus?.connected &&
        activeScheme?.source?.allegroVersion &&
        bridgeStatus.allegroVersion &&
        activeScheme.source.allegroVersion !== bridgeStatus.allegroVersion
          ? ('warning' as const)
          : ('muted' as const),
      tooltip:
        activeScheme?.source?.allegroVersion && bridgeStatus?.allegroVersion && activeScheme.source.allegroVersion !== bridgeStatus.allegroVersion
          ? `方案来自 Allegro ${activeScheme.source.allegroVersion}，当前为 ${bridgeStatus.allegroVersion}，不存在的图层将自动跳过`
          : activeScheme?.source?.boardName
            ? `来源板：${activeScheme.source.boardName}`
            : undefined,
    },
  ];

  return (
    <WorkspacePage className="color-page">
      <WorkspaceHeader
        eyebrow="Color Scheme"
        title="配色方案"
        description="复制 Allegro 板子配色并可视化，在另一块板子中一键应用"
        actions={
          <div className="color-page-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleCapture()}
              disabled={capturing || !bridgeStatus?.connected}
            >
              <Camera aria-hidden="true" />
              {capturing ? '捕获中…' : '从 Allegro 捕获'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => void handleLivePreview()}
              disabled={previewing || !bridgeStatus?.connected || !activeScheme}
              title="将当前方案的调色板与背景色实时推送到 Allegro 当前板子"
            >
              <Eye aria-hidden="true" />
              {previewing ? '预览中…' : '实时预览'}
            </button>
            <MoreActionsMenu actions={moreActions} />
          </div>
        }
      />

      {store && (
        <ProfileBar
          title="配色方案"
          profiles={store.schemes}
          activeProfileId={activeScheme?.id ?? ''}
          onCreate={(name) => void handleCreate(name)}
          onCopy={(schemeId) => void handleCopy(schemeId)}
          onRename={(schemeId, name) => void handleRename(schemeId, name)}
          onDelete={(schemeId) => void handleDelete(schemeId)}
          onSwitch={(schemeId) => void handleSwitch(schemeId)}
          onApply={() => void handleApplyOpen()}
          onImport={() => void handleImportCol()}
          onExport={(schemeId) => void handleExportCol(schemeId)}
          applyLabel="应用到板子"
          compact
        />
      )}

      <GlobalStatusBar items={statusItems} />

      {activeScheme && (
        <div className="color-apply-options">
          <label className="color-apply-option">
            <input
              type="checkbox"
              checked={applyVisibility}
              onChange={(event) => setApplyVisibility(event.target.checked)}
            />
            <span>同时复制图层可见性（默认不复制，只改颜色）</span>
          </label>
        </div>
      )}

      {lastApplyResult && (
        <div className="color-apply-detail">
          <div className="color-apply-detail-head">
            {lastApplyResult.mode === 'live-preview' ? (
              <h4>已实时预览「{lastApplyResult.schemeName}」：调色板与背景色已推送，图层分配未改动</h4>
            ) : (
              <h4>已应用「{lastApplyResult.schemeName}」：{lastApplyResult.appliedLayerCount} 个层已设置，{lastApplyResult.skippedLayerCount} 个层跳过（目标板不存在）</h4>
            )}
            {lastApplyResult.undoSnapshotId && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => void handleUndoApply()}
                disabled={undoing}
              >
                {undoing ? '撤销中…' : lastApplyResult.mode === 'live-preview' ? '撤销实时预览' : '撤销本次配色'}
              </button>
            )}
          </div>
          {lastApplyResult.skippedLayers && lastApplyResult.skippedLayers.length > 0 && (
            <div className="color-apply-skipped-list">
              {lastApplyResult.skippedLayers.slice(0, 60).map((name) => (
                <span key={name} className="color-apply-skipped-item">{name}</span>
              ))}
              {lastApplyResult.skippedLayers.length > 60 && (
                <span className="color-apply-skipped-more">等共 {lastApplyResult.skippedLayers.length} 个…</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 桥接状态常驻横幅：无论是否有方案都显示，避免入口藏在空状态里 */}
      {!bridgeStatus?.connected && (
        <div className="color-bridge-banner" role="status">
          {bridgeSetup?.canEnable ? (
            <>
              <div className="color-bridge-banner-text">
                <strong>Vibe Bridge 已安装，但尚未配置自动加载</strong>
                <span>点击按钮将加载命令写入所有已发现环境的 allegro.ilinit，重启 Allegro 后每次启动自动生效，无需手动执行。</span>
                {bridgeSetup.environments.length > 0 && (
                  <span className="color-bridge-env-summary">
                    {bridgeSetup.environments
                      .map((environment) => (
                        `${environment.allegroVersion ? `Allegro ${environment.allegroVersion}` : '未知环境'}${environment.configured ? '：已配置' : '：待配置'}`
                      ))
                      .join('；')}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => void handleBridgeEnable()}
              >
                自动启用桥接
              </button>
            </>
          ) : bridgeSetup?.configured ? (
            <>
              <div className="color-bridge-banner-text">
                <strong>桥接已配置自动加载，但当前 Allegro 会话尚未运行</strong>
                <span>请重启 Allegro 使其生效；或在当前会话命令窗执行：</span>
                {bridgeSetup.serverFile && (
                  <code className="color-bridge-setup-hint">
                    {`skill load("${bridgeSetup.serverFile.replace(/\\/g, '/')}")`}
                  </code>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="color-bridge-banner-text">
                <strong>未安装 Vibe Bridge 服务</strong>
                <span>Vibe Bridge 是 ATM 与运行中的 Allegro 实时通信（配色抓取、DRC 抓取、设计体检等）的桥梁。点击右侧按钮即可在本机安装，随后再配置自动加载。</span>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => void handleBridgeInstall()}
              >
                一键安装 Vibe Bridge
              </button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="color-page-empty">正在加载配色方案…</div>
      ) : !activeScheme ? (
        <div className="color-page-empty">
          <p>还没有配色方案。</p>
          <p>点击「从 Allegro 捕获」复制当前板子的配色，或通过「更多操作 → 导入 .col 文件」从文件导入。</p>
        </div>
      ) : (
        <div className="color-page-grid">
          <ColorPaletteGrid
            palette={activeScheme.palette}
            background={activeScheme.background}
            layers={activeScheme.layers}
            onPaletteChange={(index, rgb) => void handlePaletteChange(index, rgb)}
            saving={saving}
          />
          <ColorLayerList
            layers={activeScheme.layers}
            palette={activeScheme.palette}
            onLayerColorChange={(cls, sub, idx) => void handleLayerColorChange(cls, sub, idx)}
            onLayerCustomColor={handleLayerCustomColor}
            saving={saving}
          />
        </div>
      )}

      {/* 捕获后命名 */}
      <BusinessDialog
        open={captureDialogOpen}
        title="保存捕获的配色方案"
        description="捕获成功，请为方案命名后保存"
        onClose={() => {
          if (!capturing) {
            setCaptureDialogOpen(false);
            setCaptureSnapshot(null);
          }
        }}
        footer={
          <>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setCaptureDialogOpen(false);
                setCaptureSnapshot(null);
              }}
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleCaptureSave()}
              disabled={!captureName.trim()}
            >
              保存方案
            </button>
          </>
        }
      >
        <input
          type="text"
          className="profile-bar-input"
          placeholder="方案名称"
          value={captureName}
          autoFocus
          onChange={(event) => setCaptureName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && captureName.trim()) {
              void handleCaptureSave();
            }
          }}
        />
        {captureSnapshot && (
          <p className="color-capture-summary">
            共捕获 {captureSnapshot.palette.length} 个调色板颜色与{' '}
            {captureSnapshot.layers.length} 个图层分配。
          </p>
        )}
      </BusinessDialog>

      {/* 应用预览与确认 */}
      <ColorApplyPreviewDialog
        open={applyPreviewOpen}
        preview={applyPreview}
        schemeName={activeScheme?.name ?? ''}
        applying={applying}
        onConfirm={() => void handleApplyConfirm()}
        onCancel={() => setApplyPreviewOpen(false)}
      />

      {/* 启用桥接 Apply Plan */}
      <ApplyPlanDialog
        open={Boolean(bridgeEnablePlan)}
        plan={bridgeEnablePlan}
        applying={bridgeEnabling}
        title="启用 Vibe Bridge 自动加载"
        intro="将桥接服务加载命令写入所有已发现环境的 allegro.ilinit。写入后无论从哪个环境启动 Allegro，桥接都会自动加载，无需在命令窗手动执行。"
        confirmLabel="确认写入"
        restartNote="写入完成后请重启 Allegro 使配置生效。"
        onConfirm={() => void handleBridgeEnableConfirm()}
        onCancel={() => {
          if (!bridgeEnabling) setBridgeEnablePlan(null);
        }}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </WorkspacePage>
  );
};

export default ColorPage;
