# Qwik Iconfont

一个开源的 SVG 图标集管理与字体生成平台，基于 **Qwik City + Cloudflare Workers**。支持上传、编辑、预览、导出图标字体，并提供公开图标库探索与 SaaS 多租户管理能力。

---

## 功能概览

### 图标管理

- 创建多个图标项目，每个项目独立配置 `font-family` 和 class 前缀
- 批量上传 SVG（拖拽 / 文件选择），自动过滤非 SVG 文件
- 搜索、排序、批量选择、重命名、删除
- SVG 编辑器：视图框调整、尺寸预览、颜色覆盖、路径变换（缩放 / 旋转 / 位移）
- **彩色图标编辑**：自动识别多色 SVG，点击路径即可修改颜色；导出 COLRv0 字体

### 字体导出

| 格式       | 说明                                |
| ---------- | ----------------------------------- |
| TTF        | TrueType 字体（单色或 COLRv0 彩色） |
| CSS        | `@font-face` + icon class 规则      |
| Symbol SVG | SVG 精灵图，通过 `<use>` 引用       |
| Demo HTML  | 独立演示页面                        |
| ZIP        | 以上全部打包                        |

### 探索与社区

- 公开图标集探索页（含浏览量 / 收藏数排序）
- Fork 他人图标集到自己账户
- 收藏公开项目（无需登录可浏览，登录才可收藏）
- 公开项目详情页：点击图标复制名称；悬浮 `+` 按钮→「添加到我的项目」Drawer（支持未登录本地暂存）

### GitHub 导入

- 粘贴任意 GitHub 目录 URL，从仓库一键批量导入 SVG
- 支持格式：`https://github.com/owner/repo/tree/branch/path`
- 支持搜索、全选（上限 500）、自定义项目名
- 10 分钟内存缓存 GitHub Trees API 响应

### SaaS 功能

- **用户认证**：邮件密码 + GitHub / Google OAuth（better-auth）
- **配额管理**：Free 10 项目 / 200 图标；Pro 无限制
- **API Token**：Bearer Token 程序化访问，SHA-256 哈希存储
- **Webhook**：项目事件推送（icon.created / deleted 等）
- **协作**：项目成员管理（owner / editor / viewer）
- **CDN 发布**：客户端生成字体 → base64 → 上传 R2，全球 CDN 访问

---

## 技术栈

