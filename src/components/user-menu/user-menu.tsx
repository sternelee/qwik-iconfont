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
        class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md transition-all hover:bg-[var(--color-base-200)]"
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
          class="text-[var(--color-neutral)]"
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
            class="rounded-md px-3 py-2 text-sm text-[var(--color-neutral)] transition-all hover:bg-[var(--color-base-200)]"
          >
            ♥️ 我的收藏
          </a>
        </li>
        <li>
          <a
            href="/settings/profile"
            class="rounded-md px-3 py-2 text-sm text-[var(--color-neutral)] transition-all hover:bg-[var(--color-base-200)]"
          >
            👤 个人资料
          </a>
        </li>
        <li class="mt-1 border-t border-[var(--color-base-300)] pt-1">
          <button
            class="w-full rounded-md px-3 py-2 text-left text-sm text-[var(--color-neutral)] transition-all hover:bg-[var(--color-base-200)]"
            onClick$={handleSignOut}
          >
            退出登录
          </button>
        </li>
      </ul>
    </div>
  );
});
