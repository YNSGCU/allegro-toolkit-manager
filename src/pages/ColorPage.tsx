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
import { Camera, RefreshCw } from 'lucide-react';
import type {
  ColorBridgeStatus,
  ColorScheme,
  ColorSchemeSnapshot,
  ColorSchemeStore,
} from '../types/color';
import { createDefaultPalette } from '../../core/color/colorPalette';
import ProfileBar from '../components/ProfileBar';
import GlobalStatusBar from '../components/GlobalStatusBar';
import MoreActionsMenu, { type ActionItem } from '../components/MoreActionsMenu';
import ConfirmDialog from '../components/common/ConfirmDialog';
import BusinessDialog from '../shared/ui/overlays/BusinessDialog';
import ToastContainer, { useToast } from '../components/common/Toast';
import { formatUserError, WorkspaceHeader, WorkspacePage } from '../shared/ui';
import ApplyPlanDialog, { type ApplyPlanViewModel } from '../shared/ui/overlays/ApplyPlanDialog';
import ColorPaletteGrid from '../components/color/ColorPaletteGrid';
import ColorLayerList from '../components/color/ColorLayerList';
import './color-page.css';

const ColorPage: React.FC = () => {
  const { toasts, addToast, removeToast } = useToast();

  const [store, setStore] = useState<ColorSchemeStore | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<ColorBridgeStatus | null>(null);
  const [bridgeSetup, setBridgeSetup] = useState<{ serverFile: string | null; configured: boolean; canEnable: boolean; ilinitPath: string | null } | null>(null);
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
  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applyVisibility, setApplyVisibility] = useState(false);
  const [lastApplyResult, setLastApplyResult] = useState<{ schemeName: string; appliedLayerCount: number; skippedLayerCount: number; skippedLayers?: string[] } | null>(null);

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
  // ===== ?????? =====
  const handleBridgeEnable = async () => {
    try {
      const res = await window.atm.colorCreateBridgeEnablePlan();
      if (!res.success) {
        addToast('error', res.error || '????????');
        return;
      }
      if (!res.data) {
        addToast('info', res.info || '????????????');
        return;
      }
      setBridgeEnablePlan(res.data);
    } catch (err) {
      addToast('error', formatUserError(err, '????????'));
    }
  };

  const handleBridgeEnableConfirm = async () => {
    if (!bridgeEnablePlan) return;
    setBridgeEnabling(true);
    try {
      const res = await window.atm.colorExecuteBridgeEnablePlan(JSON.stringify(bridgeEnablePlan));
      if (res.success) {
        addToast('success', '??? Vibe Bridge ??????? Allegro ?????');
        setBridgeEnablePlan(null);
        await reload();
      } else {
        addToast('error', res.error || '??????');
      }
    } catch (err) {
      addToast('error', formatUserError(err, '??????'));
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
  const handleApplyConfirm = async () => {
    if (!activeScheme) return;
    setApplying(true);
    setApplyConfirmOpen(false);
    try {
      const res = await window.atm.colorApply(activeScheme.id, applyVisibility);
      if (res.success && res.data) {
        const { result, schemeName, sourceAllegroVersion, targetAllegroVersion } = res.data;
        setLastApplyResult({
          schemeName,
          appliedLayerCount: result.appliedLayerCount,
          skippedLayerCount: result.skippedLayerCount,
          skippedLayers: result.skippedLayers,
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


  // ===== ???? =====
  const applySchemePatch = async (updates: { palette?: any[]; layers?: any[] }) => {
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

  const handlePaletteChange = async (index: number, rgb: any) => {
    const ok = await applySchemePatch({ palette: [{ index, rgb }] });
    if (ok) addToast('success', `已更新颜色 #${index}`);
  };

  const handleLayerColorChange = async (className: string, subclassName: string, colorIndex: number) => {
    const ok = await applySchemePatch({ layers: [{ className, subclassName, colorIndex }] });
    if (ok) addToast('success', `已将 ${className}/${subclassName} 设为颜色 #${colorIndex}`);
  };

  const handleSwitch = async (schemeId: string) => {
    const res = await window.atm.colorSetActiveScheme(schemeId);
    if (res.success && res.data) {
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
          onApply={() => setApplyConfirmOpen(true)}
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

      {lastApplyResult && lastApplyResult.skippedLayers && lastApplyResult.skippedLayers.length > 0 && (
        <div className="color-apply-detail">
          <h4>已应用「{lastApplyResult.schemeName}」：{lastApplyResult.appliedLayerCount} 个层已设置，{lastApplyResult.skippedLayerCount} 个层跳过（目标板不存在）</h4>
          <div className="color-apply-skipped-list">
            {lastApplyResult.skippedLayers.slice(0, 60).map((name) => (
              <span key={name} className="color-apply-skipped-item">{name}</span>
            ))}
            {lastApplyResult.skippedLayers.length > 60 && (
              <span className="color-apply-skipped-more">等共 {lastApplyResult.skippedLayers.length} 个…</span>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="color-page-empty">正在加载配色方案…</div>
      ) : !activeScheme ? (
        <div className="color-page-empty">
          <p>还没有配色方案。</p>
          <p>点击「从 Allegro 捕获」复制当前板子的配色，或通过「更多操作 → 导入 .col 文件」从文件导入。</p>
          {bridgeSetup?.canEnable ? (
            <div className="color-bridge-setup">
              <p>检测到 Vibe Bridge 已安装但未配置自动加载。点击下方按钮将加载命令写入 allegro.ilinit，重启 Allegro 后自动生效，无需手动执行。</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleBridgeEnable()}
              >
                自动启用桥接
              </button>
            </div>
          ) : bridgeSetup?.configured && !bridgeStatus?.connected ? (
            <div className="color-bridge-setup">
              <p>桥接已配置自动加载，但当前 Allegro 会话尚未运行桥接服务。</p>
              <p>请重启 Allegro 使其生效；或在当前会话命令窗执行：</p>
              <code className="color-bridge-setup-hint">skill load("C:/Users/89539/.codex/skills/allegro-vibe-bridge/vibe_server.il")</code>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleCapture()}
              disabled={!bridgeStatus?.connected}
            >
              <RefreshCw aria-hidden="true" />
              开始捕获
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleCapture()}
            disabled={!bridgeStatus?.connected}
          >
            <RefreshCw aria-hidden="true" />
            开始捕获
          </button>
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

      {/* 应用确认 */}
      <ConfirmDialog
        open={applyConfirmOpen}
        title="应用配色方案"
        message={
          activeScheme
            ? `将「${activeScheme.name}」应用到当前打开的板子？`
            : '当前没有可应用的方案'
        }
        detail={
          activeScheme
            ? `包含 ${activeScheme.palette.length} 个调色板颜色、背景色与 ${activeScheme.layers.length} 个图层分配。按层角色智能分配：顶层、底层使用各自颜色，平面层按源板平面层顺序循环取色，内部信号层按层叠顺序依次取色（超出循环）。目标板子中不存在的图层将自动跳过。` +
              (activeScheme.source?.allegroVersion && bridgeStatus?.allegroVersion && activeScheme.source.allegroVersion !== bridgeStatus.allegroVersion
                ? `\n注意：方案来自 Allegro ${activeScheme.source.allegroVersion}，当前为 ${bridgeStatus.allegroVersion}，跨版本图层的可用性以目标版本为准。`
                : '')
            : undefined
        }
        variant="warning"
        confirmLabel={applying ? '应用中…' : '确认应用'}
        cancelLabel="取消"
        onConfirm={() => void handleApplyConfirm()}
        onCancel={() => setApplyConfirmOpen(false)}
      />

      {/* 启用桥接 Apply Plan */}
      <ApplyPlanDialog
        open={Boolean(bridgeEnablePlan)}
        plan={bridgeEnablePlan}
        applying={bridgeEnabling}
        title="启用 Vibe Bridge 自动加载"
        intro="将桥接服务加载命令写入 allegro.ilinit。写入后 Allegro 每次启动都会自动加载桥接，无需在命令窗手动执行。"
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