| 层       | 技术                                        |
| -------- | ------------------------------------------- |
| 框架     | [Qwik City](https://qwik.dev/) SSR + Vite   |
| 样式     | Tailwind CSS v4 + daisyUI                   |
| 数据库   | Cloudflare D1（SQLite，Drizzle ORM）        |
| 对象存储 | Cloudflare R2                               |
| 认证     | [better-auth](https://www.better-auth.com/) |
| 字体生成 | svg2ttf + svgpath（客户端）                 |
| 彩色字体 | COLRv0 手动二进制构建（COLR/CPAL 表注入）   |
| 打包     | jszip（客户端 ZIP）                         |
| 部署     | Cloudflare Workers                          |

---

## 本地开发

### 前提条件

- Node.js ≥ 18 或 Bun ≥ 1.0
- pnpm ≥ 8
- （可选）Wrangler CLI：`pnpm add -g wrangler`

### 快速启动

```bash
# 克隆仓库
git clone https://github.com/your-org/qwik-iconfont.git
cd qwik-iconfont

# 安装依赖
pnpm install

# 启动 Vite 开发服务器（内存 Mock DB + R2，无需配置）
pnpm dev
```

访问 http://localhost:5173

> **说明**：`pnpm dev` 使用内存 Mock 数据库和 Mock R2，登录/注册功能不可用（需要真实 D1）。如需完整功能，使用 `pnpm serve`（见下文）。

### 使用 Wrangler 本地运行（完整功能）

```bash
# 创建本地 D1 数据库并运行迁移
pnpm db:migrate

# 启动 Wrangler 开发服务器（完整 Workers 运行时）
pnpm serve
```

访问 http://localhost:8788

### 常用命令

```bash
pnpm dev              # Vite SSR 开发服务器（快速，无 Workers 运行时）
pnpm serve            # Wrangler 开发服务器（完整功能）
pnpm build            # 生产构建
pnpm preview          # 预览生产构建
pnpm lint             # ESLint 检查
pnpm fmt              # Prettier 格式化
pnpm fmt.check        # 检查格式化
pnpm build.types      # TypeScript 类型检查
```

---

## Cloudflare Workers 部署

### 步骤 1：创建 Cloudflare 资源

#### D1 数据库

```bash
# 创建数据库
wrangler d1 create iconfont-db

# 记录输出的 database_id，填入 wrangler.jsonc
```

#### R2 存储桶

```bash
# 创建 R2 桶（存储 SVG 文件和生成的字体）
wrangler r2 bucket create iconfont-assets
```

### 步骤 2：配置 wrangler.jsonc

编辑项目根目录的 `wrangler.jsonc`：

```jsonc
{
  "name": "iconfont", // Workers 名称（也是子域名前缀）
  "main": "./dist/_worker.js",
  "compatibility_date": "2025-01-01",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": {
    "binding": "ASSET",
    "directory": "./dist",
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "iconfont-db",
      "database_id": "YOUR_DATABASE_ID", // ← 替换为步骤 1 的 ID
      "migrations_dir": "drizzle",
    },
  ],
  "r2_buckets": [
    {
      "binding": "BUCKET",
      "bucket_name": "iconfont-assets", // ← 与步骤 1 创建的桶名一致
    },
  ],
}
```

### 步骤 3：运行数据库迁移

```bash
# 应用所有迁移到远程 D1
pnpm db:migrate:remote
# 等同于：wrangler d1 migrations apply iconfont-db --remote
```

### 步骤 4：配置环境变量

所有变量已在 `wrangler.jsonc` 的 `vars` 节中预配置，直接填入对应值即可：

```jsonc
"vars": {
  "BETTER_AUTH_URL": "https://iconfont.your-domain.com",  // ← 替换为你的域名
  "BETTER_AUTH_SECRET": "your-random-secret-32-chars",    // ← 替换为随机字符串
  "GITHUB_CLIENT_ID": "your-github-client-id",
  // ...
}
```

> **安全提示**：`wrangler.jsonc` 中的变量明文存储，建议将含 `_SECRET` / `_KEY` 的敏感值
> 改用加密 Secrets（不出现在代码库中）：
>
> ```bash
> wrangler secret put BETTER_AUTH_SECRET
> wrangler secret put GITHUB_CLIENT_SECRET
> wrangler secret put GOOGLE_CLIENT_SECRET
> wrangler secret put RESEND_API_KEY
> ```

#### 本地开发环境变量

复制 `.dev.vars.example` 为 `.dev.vars`（已加入 `.gitignore`），填入本地值：

```bash
cp .dev.vars.example .dev.vars
# 然后编辑 .dev.vars，填入本地开发使用的 Key
```

`pnpm serve`（Wrangler 开发服务器）会自动读取 `.dev.vars`，优先级高于 `wrangler.jsonc vars`。

#### 配置 OAuth 应用

**GitHub OAuth App**

1. 进入 https://github.com/settings/developers → OAuth Apps → New
2. Homepage URL：`https://iconfont.your-domain.com`
3. Callback URL：`https://iconfont.your-domain.com/api/auth/callback/github`

**Google OAuth**

1. 进入 https://console.cloud.google.com → APIs & Services → Credentials
2. 创建 OAuth 2.0 Client ID（Web application）
3. 授权重定向 URI：`https://iconfont.your-domain.com/api/auth/callback/google`

### 步骤 5：构建并部署

```bash
# 构建
pnpm build

# 部署到 Cloudflare Workers
pnpm deploy
# 等同于：wrangler deploy
```

部署完成后访问：`https://iconfont.<your-subdomain>.workers.dev`

### 步骤 6：绑定自定义域名（可选）

```bash
# 在 Cloudflare Dashboard：
# Workers & Pages → iconfont → Settings → Domains & Routes → Add Custom Domain
# 输入你的域名，Cloudflare 自动配置 DNS 和 SSL
```

---

## 数据库迁移

项目使用 **Drizzle ORM** 管理 Schema，迁移文件在 `drizzle/` 目录。

```bash
# 生成新的迁移文件（修改 src/lib/schema.ts 后执行）
pnpm db:generate
# 等同于：drizzle-kit generate

# 应用到本地 D1（开发）
pnpm db:migrate
# 等同于：wrangler d1 migrations apply iconfont-db --local

# 应用到远程 D1（生产）
pnpm db:migrate:remote
# 等同于：wrangler d1 migrations apply iconfont-db --remote
```

### Schema 概览

```
projects    — 图标集项目（owner, font_family, prefix, visibility...）
icons       — 图标记录（name, unicode, svg_path, content, color_layers...）
user        — 用户（better-auth 管理）
session     — 会话（better-auth 管理）
account     — OAuth 账户绑定（better-auth 管理）
favorites   — 用户收藏
members     — 项目成员（协作）
api_tokens  — API Token（SHA-256 哈希存储）
webhooks    — Webhook 配置
```

---

## 环境变量速查

| 变量                   | 必填 | 说明                                  |
| ---------------------- | ---- | ------------------------------------- |
| `BETTER_AUTH_SECRET`   | ✅   | Session 签名密钥，随机字符串          |
| `BETTER_AUTH_URL`      | ✅   | 应用公开 URL，用于 OAuth 回调         |
| `GITHUB_CLIENT_ID`     | ⬜   | GitHub OAuth，留空则禁用              |
| `GITHUB_CLIENT_SECRET` | ⬜   | GitHub OAuth                          |
| `GOOGLE_CLIENT_ID`     | ⬜   | Google OAuth，留空则禁用              |
| `GOOGLE_CLIENT_SECRET` | ⬜   | Google OAuth                          |
| `RESEND_API_KEY`       | ⬜   | 注册欢迎邮件，留空则跳过              |
| `EMAIL_FROM`           | ⬜   | 发件地址，默认 `noreply@iconfont.app` |
| `GITHUB_TOKEN`         | ⬜   | GitHub 导入速率提升 60→5000/h         |

---

## API 参考

所有 API 支持 Bearer Token 认证（在「个人设置 → API Token」中生成）：

```http
Authorization: Bearer <your-token>
```

### 项目

```
GET    /api/projects              列出我的项目
POST   /api/projects              创建项目
GET    /api/projects/:id          获取项目详情
PUT    /api/projects/:id          更新项目
DELETE /api/projects/:id          删除项目
POST   /api/projects/:id/fork     Fork 公开项目
POST   /api/projects/:id/publish  发布/更新 CDN
```

### 图标

```
GET    /api/projects/:id/icons         列出图标
POST   /api/projects/:id/icons         上传图标（multipart: name, content, [colorLayers]）
POST   /api/projects/:id/icons/reorder 批量排序
GET    /api/icons/:id                  图标详情
PUT    /api/icons/:id                  更新图标元数据
DELETE /api/icons/:id                  删除图标
GET    /api/icons/:id/svg              下载原始 SVG
```

### GitHub 导入

```
GET  /api/github-import?url=<github-tree-url>       预览图标列表
POST /api/github-import                              执行导入
     Body: { url, icons: string[], projectName }
```

### Webhook

```
GET    /api/webhooks         列出 Webhook
POST   /api/webhooks         创建 Webhook
PUT    /api/webhooks/:id     更新
DELETE /api/webhooks/:id     删除
```

事件类型：`icon.created` `icon.updated` `icon.deleted` `project.updated`

---

## 使用指南

### 快速上手

1. **注册 / 登录**
2. **新建项目**：填写名称、font-family、class 前缀
3. **上传图标**：拖拽 SVG 文件到项目页面
4. **选择图标** → 点击「生成代码」→ 复制 CSS/HTML 代码
5. **下载字体**：下载 TTF，或「打包下载」获取完整资源包

### 彩色图标

1. 上传多色 SVG（包含多个不同 `fill` 颜色的 path）
2. 点击「编辑」进入 SVG 编辑器
3. 编辑器左侧自动显示彩色画布（可点击 path 选择）
4. 右侧「颜色」面板显示路径色块，点击修改颜色
5. 保存后导出 COLRv0 TTF 字体（IE9 / iOS 11+ 支持）

### 从 GitHub 导入图标库

1. 在首页点击「从 GitHub 导入」
2. 粘贴 GitHub 目录 URL，例如：
   ```
   https://github.com/lucide-icons/lucide/tree/main/icons
   ```
3. 搜索 / 勾选需要的图标（最多 500 个）
4. 填写项目名称，点击「导入」

### 公开图标集

- 探索页（`/explore`）浏览所有公开项目，按热门 / 最新排序
- 点击项目进入公开详情页，悬浮图标卡片右上角出现 `+`
- 点击 `+` 打开「添加到项目」侧边栏，选择目标项目后保存

### Font Class 使用方式

```html
<!-- 引入 CSS -->
<link rel="stylesheet" href="https://cdn.example.com/iconfont.css" />

<!-- 使用图标 -->
<i class="icon icon-home"></i>
<i class="icon icon-user"></i>
```

### Symbol SVG 使用方式

```html
<!-- 引入 Symbol 精灵图（通常放在 body 开头） -->
<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
  <!-- iconfont.symbol.svg 内容 -->
</svg>

<!-- 引用图标 -->
<svg width="24" height="24" aria-hidden="true">
  <use href="#icon-home"></use>
</svg>
```

---

## 键盘快捷键

| 快捷键   | 功能                |
| -------- | ------------------- |
| `/`      | 聚焦搜索框          |
| `?`      | 显示快捷键帮助      |
| `Esc`    | 关闭弹窗 / 取消选择 |
| `Ctrl+A` | 全选当前过滤结果    |

---

## 项目结构

```
src/
├── components/          UI 组件
│   ├── svg-editor/      SVG 编辑器（ViewBox / 变换 / 颜色）
│   ├── svg-color-editor/ 彩色路径编辑器（COLRv0）
│   ├── color-layer-editor/ COLR 图层管理
│   ├── add-to-project/  「添加到项目」Drawer
│   ├── github-import/   GitHub 导入 Modal
│   └── ...
├── lib/
│   ├── auth.ts          better-auth 实例工厂
│   ├── db.ts            D1 适配器（含 Date→ISO 代理）
│   ├── schema.ts        Drizzle ORM Schema
│   ├── storage.ts       R2 存储（+ MockBucket 开发回退）
│   ├── font-gen.ts      SVG→TTF 生成（svg2ttf pipeline）
│   ├── colr-font-gen.ts COLRv0 彩色字体生成
│   ├── svg-color-extractor.ts 多色 SVG 解析
│   ├── quota.ts         配额配置（free / pro）
│   ├── webhook.ts       Webhook 触发逻辑
│   ├── local-storage.ts 匿名用户本地数据
│   └── types.ts         TypeScript 接口
├── routes/
│   ├── index.tsx        首页（项目列表）
│   ├── explore/         公开探索页
│   ├── favorites/       我的收藏
│   ├── project/[id]/    项目详情 + 公开详情
│   ├── settings/        个人资料 / API Token / Webhook
│   ├── login/ register/ 认证页
│   └── api/             REST API 路由
drizzle/                 数据库迁移文件
adapters/                Cloudflare Workers 构建适配器
```

---

## 贡献指南

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feat/your-feature`
3. 提交：`git commit -m "feat: description"`
4. 确保 `pnpm lint` 和 `npx tsc --noEmit` 无报错
5. 发起 Pull Request

---

## 许可证

[MIT](LICENSE)
