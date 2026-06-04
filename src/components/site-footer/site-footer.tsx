import { component$ } from "@builder.io/qwik";

export const SiteFooter = component$(() => {
  const year = new Date().getFullYear();

  const linkClass =
    "text-sm text-[var(--color-base-400)] transition-colors hover:text-[var(--color-neutral)]";

  return (
    <footer class="border-t border-[var(--color-base-300)] bg-[var(--color-base-100)]">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div class="sm:col-span-2 lg:col-span-1">
            <a href="/" class="flex items-center gap-2">
              <div class="flex h-8 w-8 items-center justify-center rounded-md bg-rose-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
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
              <span class="text-base font-bold tracking-tight text-[var(--color-neutral)]">
                Iconfont
              </span>
            </a>
            <p class="mt-3 max-w-xs text-sm leading-relaxed text-[var(--color-base-400)]">
              开源 SVG 图标集管理与图标字体生成平台。上传、编辑、发布，一键生成
              TTF / CSS / Symbol。
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 class="mb-3 text-xs font-semibold tracking-wider text-[var(--color-base-400)] uppercase">
              产品
            </h4>
            <ul class="space-y-2">
              <li>
                <a href="/explore" class={linkClass}>
                  探索图标
                </a>
              </li>
              <li>
                <a href="/guide" class={linkClass}>
                  使用指南
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/sternelee/qwik-iconfont"
                  target="_blank"
                  rel="noopener noreferrer"
                  class={linkClass}
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 class="mb-3 text-xs font-semibold tracking-wider text-[var(--color-base-400)] uppercase">
              资源
            </h4>
            <ul class="space-y-2">
              <li>
                <a href="/guide#upload" class={linkClass}>
                  上传规范
                </a>
              </li>
              <li>
                <a href="/guide#font" class={linkClass}>
                  字体生成
                </a>
              </li>
              <li>
                <a href="/guide#api" class={linkClass}>
                  API 文档
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 class="mb-3 text-xs font-semibold tracking-wider text-[var(--color-base-400)] uppercase">
              法律
            </h4>
            <ul class="space-y-2">
              <li>
                <a href="/privacy" class={linkClass}>
                  隐私政策
                </a>
              </li>
              <li>
                <a href="/terms" class={linkClass}>
                  服务条款
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div class="mt-10 flex flex-col items-center justify-between gap-3 border-t border-[var(--color-base-300)] pt-6 sm:flex-row">
          <p class="text-xs text-[var(--color-base-400)]">
            © {year} Iconfont. 保留所有权利。
          </p>
          <p class="text-xs text-[var(--color-base-400)]">
            使用 Qwik City + Cloudflare Workers 构建
          </p>
        </div>
      </div>
    </footer>
  );
});
