import { component$ } from "@builder.io/qwik";

/**
 * Safely render an SVG preview by encoding it as a data URL.
 * This prevents XSS from malicious SVG content (scripts, event handlers).
 */
export const SvgPreview = component$((props: { content: string | null; class?: string }) => {
  const svg = props.content || "";
  // Sanitize: remove script tags and event handlers
  const sanitized = svg
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\s(on\w+)=/gi, " data-disabled-$1=");

  const dataUrl = `data:image/svg+xml,${encodeURIComponent(sanitized)}`;

  return (
    <img
      src={dataUrl}
      alt="icon"
      width="100"
      height="100"
      class={props.class || "w-full h-full object-contain"}
      loading="lazy"
    />
  );
});
