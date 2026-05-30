# Iconfont 设计系统

本文档记录 Iconfont SaaS 平台的视觉设计规范，确保所有页面和组件保持一致的风格语言。

## 设计哲学

- **粘土形态（Claymorphism）**：柔和、有机、3D 感的界面元素，通过大圆角和多层阴影营造触觉体验。
- **活力配色**：以玫瑰红为主色，搭配蓝色强调色，营造热情、专业且充满创造力的氛围。
- **友好字体**：Nunito（标题）+ DM Sans（正文），圆润、现代、易读。

---

## 色彩系统

### 主色

| Token | Hex | 用途 |
|-------|-----|------|
| Primary | `#E11D48` | 主按钮、强调、选中态、图标 |
| Primary Dark | `#BE123C` | 按钮阴影底层、hover 深色 |
| Secondary | `#FB7185` | 渐变、装饰、轻量强调 |
| Accent | `#2563EB` | 次按钮、链接、信息提示 |
| Accent Dark | `#1D4ED8` | 次按钮阴影底层 |

### 背景色

| Token | Hex | 用途 |
|-------|-----|------|
| Base-100 | `#FFFBFB` | 页面主背景 |
| Base-200 | `#FFF1F2` | 卡片背景、渐变起点 |
| Base-300 | `#FFE4E6` | 边框、分割线 |

### 文字色

| Token | Hex | 用途 |
|-------|-----|------|
| Content | `#4A0418` | 正文、标题 |
| Muted | `rgba(74, 4, 24, 0.5)` | 副标题、描述、辅助文字 |
| Light | `rgba(74, 4, 24, 0.3)` | 占位符、禁用态 |

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

### 排版规则

- 标题使用负字距（`letter-spacing: -0.02em`）增强紧凑感。
- 正文行高 1.6，标题行高 1.2。
- 大写标签使用 `letter-spacing: 0.08em` + `text-transform: uppercase`。

---

## Claymorphism 规范

### 核心特征

1. **大圆角**：容器 24-32px，按钮 16px，输入框 14px，小元素 8-12px。
2. **多层阴影**：
   - 外阴影（右下）：`8px 8px 20px rgba(225, 29, 72, 0.08)`
   - 内阴影（左上）：`-4px -4px 12px rgba(255, 255, 255, 0.9)`
   - 内嵌高光（inset）：`inset 1px 1px 1px rgba(255, 255, 255, 0.6)`
3. **渐变背景**：从 `#ffffff` 到 `#FFF5F6` 的微妙渐变，模拟光照。
4. **边框**：1px 半透明白色或浅粉边框，增强边缘柔和感。

### 组件变体

#### `.clay-card`
```css
border-radius: 28px;
background: linear-gradient(145deg, #ffffff 0%, #FFF5F6 100%);
box-shadow:
  8px 8px 20px rgba(225, 29, 72, 0.08),
  -4px -4px 12px rgba(255, 255, 255, 0.9),
  inset 1px 1px 1px rgba(255, 255, 255, 0.6);
border: 1px solid rgba(255, 228, 230, 0.6);
```

**Hover**：上移 4px + 阴影加深。
**Active**：缩回 + 阴影减弱。

#### `.clay-button`
```css
border-radius: 16px;
font-family: 'Nunito', sans-serif;
font-weight: 700;
box-shadow: 0 4px 0 #BE123C, 0 6px 12px rgba(225, 29, 72, 0.25);
```

**Hover**：上移 2px + 阴影加深。
**Active**：下移 2px + 阴影压缩（模拟按压）。

**次按钮变体**：`.clay-button-secondary` — 将阴影色改为蓝色 `#1D4ED8`。

#### `.clay-icon-card`
```css
border-radius: 24px;
background: linear-gradient(145deg, #ffffff 0%, #FFF8F9 100%);
box-shadow:
  4px 4px 12px rgba(225, 29, 72, 0.06),
  -2px -2px 8px rgba(255, 255, 255, 0.8);
```

#### `.clay-inset`
凹陷容器，用于统计栏、输入框背景：
```css
border-radius: 20px;
background: linear-gradient(145deg, #FFF0F1 0%, #FFFBFB 100%);
box-shadow:
  inset 3px 3px 6px rgba(225, 29, 72, 0.06),
  inset -2px -2px 5px rgba(255, 255, 255, 0.8);
```

