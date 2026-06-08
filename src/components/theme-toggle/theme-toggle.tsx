import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";

const LIGHT = "iconfont";
const DARK = "iconfont-dark";
const KEY = "theme";

export const ThemeToggle = component$(() => {
  const isDark = useSignal(false);

  // localStorage + matchMedia + DOM — client only
  useVisibleTask$(() => {
    // 读取存储的偏好，或跟随系统
    const stored = localStorage.getItem(KEY);
    const prefersDark =
      stored === DARK ||
      (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    isDark.value = prefersDark;
    document.documentElement.setAttribute(
      "data-theme",
      prefersDark ? DARK : LIGHT,
    );
  });

  return (
    <button
      type="button"
      aria-label={isDark.value ? "切换到亮色模式" : "切换到暗色模式"}
      title={isDark.value ? "切换到亮色模式" : "切换到暗色模式"}
      class="[data-theme='iconfont-dark']_&:hover:bg-rose-950/40 flex h-9 w-9 items-center justify-center rounded-md transition-all hover:bg-[var(--color-base-200)] active:scale-95"
      onClick$={() => {
        const next = isDark.value ? LIGHT : DARK;
        isDark.value = !isDark.value;
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem(KEY, next);
      }}
    >
      {isDark.value ? (
        /* Sun icon */
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
          class="text-amber-400"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        /* Moon icon */
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
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
});
