# Iconfont 开源版

一个开源的 iconfont 管理和生成服务，帮助你轻松上传 SVG 图标、管理图标项目，并生成可用于 Web 的字体文件（TTF）、CSS、Symbol SVG 和演示页面。

## 功能特性

- **项目管理**：创建多个图标库项目，每个项目独立配置 font-family 和 class 前缀
- **批量上传**：支持拖拽上传多个 SVG 文件
- **图标管理**：搜索、排序、批量选择、批量重命名、批量删除
- **元数据编辑**：调整图标名称、Unicode 编码、ViewBox
- **实时预览**：字体预览、Symbol 预览、颜色切换
- **多种输出格式**：
  - **Font Class**：生成 `@font-face` CSS，通过 class 引用图标
  - **Symbol**：生成 SVG Symbol 精灵图，通过 `<use>` 引用
  - **Unicode**：生成 Unicode 内联 HTML
- **一键下载**：单独下载 TTF 字体，或打包下载（TTF + CSS + Symbol SVG + Demo HTML）
- **键盘快捷键**：`/` 搜索聚焦、`?` 快捷键帮助、`Esc` 关闭弹窗

## 技术架构

- **前端框架**：[Qwik City](https://qwik.dev/) + Vite
- **样式**：Tailwind CSS v4 + daisyUI
- **数据库**：Cloudflare D1（SQLite）
- **对象存储**：Cloudflare R2（SVG 文件存储）
- **字体生成**：[opentype.js](https://opentype.js.org/)（客户端生成 TTF）
- **打包下载**：[jszip](https://stuk.github.io/jszip/)
- **部署**：Cloudflare Workers

## 快速开始

### 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 或启动并自动打开浏览器
pnpm start
```

本地开发时，数据库和对象存储会自动使用内存模拟（Mock），无需配置 Cloudflare 绑定即可运行。

### 构建

```bash
# 类型检查 + 客户端构建 + 服务端构建
pnpm build

# 仅类型检查
pnpm build.types

# 本地预览生产构建
pnpm preview
```

### 代码规范

```bash
pnpm lint      # ESLint 检查
pnpm fmt       # Prettier 格式化
pnpm fmt.check # 检查格式化
```

## 使用指南

### 1. 创建项目

进入首页，点击"新建项目"按钮，填写：

- **项目名称**：项目的标识名称
- **描述**（可选）：项目说明
- **Font Family**：CSS 中使用的字体族名称，默认 `iconfont`
- **Class 前缀**：图标 class 的前缀，默认 `icon-`

### 2. 上传图标

进入项目详情页，点击"上传图标"按钮选择 SVG 文件，或直接将 SVG 文件拖拽到页面中。

> **提示**：系统会自动过滤非 SVG 文件，上传成功后会自动添加到图标列表。

### 3. 管理图标

- **搜索**：在搜索框输入图标名称快速查找
- **排序**：按名称、时间或 Unicode 排序
- **选择**：点击图标卡片左上角的复选框进行选择，或使用"全选"
- **批量操作**：选中多个图标后，可以进行批量重命名或批量删除
- **编辑**：点击图标名称进入编辑弹窗，可修改：
  - 图标名称（影响 class 名和文件名）
  - Unicode 编码（可点击"自动生成"）
  - ViewBox（影响字体生成时的缩放比例）

### 4. 生成字体

选中需要生成的图标，点击"生成代码"按钮，在弹窗中切换三种模式：

#### Font Class 模式

生成 `@font-face` CSS 代码。在 HTML 中使用方式：

```html
<i class="iconfont icon-home"></i>
```

#### Symbol 模式

生成 SVG Symbol 精灵图。在 HTML 中使用方式：

```html
<svg aria-hidden="true">
  <use href="#icon-home"></use>
</svg>
```

#### Unicode 模式

生成 Unicode 内联 HTML：

```html
<i class="iconfont">&#xe600;</i>
```

### 5. 下载字体

- **下载字体**：仅下载 `.ttf` 字体文件
- **打包下载**：下载 zip 包，包含 TTF + CSS + Symbol SVG + Demo HTML

### 6. 项目设置

点击"项目设置"可修改项目的 font-family、class 前缀等配置。

## 键盘快捷键

| 快捷键   | 功能                   |
| -------- | ---------------------- |
| `/`      | 聚焦搜索框             |
| `?`      | 显示快捷键帮助         |
| `Esc`    | 关闭弹窗/取消选择      |
| `Ctrl+A` | 全选当前过滤结果的图标 |

## 部署

本项目配置为部署到 Cloudflare Workers。

### 配置 wrangler

编辑 `wrangler.jsonc`，配置 D1 数据库和 R2 存储桶绑定：

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "your-db-name",
      "database_id": "your-db-id",
    },
  ],
  "r2_buckets": [
    {
      "binding": "BUCKET",
      "bucket_name": "your-bucket-name",
    },
  ],
}
```

### 部署命令

```bash
# 使用 wrangler 部署
npx wrangler deploy
```

## 数据结构

### projects 表

| 字段        | 说明           |
| ----------- | -------------- |
| id          | 项目 ID        |
| name        | 项目名称       |
| description | 项目描述       |
| font_family | 字体族名称     |
| prefix      | CSS class 前缀 |
| created_at  | 创建时间       |
| updated_at  | 更新时间       |

### icons 表

| 字段       | 说明             |
| ---------- | ---------------- |
| id         | 图标 ID          |
| project_id | 所属项目 ID      |
| name       | 图标名称         |
| unicode    | Unicode 编码     |
| svg_path   | R2 存储路径      |
| view_box   | SVG viewBox      |
| content    | SVG 内容（缓存） |
| created_at | 创建时间         |
| updated_at | 更新时间         |

## 许可证

MIT
