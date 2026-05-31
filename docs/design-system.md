# Iconfont 设计系统

本文档记录 Iconfont SaaS 平台的视觉设计规范，确保所有页面和组件保持一致的风格语言。

## 设计哲学

- **高对比度卡片风格**：纯白卡片 + 清晰边框，告别模糊内阴影，视觉层次通过颜色差异而非阴影扩散建立。
- **活力配色**：以玫瑰红为主色，搭配蓝色强调色，营造热情、专业且充满创造力的氛围。
- **友好字体**：Nunito（标题）+ DM Sans（正文），圆润、现代、易读。

### 设计方向修订（v2）

| 项目 | v1（旧） | v2（当前） |
|------|---------|-----------|
| 卡片阴影 | 多层 `8px 8px 20px` + 白色内光 | 单层 `0 2px 8px`，无内光 |
| hover 阴影 | `12px 16px 32px` | `0 6px 16px` |
| 背景 | 白→粉渐变 | 纯白 `#ffffff` |
| 边框 | `rgba(ffc, 0.6)` 极浅 | `rgba(rose, 0.15)` 清晰 |
| Navbar blur | `blur(20px) saturate(180%)` | `blur(8px) saturate(110%)` |
| Blob blur | `blur(60px)` | `blur(28px)` |
| base-200 | `#fff1f2` | `#ffeaec` （加深 +25%）|
| base-300 | `#ffe4e6` | `#ffc5cb` （加深 +40%）|

---

## 色彩系统

### 主色

| Token | Hex | 用途 |
|-------|-----|------|
| Primary | `#E11D48` | 主按钮、强调、选中态、图标 |
| Primary Dark | `#BE123C` | 按钮底部实色边（clay press 效果） |
| Secondary | `#FB7185` | 渐变装饰、轻量强调 |
| Accent | `#2563EB` | 次按钮、链接、信息提示 |
| Accent Dark | `#1D4ED8` | 次按钮底部实色边 |

### 背景色

| Token | Hex | 对比说明 |
|-------|-----|---------|
| Base-100 | `#FFFFFF` | 页面主背景（纯白，最大对比度基准） |
| Base-200 | `#FFEAEC` | 卡片背景、输入框凹陷区域 |
| Base-300 | `#FFC5CB` | 边框色、分割线（明显深于 base-200） |

### 文字色

| Token | Hex | 对比度（vs #fff） |
|-------|-----|-----------------|
| Content | `#3D0114` | ≈ 13:1（AAA） |
| Muted | `rgba(61, 1, 20, 0.55)` | ≈ 5.5:1（AA） |
| Light | `rgba(61, 1, 20, 0.35)` | 占位符 / 禁用 |

> 所有正文文字对比度须达到 WCAG AA 标准（4.5:1）。

### 语义色

| Token | Hex | 用途 |
|-------|-----|------|
| Success | `#22C55E` | 成功提示、完成状态 |
| Warning | `#F59E0B` | 警告、本地模式标签 |
| Error | `#DC2626` | 删除按钮、错误提示 |
| Info | `#3B82F6` | 提示信息、代码块背景 |

---

## 字体系统

### 字体栈

- **标题**：`Nunito, sans-serif` — 用于 h1-h6、按钮文字、统计数字、品牌标识。
- **正文**：`DM Sans, sans-serif` — 用于段落、表单、标签、描述。

### 字号层级

| 层级 | 字号 | 字重 | 用途 |
|------|------|------|------|
| Display | 48-64px | 900 | Hero 主标题 |
| H1 | 24-30px | 800 | 页面标题 |
| H2 | 18-20px | 700 | 区块标题 |
| H3 | 16px | 700 | 卡片标题 |
| Body | 14px | 400-500 | 正文 |
| Caption | 12px | 500 | 标签、辅助文字 |
| Mono | 12px | 400 | 代码、Unicode、数据 |

---

## 阴影规范（v2）

### 原则

- **单层阴影**：只用一层 `box-shadow`，方向朝下（`0 y blur rgba`），不叠加白色内光。
- **小扩散**：blur 半径最大 16px（卡片 hover 状态），静止 8px。
- **低 alpha**：`rgba(225,29,72, 0.08~0.14)`，不超过 0.2。
- **边框补充对比**：阴影不够时靠 border 加强层次，而非加大阴影。

### 数值表

| 状态 | 值 |
|------|-----|
| `.clay-card` 静止 | `0 2px 8px rgba(225,29,72, 0.10)` |
| `.clay-card:hover` | `0 6px 16px rgba(225,29,72, 0.14)` |
| `.clay-card:active` | `0 1px 4px rgba(225,29,72, 0.08)` |
| `.clay-icon-card` 静止 | `0 1px 4px rgba(225,29,72, 0.08)` |
| `.clay-icon-card:hover` | `0 4px 12px rgba(225,29,72, 0.12)` |
| `.clay-button` 实色边 | `0 3px 0 #BE123C` |
| `.clay-button` 扩散光 | `0 4px 8px rgba(225,29,72, 0.15)` |
| `.clay-navbar` | `0 1px 6px rgba(225,29,72, 0.06)` |

---

