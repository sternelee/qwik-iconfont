import { component$ } from "@builder.io/qwik";
import { type DocumentHead } from "@builder.io/qwik-city";

export const head: DocumentHead = {
  title: "页面未找到 - Iconfont",
  meta: [
    {
      name: "description",
      content: "您访问的页面不存在或已被移除。",
    },
  ],
};

export default component$(() => {
  return (
    <div class="flex min-h-screen flex-col items-center justify-center px-4">
      <div class="text-center">
        {/* Icon */}
        <div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-md bg-[var(--color-base-200)]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-[var(--color-base-400)]"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="9" x2="15" y2="15" />
            <line x1="15" y1="9" x2="9" y2="15" />
          </svg>
        </div>

        <h1 class="text-4xl font-black tracking-tight text-[var(--color-neutral)] sm:text-5xl">
          404
        </h1>
        <p class="mt-3 text-lg font-medium text-[var(--color-base-400)]">
          页面未找到
        </p>
        <p class="mt-1 text-sm text-[var(--color-base-400)]">
          您访问的页面不存在或已被移除
        </p>

        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/"
            class="clay-button inline-flex items-center gap-2 bg-rose-500 px-5 py-2.5 text-sm text-white"
          >
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
            >
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            返回首页
          </a>
          <a
            href="/explore"
            class="clay-button-secondary inline-flex items-center gap-2 border border-[var(--color-base-300)] bg-[var(--color-base-100)] px-5 py-2.5 text-sm text-[var(--color-neutral)] hover:border-[var(--color-base-300)] hover:bg-[var(--color-base-200)]"
          >
            探索图标
          </a>
        </div>
      </div>
    </div>
  );
});
