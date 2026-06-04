import { component$ } from "@builder.io/qwik";

export interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export const ToastContainer = component$((props: { toasts: ToastItem[] }) => {
  const iconMap = {
    success: (
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
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    error: (
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
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="15" x2="9" y1="9" y2="15" />
        <line x1="9" x2="15" y1="9" y2="15" />
      </svg>
    ),
    info: (
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
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" x2="12" y1="16" y2="12" />
        <line x1="12" x2="12.01" y1="8" y2="8" />
      </svg>
    ),
  };

  const typeStyles = {
    success: "border-l-emerald-500 text-emerald-600 dark:text-emerald-400",
    error: "border-l-rose-500 text-rose-600 dark:text-rose-400",
    info: "border-l-blue-500 text-blue-600 dark:text-blue-400",
  };

  return (
    <div class="pointer-events-none fixed top-4 right-4 z-50 flex flex-col gap-2">
      {props.toasts.map((toast) => (
        <div
          key={toast.id}
          class={`animate-toast-in pointer-events-auto relative flex max-w-sm min-w-[240px] items-center gap-3 overflow-hidden rounded-md border border-l-4 border-[var(--color-base-300)] bg-[var(--color-base-100)] px-4 py-3 shadow-sm ${typeStyles[toast.type]}`}
        >
          {iconMap[toast.type]}
          <span class="flex-1 text-sm font-medium text-[var(--color-neutral)]">
            {toast.message}
          </span>
          <div class="toast-progress absolute bottom-0 left-0 h-0.5 bg-current opacity-30" />
        </div>
      ))}
    </div>
  );
});
