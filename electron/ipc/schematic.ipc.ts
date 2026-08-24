/**
 * ATM - 电源树 / 原理图 IPC 处理器
 * 目前仅提供电源树导出（SVG / PNG / PDF）。
 * OrCAD COM 抽取（P0/P1 数据层）就绪后，在此扩展 open/extract 通道。
 */
import { BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'fs';
import type {
  PowerTree,
  SchematicExportInput,
  SchematicExportResult,
} from '../../src/types/schematic';
import {
  powerTreeDimensions,
  powerTreeExportFileName,
  renderPowerTreeHtml,
  renderPowerTreeSvg,
} from '../../core/schematic/powerTreeExport';

export function registerSchematicIpc(): void {
  ipcMain.handle('schematic:export', async (_event, input: SchematicExportInput) => {
    try {
      if (!input?.tree || !Array.isArray(input.tree.rails)) {
        return { success: false, error: '缺少有效的电源树数据。' };
      }
      const format = input.format ?? 'svg';
      const defaultName = powerTreeExportFileName(input.tree, format);
      const saveResult = await dialog.showSaveDialog({
        title: '导出电源树',
        defaultPath: defaultName,
        filters: [{ name: format.toUpperCase(), extensions: [format] }],
      });
      if (saveResult.canceled || !saveResult.filePath) {
        return { success: true, data: null };
      }

      if (format === 'svg') {
        fs.writeFileSync(saveResult.filePath, renderPowerTreeSvg(input.tree), 'utf-8');
      } else {
        await renderToFile(saveResult.filePath, input.tree, format);
      }

      const data: SchematicExportResult = { filePath: saveResult.filePath, format };
      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: `导出电源树失败: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  });
}

/** 隐藏窗口渲染 → 栅格化 PNG 或打印 PDF */
async function renderToFile(
  filePath: string,
  tree: PowerTree,
  format: 'png' | 'pdf',
): Promise<void> {
  const html = renderPowerTreeHtml(tree);
  const { width, height } = powerTreeDimensions(tree);
  const win = new BrowserWindow({
    show: false,
    width,
    height,
    useContentSize: true,
    webPreferences: { offscreen: false },
  });
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    // 等待隐藏窗口完成首帧绘制，避免 capturePage 抓到空白
    await new Promise((resolve) => { setTimeout(resolve, 300); });
    if (format === 'png') {
      const image = await win.webContents.capturePage();
      fs.writeFileSync(filePath, image.toPNG());
    } else {
      const pdf = await win.webContents.printToPDF({ printBackground: true });
      fs.writeFileSync(filePath, pdf);
    }
  } finally {
    win.destroy();
  }
}
