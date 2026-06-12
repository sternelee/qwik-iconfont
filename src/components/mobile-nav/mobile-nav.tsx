import { component$ } from "@builder.io/qwik";

export const MobileNav = component$(() => {
  return (
    <div class="dropdown dropdown-end sm:hidden">
      <button
        tabIndex={0}
        class="btn btn-ghost btn-square h-10 w-10"
        aria-label="打开导航菜单"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="3" x2="21" y1="6" y2="6" />
          <line x1="3" x2="21" y1="12" y2="12" />
          <line x1="3" x2="21" y1="18" y2="18" />
        </svg>
      </button>
      <ul
        tabIndex={0}
        class="menu dropdown-content bg-base-100 rounded-box z-[60] mt-2 w-40 p-2 shadow"
      >
        <li>
          <a href="/" class="text-sm font-medium">首页</a>
        </li>
        <li>
          <a href="/explore" class="text-sm font-medium">探索</a>
        </li>
        <li>
          <a href="/favorites" class="text-sm font-medium">收藏</a>
        </li>
        <li>
          <a href="/settings/profile" class="text-sm font-medium">设置</a>
        </li>
      </ul>
    </div>
  );
});
