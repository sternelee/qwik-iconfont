# Iconfont 设计系统

**Vol. 01 · Issue Nº 01 · 2026** — Filed under **Design · Engineering**
Made on Earth · Apache-2.0 spirit · Last updated 2026-06-02

本文档是 Iconfont SaaS 的视觉与文案规范。它不是一份迭代日志，也不是组件 API 文档 — 它是关于"我们想做什么样的产品"的一份 stance。

参考 [open-design.ai](https://open-design.ai) 的 editorial / studio manifest 体例：**少做、加深、把每一处都做对**。

---

## 序 · Editorial Note

我们不写渐变背景。  
我们用 hairline（1px 实色边）做层次，不用阴影扩散。  
我们把玫瑰红留给关键点 — 不到 5% 的视觉面积。  
我们用 ≤ 8px 的圆角。  
我们用 ≤ 250ms 的克制动画。  
我们用 editorial 紧字距 sans，不用圆润 display 字体。

---

## § We ship · We don't ship

| Ship | Don't ship |
|---|---|
| 单一 accent（玫瑰红），其余近单色 | 多色同时争抢注意力 |
| 1px hairline borders 做卡片边界 | 多层 box-shadow + inset glow |
| ≤ 8px 圆角（卡片）/ 4px（input、tag） | > 12px 的 clay 大圆角 |
| Inter Tight（UI）+ IBM Plex Mono（meta） | Nunito / Quicksand 等圆润 display 字体 |
| 150ms ease-out / 250ms cb 入场 | 弹性 spring 缓动（`cubic-bezier(0.34, 1.56 …)`） |
| 每个可交互元素有 hover + active 反馈 | hover 时同时 translate + scale + shadow 的复合动画 |
| Dark mode 在 `[data-theme]` 下定义完整 token | 用 opacity 翻转 hack dark 模式 |
| 中性灰影（`rgba(0,0,0,0.x)`），alpha ≤ 0.08 | 玫瑰红色阴影（`rgba(225, 29, 72, 0.x)`） |
| 一个 token 用一个语义角色 | "v1 vs v2" 迭代表混入设计文档 |

---

## I. 色彩 · Palette

### 角色

| 角色 | Token | Hex | 用途 | 占比 |
|---|---|---|---|---|
| **Surface** | `base-100` | `#FFFFFF` | 页面 / 卡片背景 | ~80% |
| **Surface Raised** | `base-200` | `#F5F5F5` | float 面板、hover 行 | — |
| **Ink** | `base-content` | `#0A0A0A` | 主文字 | ~15% |
| **Muted** | `ink-muted` | `rgba(10, 10, 10, 0.55)` | 描述 / placeholder | — |
| **Hairline** | `border` | `rgba(10, 10, 10, 0.10)` | 1px 分割线 | — |
| **Accent** | `primary` | `#E11D48` | CTA、链接、选中态 | **< 5%** |

| 语义 | Hex | 用途 |
|---|---|---|
| **Success** | `#16A34A` | 完成 / 成功 |
| **Warning** | `#D97706` | 警告 / 本地模式 |
| **Error** | `#DC2626` | 删除 / 错误 |
| **Info** | `#0A0A0A` | 中性提示（用 ink，不加颜色） |

### 暗色模式

| 角色 | Hex |
|---|---|
| **Surface** `base-100` | `#0A0A0A` |
| **Surface Raised** `base-200` | `#141414` |
| **Ink** `base-content` | `#F5F5F5` |
| **Muted** | `rgba(245, 245, 245, 0.55)` |
| **Hairline** | `rgba(245, 245, 245, 0.10)` |
| **Accent** | `#FB7185`（亮一档保证对比度） |

> **WCAG AA 目标**：正文 4.5:1，大字 3:1。Accent `#E11D48` on white = 4.6:1 ✓，`#FB7185` on black = 5.2:1 ✓。

### 使用原则

- 先 surface → ink → accent。三层递进，不要跳级。
- 状态色（success / warning / error）只用于**语义**，不用作装饰。
- accent 面积控制在 **5% 以下**。一颗心跳、一个选中框、一个主要 CTA — 够了。
- neutral / info 永远用 ink / muted 表达，不加额外的冷色或暖色。

---

## II. 字体 · Typography

### Stack

- **Sans**：`'Inter Tight', -apple-system, BlinkMacSystemFont, sans-serif`
- **Mono**：`'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace`

> Inter Tight 是 Inter 的紧凑版，字距收紧，标题更锋利。IBM Plex Mono 给元数据、Unicode 码点、坐标、版本号等"技术小字"用。两者均开源（OFL），Google Fonts 可直拉。

### 字号层级

| 层级 | Size / Line | Weight | Tracking | 用途 |
|---|---|---|---|---|
| **Display** | 56 / 64 | 700 | `-0.03em` | Hero 主标题 |
| **H1** | 32 / 40 | 700 | `-0.02em` | 页面标题 |
| **H2** | 24 / 32 | 600 | `-0.01em` | 区块标题 |
| **H3** | 18 / 28 | 600 | `0` | 卡片标题 |
| **Body** | 14 / 22 | 400 | `0` | 正文 |
| **Caption** | 12 / 18 | 500 | `0` | 标签、辅助 |
| **Eyebrow** | 11 / 16 | 600 | `+0.08em` | 分区小标签（"ICN-024 · FIG. 01"） |
| **Mono** | 12 / 20 | 400 | `0` | 代码、Unicode、SHA |

### 排版规则

- **标题**：Inter Tight 700–600，紧字距（`-0.01em` ~ `-0.03em`），单行优先。
- **正文**：14px 起，行高 ≥ 1.5。
- **元数据**：永远用 IBM Plex Mono — 如 `ICN-024 · 13.4 KB · 24×24`。
- **Eyebrow**：11px / 600w / +0.08em tracking / 大写 — 用作节律锚点，不要到处用。
- **不要**：Nunito、Quicksand 等圆润 display 字体作标题。

---

## III. 间距 · Spacing

### 四像素系统

Tailwind v4 `--spacing` 变量未改，保持 0.25rem = 4px。

| Token | px | 用途 |
|---|---|---|
| `1` | 4 | 元素内最小间距 |
| `2` | 8 | tag 与值 |
| `3` | 12 | input padding |
| `4` | 16 | 卡片内边距（小）、gutter |
| `6` | 24 | 卡片内边距（大）、组件间距 |
| `8` | 32 | 区块间距（小） |
| `12` | 48 | 区块间距（中） |
| `16` | 64 | 区块间距（大） |

### 容器

- 最大宽度：`1280px`（`max-w-7xl`）
- 水平内边距：移动端 `16px`，桌面端 `24px`
- 区块垂直间距：48–64px

### 网格

- 首页项目卡片：`grid-cols-1 sm:2 lg:3`
- 图标网格：`grid-cols-2 sm:3 md:4 lg:6 xl:8`
- Gutter：`16px`（`gap-4`）

---

## IV. 圆角 · Radii

半径是视觉性格的重要锚点。open-design.ai 的 card 圆角在 0–8px 范围内，因为圆角越大，对卡片内 content 的裁剪越割裂。

| 元素 | Radius | 理由 |
|---|---|---|
| **按钮（active）** | `0` | 最大化内容区，进入选择态时保持刚性 |
| **按钮（rest）** | `4px` | 微妙暗示，不抢注意力 |
| **Tag · Badge** | `4px` | 小面积，需要可辨 |
| **Input · Textarea** | `4px` | — |
| **Card · Modal** | `6px` | 比旧 12–24px 收窄，保持 content 贴合 |
| **Nav · Header** | `0` | 全幅容器不要圆角 |

> 硬规则：**所有容器类元素的 radius 不超过 8px**，图标网格视情况允许 12px（icon card 小面积无碍）。

---

## V. 阴影与层次 · Elevation

### 原则

- **零阴影，用 hairline** — 1px `border`（`rgba(0,0,0,0.10)`）做层级分割。
- 卡片在 rest 状态下**不出现 box-shadow**，只在 hover 时加一层极淡阴影（`blur ≤ 6px，alpha ≤ 0.06`）。
- 不使用 inset glow（`inset 0 1px 3px rgba(…)`）。
- 不使用玫瑰红色阴影。永远用 `rgba(0,0,0,0.x)`。
- Drop-down / popover / tooltip 可以上浮至 `blur 12px`、`alpha 0.08`（因为悬浮层需要物理距离感）。

### Token

| 状态 | Box-shadow |
|---|---|
| Card rest | 无（用 `border: 1px solid` 替代） |
| Card hover | `0 2px 6px rgba(0, 0, 0, 0.06)` |
| Button rest | 无 |
| Button hover | 无（用 border-color 或 bg-color 变化提示） |
| Navbar | 无（用 `border-bottom: 1px solid` 替代 blur header） |
| Popover / Tooltip | `0 4px 12px rgba(0, 0, 0, 0.08)` |

---

## VI. 运动 · Motion

### 原则

- **150ms 标准交互**（ease-out，cubic-bezier(0, 0, 0.2, 1)）。
- **250ms 入场/过渡**（cubic-bezier(0.16, 1, 0.3, 1)） — 仅用于页面/弹窗入场，不再用于 hover。
- **禁止 spring / bounce / elastic**。不要 `cubic-bezier(0.34, 1.56, …)`，不要 scale + translate 的复合 hover。
- **禁止主动装饰动画**（float、blob、pulse-ring）。如果用户没触发、也不是加载态，就不要动。

### 规范

| 行为 | Duration | Easing | 效果 |
|---|---|---|---|
| 按钮 hover | 150ms | ease-out | border-color 或 bg 过渡 |
| 按钮 active | 100ms | ease-out | scale 0.98（仅按压，不位移动画） |
| 卡片 hover | 200ms | ease-out | border 加深 + 极淡阴影上浮 |
| 弹窗入场 | 250ms | `cb(0.16, 1, 0.3, 1)` | opacity 0→1 + translateY 4px→0 |
| 弹窗关闭 | 150ms | ease-in | opacity 1→0 |
| Toast 入场 | 250ms | `cb(0.16, 1, 0.3, 1)` | translateX(100%→0) |
| Toast 关闭 | 200ms | ease-in | opacity 1→0 + translateX(0→100%) |
| Stagger（列表） | 40–80ms | — | 入场间隔，最多 8 级 |

---

## VII. 背景 · Surfaces

### 页面背景

```
纯白 #FFFFFF。
Hero 区域从 open-design.ai 借鉴：顶部一条极细 accent 色带 + 全屏纯白底。
禁止 hero-gradient 大面积径向渐变。
```

### 卡片预览区

```
#F5F5F5 底 + 1px hairline 边。
图标预览不需要径向渐变装饰 — 让图标本身说话。
```

---

## VIII. 组件 · Components

### Button

```css
/* rest */
border-radius: 4px;
border: 1px solid rgba(10, 10, 10, 0.10);
background: transparent;
color: var(--ink);
font-family: 'Inter Tight', sans-serif;
font-weight: 600;

/* hover */
border-color: var(--primary);
color: var(--primary);

/* active */
border-radius: 0;         /* 刚性，提示"选择中" */
border-color: var(--primary);
background: var(--primary);
color: white;
```

> 不做 `0 3px 0 #xxx` 实色按压边。不做 shadow 上浮。状态切换靠 **border + color** 就够了。

### Button · Primary (Accent)

active 态与 button 一致，但 rest 态用 `background: var(--primary); color: white;`。

### Card

```css
border-radius: 6px;
border: 1px solid rgba(10, 10, 10, 0.10);
background: var(--base-100);
```

hover：border → `rgba(10, 10, 10, 0.18)`，可叠加 `0 2px 6px rgba(0,0,0,0.06)`。

### Input

```css
border-radius: 4px;
border: 1px solid rgba(10, 10, 10, 0.14);
background: var(--base-100);
```

focus：`outline: none; border-color: var(--primary);` — 只用 accent border，不用 ring。

### Tag · Badge

```css
border-radius: 4px;
font-family: 'IBM Plex Mono', monospace; /* 元数据用 mono */
font-size: 11px;
font-weight: 500;
letter-spacing: 0.04em;
text-transform: uppercase;
```

### Navbar

```css
background: var(--base-100);
border-bottom: 1px solid rgba(10, 10, 10, 0.10);
```

> 不做 backdrop-filter blur。不做 sticky header shadow。用 1px 底边做界限。

---

## IX. 图标规范 · Icon Grid

这是 Iconfont 产品的核心 — 图标本身的视觉规范。

### 画布

- **默认 grid**：24 × 24
- **出血**：0（icon 必须完全在 grid 内）
- **对齐**：center（水平和垂直均居中）

### 风格

- **Stroke**：2px，round-cap，round-join。线条粗细一致。
- **Fill**：纯黑色 `#0A0A0A`（跟随 ink 色，由 CSS 控制）。
- 单个项目内的图标风格应一致：要么全部 stroke，要么全部 fill。

### 命名

- 文件名：kebab-case，英文语义。如 `arrow-up.svg`、`user-circle.svg`。
- 不要中文文件名。不要空格。不要版本号后缀。
- 导入时系统会自动 trim `.svg` 后缀并 sanitize 非法字符。

### 颜色

- 单色图标 SVG 使用 `currentColor`，图标颜色由 CSS 的 `color` 属性控制。
- COLRv0 多色图标使用 `icons.color_layers` 字段存储颜色层 JSON。颜色编辑通过 `color-layer-editor` 组件完成。

---

## X. 代码规范 · Implementation

### 框架

- **Tailwind CSS v4** + **daisyUI** 主题插件（`@plugin "daisyui/theme"`）。
- 主题定义在 `src/global.css` 的 `@plugin "daisyui/theme"` 块中。
- 自定义类（如 `.brand-button`、`.brand-card`）也定义在 `src/global.css`。

### 文件位置

| 文件 | 内容 |
|---|---|
| `src/global.css` | 全局样式、daisyUI 主题、自定义组件类、animation keyframes |
| `src/routes/**/*.tsx` | 页面组件 |
| `src/components/**/*.tsx` | 共享 UI 组件 |

### 命名约定

- 自定义 CSS 类用 `brand-` 前缀（如 `.brand-card`、`.brand-input`），避免与 daisyUI / Tailwind 内置类冲突。
- 页面 dom 优先用 Tailwind 语义 utility，复杂布局才抽自定义类。

---

## XI. 反模式 · Anti-patterns

下面的每一项都是**硬性禁止**，不是"建议"：

- ❌ 不要写 `box-shadow` 在 rest 态的 card 上。
- ❌ 不要用玫瑰红色阴影 — `rgba(225, 29, 72, 0.x)` **全部禁止**。
- ❌ 不要写 `0 3px 0 #xxx` 实色按压边 — 用 border + color 替代。
- ❌ 不要用 `inset 0 1px 3px rgba(… )` inset glow — 任何情况下都不要。
- ❌ 不要写 `background: linear-gradient(…)` 在卡片或按钮上。
- ❌ 容器的 `border-radius` 不超过 8px（图标卡片除外）。
- ❌ 不要用 Nunito / Quicksand 等圆润 display 字体。
- ❌ 不要用 `cubic-bezier(0.34, 1.56, …)` spring / bounce / elastic 缓动。
- ❌ 不要 hover 时上移 + 缩放 + 阴影的复合动画 — 1 个属性最多。
- ❌ Dark mode 不要用 opacity hack 反转颜色 — 在 `[data-theme]` 下定义完整的 dark token。
- ❌ 不要对语义色做装饰性使用 — 绿色只表示成功，红色只表示错误/删除，黄色只表示警告。
- ❌ 不要忽略 active 态 — 每个可交互元素必须有 press 反馈。

---

## XII. 参考 · References

- [open-design.ai](https://open-design.ai) — Editorial studio manifest 体例
- [Inter Tight](https://fonts.google.com/specimen/Inter+Tight) — OFL，Google Fonts
- [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) — OFL，Google Fonts
- [daisyUI](https://daisyui.com) — Tailwind CSS 组件库
- `src/global.css` — 主题与自定义类实现（本文档是"应然"，global.css 是"实然"）
