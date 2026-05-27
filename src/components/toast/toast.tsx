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

  const alertClass = {
    success: "alert-success",
    error: "alert-error",
    info: "alert-info",
  };

  return (
    <div class="pointer-events-none fixed top-4 right-4 z-50 flex flex-col gap-2">
      {props.toasts.map((toast) => (
        <div
          key={toast.id}
          class={`alert ${alertClass[toast.type]} pointer-events-auto min-w-[240px] shadow-lg animate-toast-in`}
        >
          <div class="flex items-center gap-2">
            {iconMap[toast.type]}
            <span class="text-sm">{toast.message}</span>
          </div>
        </div>
      ))}
    </div>
  );
});