#### `.clay-navbar`
```css
background: rgba(255, 251, 251, 0.85);
backdrop-filter: blur(20px) saturate(180%);
border-bottom: 1px solid rgba(255, 228, 230, 0.5);
box-shadow: 0 1px 20px rgba(225, 29, 72, 0.04);
```

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

- 页面背景：`hero-gradient` — 多层径向渐变叠加，从左上玫瑰色光晕到右下蓝色光晕。
- 卡片内预览区：`icon-preview-canvas` — 双色径向渐变背景。

---

## 动画规范

### 入场动画

| 名称 | 时长 | 缓动 | 效果 |
|------|------|------|------|
| `fade-in-up` | 500ms | `cubic-bezier(0.16, 1, 0.3, 1)` | 上移 20px + 淡入 |
| `fade-in-scale` | 400ms | `cubic-bezier(0.16, 1, 0.3, 1)` | 缩放 0.92 → 1 + 淡入 |
| `pop` | 200ms | `cubic-bezier(0.16, 1, 0.3, 1)` | 缩放弹出 |

### 交互动画

| 名称 | 时长 | 缓动 | 效果 |
|------|------|------|------|
| 卡片 hover | 300ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 上移 4px + 阴影加深 |
| 按钮 hover | 150ms | ease | 上移 2px + 阴影加深 |
| 按钮 active | 150ms | ease | 下移 2px + 阴影压缩 |

### 装饰动画

- `float`：3s ease-in-out infinite，上下浮动 6px，用于装饰元素。
- `blob`：8s ease-in-out infinite，有机形状变形，用于背景装饰。
- `pulse-ring`：2s ease-in-out infinite，脉冲光环，用于拖拽区域提示。

###  stagger 规则

- 列表项入场间隔：40-80ms
- 最多 8 级 stagger（`.stagger-1` 到 `.stagger-8`）

---

## 组件规范

### 徽章（Badge）

- 圆角：`rounded-full`（pill 形状）
- 热门标签：玫瑰红渐变背景 + 白色文字 + 阴影
- 统计标签：浅色背景 + 小号圆角

### 输入框

- 使用 `.input-clay` 样式
- 聚焦态：外圈 3px 玫瑰色半透明光环

### 模态框

- 容器：`.clay-card`
- 头部：底部边框分隔
- 底部操作区：顶部边框分隔，右对齐按钮
- 关闭方式：点击 backdrop 或 Esc

### 空状态

- 居中布局
- 大号渐变图标背景（48-96px）
- 标题 + 描述 + 操作按钮

---

## 响应式断点

| 断点 | 宽度 | 说明 |
|------|------|------|
| sm | 640px | 小屏手机 |
| md | 768px | 平板 |
| lg | 1024px | 小桌面 |
| xl | 1280px | 标准桌面 |

### 关键响应式调整

- **Hero 标题**：`text-4xl` → `sm:text-5xl` → `lg:text-6xl`
- **项目卡片网格**：1 列 → 2 列 → 3 列
- **图标网格**：根据 `gridSize` 动态调整列数
- **Navbar 操作按钮**：桌面端平铺，移动端折叠到 dropdown

---

## 代码规范

### Tailwind CSS v4 + daisyUI

- 主题配置在 `src/global.css` 的 `@plugin "daisyui/theme"` 中。
- 自定义 claymorphism 类定义在 `src/global.css`。
- 优先使用语义化 Tailwind 类，复杂样式使用自定义 CSS 类。

### 文件位置

- 全局样式：`src/global.css`
- 页面组件：`src/routes/*.tsx`
- 共享组件：`src/components/*`

---

## 反模式

- ❌ 不要使用纯黑阴影（`rgba(0,0,0,0.x)`），使用玫瑰色调阴影。
- ❌ 不要使用直角或小圆角（< 12px 的容器）。
- ❌ 不要使用沉重、严肃的无衬线字体作为标题。
- ❌ 不要混合冷暖灰色，保持统一的暖色调灰。
- ❌ 不要忽略 hover/active 状态，每个可交互元素必须有反馈。
