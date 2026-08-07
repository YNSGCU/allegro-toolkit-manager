# Feature: application-updates

## Purpose

通过 `electron-updater` 为 ATM Windows NSIS 安装版提供显式检查、下载进度和重启安装能力。

## Ownership

- Main service: `electron/services/updateService.ts`
- IPC: `electron/ipc/update.ipc.ts`
- Preload: `electron/preload.ts`
- Renderer: `src/components/common/ApplicationUpdatePanel.tsx`
- Runtime types: `src/types/updates.ts`, `src/types/window.d.ts`
- Packaging: `scripts/package-update.mjs`, `package.json`

## Feature Chain

```txt
ApplicationUpdatePanel -> window.atm update methods -> preload -> app:update-* IPC
-> UpdateService -> electron-updater -> HTTPS generic feed
-> updater events -> app:update-state-changed -> ApplicationUpdatePanel
-> quitAndInstall(true, true) -> NSIS replacement -> application relaunch
```

## Public Interfaces

- `app:update-state`: 读取当前状态。
- `app:update-settings`: 读取更新源设置。
- `app:update-settings-save`: 保存 HTTPS 更新源和 `system/direct` 连接方式。
- `app:update-check`: 检查 `latest.yml`。
- `app:update-download`: 下载可用版本。
- `app:update-install`: 仅在 `downloaded` 状态调用静默 NSIS 安装。
- `app:update-state-changed`: Main 推送状态和下载进度。

## Data Model

更新设置保存在 Electron `userData/update-settings.json`。环境变量 `ATM_UPDATE_URL` 优先级高于已保存设置；正式构建脚本把 `ATM_UPDATE_FEED_URL` 写入临时 electron-builder 配置的 `publish.generic.url` 和 `package.json.atmUpdateFeedUrl`。空地址表示未配置，不会发起网络请求。

## Safety Contract

- `autoDownload` 和 `autoInstallOnAppQuit` 均关闭。
- 仅接受无凭据、无查询参数和无片段的 HTTPS 地址。
- 所有更新错误只跨进程传递阶段、稳定分类、可恢复性和重试动作，不向 Renderer 暴露底层路径或敏感 URL。
- 未下载完成时拒绝安装；安装始终使用 `quitAndInstall(true, true)`。
- 普通 `npm run package:win` 不注入更新源；只有显式 `npm run package:win:update` 才生成更新元数据。

## Tests and Verification

- `tests/updateService.test.ts`：HTTPS 校验、检查/下载/安装状态链、开发模式保护。
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.electron.json --noEmit`
- `npm run verify:update`
- `npm run verify`

## Known Pitfalls

- `.structure-os/PITFALLS.md#pit-2026-08-06-02`：没有真实发布源时不得伪造默认更新地址或宣称更新可用。
- `electron-updater` 的 ESM/CJS 导入和 `app-update.yml` 完整性需要在正式打包后再做 Electron 实机验证。

## Extension Notes

正式发布前应补充真实仓库地址、Windows 代码签名、`latest.yml/.blockmap` 资产治理和已安装旧版本的覆盖升级 E2E；不要把 PiAgent 的发布 URL 复制到 ATM。