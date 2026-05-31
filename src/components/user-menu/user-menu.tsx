import { component$, $ } from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";

/**
 * Authenticated user dropdown menu.
 * Uses the daisyUI focus-based dropdown pattern so clicking outside
 * naturally closes the menu without JavaScript click-outside listeners.
 */
export const UserMenu = component$(() => {
  const nav = useNavigate();
  const handleSignOut = $(async () => {
    await fetch("/api/auth/sign-out", { method: "POST" });
    nav("/");
  });
  return (
    <div class="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-2xl transition-all hover:bg-rose-50"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-rose-600"
        >
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
      <ul
        tabIndex={0}
        class="menu dropdown-content clay-card z-10 mt-2 w-40 p-1.5"
      >
        <li>
          <a
            href="/favorites"
            class="rounded-xl px-3 py-2 text-sm text-rose-800 transition-all hover:bg-rose-50"
          >
            ♥️ 我的收藏
          </a>
        </li>
        <li>
          <a
            href="/settings/profile"
            class="rounded-xl px-3 py-2 text-sm text-rose-800 transition-all hover:bg-rose-50"
          >
            👤 个人资料
          </a>
        </li>
        <li class="mt-1 border-t border-rose-50 pt-1">
          <button
            class="w-full rounded-xl px-3 py-2 text-left text-sm text-rose-800 transition-all hover:bg-rose-50"
            onClick$={handleSignOut}
          >
            退出登录
          </button>
        </li>
      </ul>
    </div>
  );
});