## 模糊规范（v2）

| 元素 | v1 | v2 |
|------|----|----|
| Navbar backdrop-filter | `blur(20px) saturate(180%)` | `blur(8px) saturate(110%)` |
| blob-1 filter | `blur(60px)` | `blur(28px)` |
| blob-2 filter | `blur(50px)` | `blur(24px)` |
| input-clay inset | 多层 | `inset 0 1px 3px` 单层 |

---

## 组件规范

### `.clay-card`

```css
border-radius: 24px;
background: #ffffff;
box-shadow: 0 2px 8px rgba(225, 29, 72, 0.10);
border: 1px solid rgba(225, 29, 72, 0.15);
```

hover：上移 3px + shadow 加深，border 加深至 0.25。  
active：回位，shadow 收至 0.08。

### `.clay-button`

```css
border-radius: 14px;
box-shadow: 0 3px 0 #BE123C, 0 4px 8px rgba(225,29,72, 0.15);
```

实色底边模拟物理按压感，hover 上移 1px（原 2px），active 下移 2px。

### `.clay-icon-card`

```css
border-radius: 20px;
background: #ffffff;
box-shadow: 0 1px 4px rgba(225, 29, 72, 0.08);
border: 1px solid rgba(225, 29, 72, 0.12);
```

### `.clay-inset`（统计栏 / 凹陷区域）

```css
border-radius: 16px;
background: #ffeaec;  /* base-200 */
box-shadow: inset 0 1px 3px rgba(225, 29, 72, 0.08);
border: 1px solid rgba(225, 29, 72, 0.14);
```

### `.clay-navbar`

```css
background: rgba(255, 255, 255, 0.92);
backdrop-filter: blur(8px) saturate(110%);
border-bottom: 1px solid rgba(225, 29, 72, 0.12);
box-shadow: 0 1px 6px rgba(225, 29, 72, 0.06);
```

### `.input-clay`

```css
border-radius: 12px;
background: #ffffff;
box-shadow: inset 0 1px 3px rgba(225, 29, 72, 0.06);
border: 1px solid rgba(225, 29, 72, 0.18);
```

focus：`0 0 0 2px rgba(225,29,72, 0.12)` + border 加深至 0.4。

---

## 布局规范

### 容器

- 最大宽度：`max-w-7xl`（1280px）
- 水平内边距：`px-4`（移动端）/ `px-6`（桌面端）
- 区块垂直间距：48-64px

### 网格

- 首页项目卡片：`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- 图标网格（中）：`grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8`
- 间距：`gap-5`

### 背景

- 页面背景：`.hero-gradient` — 两层极淡径向渐变叠加纯白底。
- 卡片内预览区：`.icon-preview-canvas` — 极淡双色径向渐变 + `#fafafa` 底色。

---

## 动画规范

### 入场动画

| 名称 | 时长 | 缓动 | 效果 |
|------|------|------|------|
| `fade-in-up` | 500ms | `cubic-bezier(0.16, 1, 0.3, 1)` | 上移 20px + 淡入 |
| `fade-in-scale` | 400ms | `cubic-bezier(0.16, 1, 0.3, 1)` | 缩放 0.92 → 1 + 淡入 |
| `pop` | 200ms | `cubic-bezier(0.16, 1, 0.3, 1)` | 缩放弹出 |

### 交互动画

| 名称 | 时长 | 效果 |
|------|------|------|
| 卡片 hover | 250ms | 上移 3px + shadow 加深 |
| 按钮 hover | 150ms | 上移 1px + shadow 加深 |
| 按钮 active | 150ms | 下移 2px + shadow 压缩 |

### 装饰动画

- `float`：3s，上下浮动 6px。
- `blob`：8s，有机形状变形，用于背景装饰 blob。
- `pulse-ring`：2s，脉冲光环，用于拖拽区域提示。

### Stagger 规则

- 列表项入场间隔：40-80ms
- 最多 8 级（`.stagger-1` 到 `.stagger-8`）

---

## 代码规范

### Tailwind CSS v4 + daisyUI

- 主题配置在 `src/global.css` 的 `@plugin "daisyui/theme"` 中。
- 自定义 clay 类定义在 `src/global.css`。
- 优先使用语义化 Tailwind 类，复杂样式使用自定义 CSS 类。

### 文件位置

- 全局样式：`src/global.css`
- 页面组件：`src/routes/*.tsx`
- 共享组件：`src/components/*`

---

## 反模式

- ❌ 不要叠加多层阴影（如同时用外阴影 + 白色内光）。
- ❌ 不要在卡片背景使用强渐变，用纯白 + 边框取代。
- ❌ backdrop-filter blur 不超过 12px，保持 UI 可辨性。
- ❌ 不要使用纯黑阴影（`rgba(0,0,0,0.x)`），使用玫瑰色调阴影。
- ❌ 不要使用直角或小圆角（< 12px 的容器）。
- ❌ 不要使用沉重、严肃的无衬线字体作为标题。
- ❌ 不要混合冷暖灰色，保持统一的暖色调灰。
- ❌ 不要忽略 hover/active 状态，每个可交互元素必须有反馈。
