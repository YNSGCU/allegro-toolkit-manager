# Allegro DevOps Tool 设计系统

> 页面专属规则放在 `pages/<page>.md`；页面文件只记录偏差，其余规则继承本文件。

## 设计定位

- 类型：Windows 桌面工程工作台
- 风格：Swiss Technical Workspace（理性网格、低装饰、局部高密度）
- 主题：第一阶段仅提供浅色主题
- 目标窗口：1220×820 最小、1360×920 默认、1600×1000 与 1920×1080 宽屏
- 业务底线：任何写入仍必须经过 Apply Plan，不因 UI 重置而弱化风险说明

## 设计原则

1. 页面按“标题 → 上下文 → 状态 → 工具栏 → 内容”组织。
2. 一个上下文只突出一个主操作，其他动作降级为次级按钮或更多菜单。
3. 说明区宽松，树、表格、键盘和诊断区紧凑但必须可读。
4. 状态必须同时使用图标、文字和颜色，不得只依赖颜色。
5. 不使用 emoji 充当图标；统一使用 Lucide SVG 图标。
6. Hover 不缩放，不制造布局位移；交互过渡保持 150–200ms。
7. 路径、命令和代码使用系统等宽字体，不加载在线字体。

## 颜色

| 角色 | 值 |
|---|---|
| Canvas | `#F4F6F8` |
| Sidebar | `#F8F9FA` |
| Surface | `#FFFFFF` |
| Subtle surface | `#EEF2F4` |
| Primary text | `#17202A` |
| Secondary text | `#55616D` |
| Muted text | `#707C88` |
| Border | `#DCE2E7` |
| Accent | `#0F766E` |
| Accent hover | `#115E59` |
| Accent soft | `#E7F4F2` |
| Success | `#15803D` |
| Warning | `#B45309` |
| Danger | `#B91C1C` |
| Info | `#1D4ED8` |

品牌强调色与成功色必须分开，不能把“当前选中”和“操作成功”显示成同一种语义。

## 字体与密度

- UI：`Segoe UI`, `Microsoft YaHei UI`, `Microsoft YaHei`, sans-serif
- 代码：`Cascadia Mono`, `Consolas`, monospace
- 页面标题：24px / 700
- 区域标题：15px / 650
- 正文：13px / 400
- 辅助文字：12px / 400
- 表格：12px；紧凑行 36px，标准行 44px

## 空间与形态

- 基础单位：4px
- 常用间距：4 / 8 / 12 / 16 / 24 / 32px
- 圆角：6 / 8 / 12px
- 普通表面不用阴影，只使用边框
- 浮层：`0 16px 40px rgba(23, 32, 42, 0.16)`
- 焦点环：2px accent，外扩 2px

## 页面骨架

```text
AppShell
└── WorkspacePage
    ├── WorkspaceHeader
    ├── ContextBar / ProfileSwitcher
    ├── StatusStrip
    ├── WorkspaceTabs
    ├── FilterToolbar
    ├── WorkspaceContent
    └── Dialog / Drawer / Toast / ApplyPlan
```

页面根到内部滚动容器必须保持连续的 `min-height: 0`，避免固定高度工作区失去滚动能力。

## 可访问性

- 所有主要流程可用键盘完成。
- 页面提供“跳到主要内容”入口。
- 所有焦点状态清晰可见。
- 错误使用 `role="alert"`，异步状态使用 `aria-live`。
- 对话框打开后聚焦首个有效控件，关闭后将焦点还给触发元素。
- 尊重 `prefers-reduced-motion`。

## 禁止模式

- 落地页式大 Hero、横向滚动叙事、无业务意义的 KPI 卡片。
- 大圆角卡片套卡片。
- 继续在 `App.css` 尾部堆叠覆盖规则。
- 普通视觉属性使用 TSX 内联样式。
- 仅显示“成功/失败”而不给恢复路径。
- 把“尚未检查”显示为“检查通过”。

## 交付检查

- [ ] 1220×820、1360×920、1600×1000 无页面级横向滚动
- [ ] 主操作、状态和当前路由一眼可辨
- [ ] 无 emoji 图标和无替代焦点的 `outline: none`
- [ ] loading、empty、error、ready、dirty、applying 状态齐全
- [ ] Renderer/Electron 类型检查、Vitest、构建全部通过
- [ ] 真实 Electron/Allegro 环境验证写入前后状态刷新
