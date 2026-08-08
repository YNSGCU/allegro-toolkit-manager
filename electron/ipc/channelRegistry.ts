/**
 * ATM - IPC 通道注册表
 *
 * ipcMain.listenerCount() 只统计 on() 注册的监听器，不统计 handle() 注册的
 * invoke handler。因此用 handle() 注册的通道 listenerCount 恒为 0，无法用于
 * 版本诊断。此模块在 registerIpcHandlers 入口包装 ipcMain.handle，记录所有
 * 已注册通道，供运行时版本自检使用。
 */
import { ipcMain } from 'electron';

/** 已通过 ipcMain.handle 注册的全部通道名 */
export const registeredChannels = new Set<string>();

/** 包装 ipcMain.handle，使每次注册都被记录到 registeredChannels */
export function patchIpcMainHandle(): void {
  const originalHandle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = ((channel: string, listener: (...args: unknown[]) => unknown) => {
    registeredChannels.add(channel);
    originalHandle(channel, listener);
  }) as typeof ipcMain.handle;
}