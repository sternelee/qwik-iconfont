import { component$ } from "@builder.io/qwik";
import { type DocumentHead } from "@builder.io/qwik-city";
import { ThemeToggle } from "~/components/theme-toggle/theme-toggle";
import { UserMenu } from "~/components/user-menu/user-menu";

export const head: DocumentHead = {
  title: "使用指南 - Iconfont",
  meta: [
    {
      name: "description",
      content:
        "Iconfont 使用指南：从创建项目、上传 SVG、编辑图标到生成 TTF / CSS / Symbol 字体的完整教程。",
    },
  ],
};

export default component$(() => {
  const stepClass =
    "clay-card p-5 sm:p-6 transition-all hover:border-[var(--color-base-300)]";

  return (
    <div class="min-h-screen">
      {/* Navbar */}
      <header class="clay-navbar sticky top-0 z-30">
        <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <a href="/" class="flex items-center gap-3">
            <div class="bg-[var(--color-base-200)]0 flex h-10 w-10 items-center justify-center rounded-md">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <span class="text-lg font-extrabold tracking-tight text-rose-600">
              Iconfont
            </span>
          </a>
          <div class="flex items-center gap-3">
            <ThemeToggle />
            <a
              href="/explore"
              class="hidden rounded-md px-3 py-2 text-sm font-semibold text-[var(--color-neutral)] transition-all hover:bg-[var(--color-base-200)] sm:block"
            >
              探索
            </a>
            <UserMenu />
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        {/* Hero */}
        <div class="mb-12 text-center">
          <h1 class="text-3xl font-black tracking-tight text-[var(--color-neutral)] sm:text-4xl">
            使用指南
          </h1>
          <p class="mt-3 text-base text-[var(--color-base-400)]">
            从创建项目到生成字体，只需几步即可完成
          </p>
        </div>

        {/* Quick Start Steps */}
        <section class="mb-16">
          <h2 class="mb-6 text-xl font-bold text-[var(--color-neutral)]">
            快速开始
          </h2>
          <div class="space-y-4">
            <div class={stepClass}>
              <div class="flex items-start gap-4">
                <div class="bg-[var(--color-base-200)]0 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white">
                  1
                </div>
                <div>
                  <h3 class="text-base font-bold text-[var(--color-neutral)]">
                    创建项目
                  </h3>
                  <p class="mt-1 text-sm leading-relaxed text-[var(--color-base-400)]">
                    点击首页「新建项目」按钮，填写项目名称、描述、font-family 和
                    class 前缀。项目创建后即可进入编辑器。
                  </p>
                </div>
              </div>
            </div>

            <div class={stepClass}>
              <div class="flex items-start gap-4">
                <div class="bg-[var(--color-base-200)]0 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white">
                  2
                </div>
                <div>
                  <h3 class="text-base font-bold text-[var(--color-neutral)]">
                    上传或导入图标
                  </h3>
                  <p class="mt-1 text-sm leading-relaxed text-[var(--color-base-400)]">
                    在项目页直接拖拽 SVG 文件上传，或点击「从 GitHub
                    导入」批量导入开源图标库。支持 AI 生成图标和在线编辑 SVG
                    源码。
                  </p>
                </div>
              </div>
            </div>

            <div class={stepClass}>
              <div class="flex items-start gap-4">
                <div class="bg-[var(--color-base-200)]0 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white">
                  3
                </div>
                <div>
                  <h3 class="text-base font-bold text-[var(--color-neutral)]">
                    编辑与调整
                  </h3>
                  <p class="mt-1 text-sm leading-relaxed text-[var(--color-base-400)]">
                    为图标设置标签、调整颜色。对于多色 SVG，可使用 COLRv0
                    编辑器提取颜色层，生成彩色字体。
                  </p>
                </div>
              </div>
            </div>

            <div class={stepClass}>
              <div class="flex items-start gap-4">
                <div class="bg-[var(--color-base-200)]0 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white">
                  4
                </div>
                <div>
                  <h3 class="text-base font-bold text-[var(--color-neutral)]">
                    生成并下载
                  </h3>
                  <p class="mt-1 text-sm leading-relaxed text-[var(--color-base-400)]">
                    点击「生成字体」预览效果，支持导出 TTF、CSS、Symbol SVG 和
                    Demo HTML。也可以选择「发布」将资产托管到 CDN。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Upload Specs */}
        <section id="upload" class="mb-16">
          <h2 class="mb-6 text-xl font-bold text-[var(--color-neutral)]">
            上传规范
          </h2>
          <div class="clay-card p-5 sm:p-6">
            <ul class="space-y-3 text-sm text-[var(--color-base-400)]">
              <li class="flex items-start gap-2">
                <span class="mt-0.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-base-400)]" />
                <span>
                  <strong class="text-[var(--color-neutral)]">格式：</strong>
                  仅接受{" "}
                  <code class="rounded bg-[var(--color-base-200)] px-1 py-0.5 font-mono text-xs text-[var(--color-neutral)]">
                    .svg
                  </code>{" "}
                  文件，建议单个文件小于 50KB。
                </span>
              </li>
              <li class="flex items-start gap-2">
                <span class="mt-0.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-base-400)]" />
                <span>
                  <strong class="text-[var(--color-neutral)]">画布：</strong>
                  推荐 24×24 视口，图标居中，不留过多空白。
                </span>
              </li>
              <li class="flex items-start gap-2">
                <span class="mt-0.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-base-400)]" />
                <span>
                  <strong class="text-[var(--color-neutral)]">风格：</strong>
                  同一项目内保持风格统一（全部 stroke 或全部 fill）。stroke 推荐
                  2px，round-cap/round-join。
                </span>
              </li>
              <li class="flex items-start gap-2">
                <span class="mt-0.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-base-400)]" />
                <span>
                  <strong class="text-[var(--color-neutral)]">颜色：</strong>
                  单色图标使用{" "}
                  <code class="rounded bg-[var(--color-base-200)] px-1 py-0.5 font-mono text-xs text-[var(--color-neutral)]">
                    currentColor
                  </code>{" "}
                  ，由 CSS 控制颜色；多色图标将保留原始颜色。
                </span>
              </li>
              <li class="flex items-start gap-2">
                <span class="mt-0.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-base-400)]" />
                <span>
                  <strong class="text-[var(--color-neutral)]">命名：</strong>
                  文件名将被自动处理为 class 名称，仅保留{" "}
                  <code class="rounded bg-[var(--color-base-200)] px-1 py-0.5 font-mono text-xs text-[var(--color-neutral)]">
                    a-zA-Z0-9_-
                  </code>{" "}
                  字符。
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* Font Output */}
        <section id="font" class="mb-16">
          <h2 class="mb-6 text-xl font-bold text-[var(--color-neutral)]">
            字体生成说明
          </h2>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="clay-card p-5">
              <h3 class="mb-2 text-sm font-bold text-[var(--color-neutral)]">
                单色字体
              </h3>
              <p class="text-sm leading-relaxed text-[var(--color-base-400)]">
                使用 svg2ttf 将单色 SVG 转换为 TrueType 字体，同时生成 CSS
                文件和 Symbol SVG 精灵图。适合 Web 项目的常规图标需求。
              </p>
            </div>
            <div class="clay-card p-5">
              <h3 class="mb-2 text-sm font-bold text-[var(--color-neutral)]">
                COLRv0 彩色字体
              </h3>
              <p class="text-sm leading-relaxed text-[var(--color-base-400)]">
                对多色 SVG 提取颜色层，生成支持 CPAL 表的 COLRv0
                字体。可在现代浏览器中显示原生彩色图标。
              </p>
            </div>
          </div>
        </section>

        {/* API */}
        <section id="api" class="mb-16">
          <h2 class="mb-6 text-xl font-bold text-[var(--color-neutral)]">
            API 与集成
          </h2>
          <div class="clay-card p-5 sm:p-6">
            <p class="mb-4 text-sm text-[var(--color-base-400)]">
              登录后可在「个人设置 → API
              令牌」中创建访问令牌，用于程序化访问项目数据。
            </p>
            <div class="clay-inset overflow-x-auto p-3">
              <code class="block font-mono text-xs leading-relaxed text-[var(--color-neutral)]">
                GET /api/projects
                <br />
                Authorization: Bearer {"<your-token>"}
              </code>
            </div>
            <p class="mt-4 text-sm text-[var(--color-base-400)]">
              更多 API 文档正在完善中。如有需求，欢迎通过 GitHub Issues 反馈。
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section class="mb-12">
          <h2 class="mb-6 text-xl font-bold text-[var(--color-neutral)]">
            常见问题
          </h2>
          <div class="space-y-3">
            {[
              {
                q: "匿名模式和登录模式有什么区别？",
                a: "匿名模式下，项目数据仅保存在浏览器本地存储（localStorage）中，换设备或清除浏览器数据后会丢失。登录后项目将保存到云端数据库，可在任何设备访问。",
              },
              {
                q: "生成的字体可以商用吗？",
                a: "可以。你拥有上传 SVG 的完整版权，平台生成的字体文件归你所有，可自由用于商业项目。",
              },
              {
                q: "支持哪些浏览器？",
                a: "现代浏览器均支持，包括 Chrome、Firefox、Safari、Edge 最新两个主版本。COLRv0 彩色字体需要较新的浏览器支持。",
              },
              {
                q: "如何导出为 Figma 插件使用？",
                a: "目前支持直接下载 SVG 和 Symbol 文件。Figma 插件功能正在开发中，请关注 GitHub 仓库获取最新进展。",
              },
            ].map((item) => (
              <details key={item.q} class="clay-card group cursor-pointer">
                <summary class="flex items-center justify-between p-4 text-sm font-semibold text-[var(--color-neutral)] marker:hidden">
                  {item.q}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="shrink-0 text-[var(--color-base-400)] transition-transform group-open:rotate-180"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
                <div class="border-t border-[var(--color-base-300)] px-4 py-3 text-sm leading-relaxed text-[var(--color-base-400)]">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
});
