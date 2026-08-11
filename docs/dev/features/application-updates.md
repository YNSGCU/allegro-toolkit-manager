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

更新设置保存在 Electron `userData/update-settings.json`。更新源优先级为：环境变量 `ATM_UPDATE_URL` -> 已保存设置 -> 安装包 `package.json.atmUpdateFeedUrl` -> `OFFICIAL_UPDATE_FEED_URL`。发布脚本把官方目录写入安装包；普通本地包缺少元数据时也会回退到经过验证的 ATM 官方 GitHub Release，不再无提示保持未配置。

## Safety Contract

- `autoDownload` 和 `autoInstallOnAppQuit` 均关闭。
- 仅接受无凭据、无查询参数和无片段的 HTTPS 地址。
- 所有更新错误只跨进程传递阶段、稳定分类、可恢复性和重试动作，不向 Renderer 暴露底层路径或敏感 URL。
- 未下载完成时拒绝安装；安装始终使用 `quitAndInstall(true, true)`。
- 检查前先完成网络/更新源配置，再进入 `checking`；检查调用有 30 秒超时并归类为可重试的网络错误。
- 普通 `npm run package:win` 不生成 `latest.yml`，但运行时仍认识官方源；`package:win:update` / `publish:github` 才生成和发布更新元数据。
- `publish:github` 让 electron-builder 以 `--publish never` 只生成 exe、blockmap 和 `latest.yml`，随后由 `gh release create/upload` 串行上传三项资产。不要恢复 electron-builder 的 GitHub 并发发布，否则 exe 与 blockmap 可能各自创建一个同名 draft。

## Tests and Verification

- `tests/updateService.test.ts`：HTTPS 校验、官方源兜底、检查/下载/安装状态链、开发模式保护。
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.electron.json --noEmit`
- `npm run verify:update`
- `npm run verify`

## Known Pitfalls

- `.structure-os/PITFALLS.md#pit-2026-08-06-02`：没有真实发布源时不得伪造默认更新地址；ATM 官方 Release 已建立后，默认值只能指向本项目已验证地址。
- `.structure-os/PITFALLS.md#pit-2026-08-10-02`：检查入口不得在缺少更新源或网络等待时无状态反馈。
- `electron-updater` 的 ESM/CJS 导入和 `app-update.yml` 完整性需要在正式打包后再做 Electron 实机验证。

## Extension Notes

正式发布前应补充真实仓库地址、Windows 代码签名、`latest.yml/.blockmap` 资产治理和已安装旧版本的覆盖升级 E2E；不要把 PiAgent 的发布 URL 复制到 ATM。
