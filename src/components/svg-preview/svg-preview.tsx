import { component$ } from "@builder.io/qwik";

function sanitizeSVG(svg: string): string {
  return svg
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\s(on\w+)=/gi, " data-disabled-$1=");
}

function applyColor(svg: string, color: string): string {
  // Replace explicit fill/stroke colors — skip fill="none" and fill="url(#...)" (gradients/patterns)
  let result = svg.replace(
    /\bfill="(?!none"|(?:url\())[^ "]*"/gi,
    `fill="${color}"`,
  );
  result = result.replace(
    /\bstroke="(?!none"|(?:url\())[^ "]*"/gi,
    `stroke="${color}"`,
  );
  // If no fill attribute at all, add to root svg
  if (!result.includes('fill="')) {
    result = result.replace(/<svg/i, `<svg fill="${color}"`);
  }
  return result;
}

/**
 * Safely render an SVG preview by encoding it as a data URL.
 * This prevents XSS from malicious SVG content (scripts, event handlers).
 * Optional `color` prop overrides SVG fill/stroke colors.
 */
export const SvgPreview = component$(
  (props: {
    content: string | null;
    class?: string;
    color?: string;
    loading?: "lazy" | "eager";
  }) => {
    const svg = props.content || "";
    let sanitized = sanitizeSVG(svg);

    if (props.color) {
      sanitized = applyColor(sanitized, props.color);
    }

    const dataUrl = `data:image/svg+xml,${encodeURIComponent(sanitized)}`;

    return (
      <img
        src={dataUrl}
        alt="icon"
        width="100"
        height="100"
        class={props.class || "h-full w-full object-contain"}
        loading={props.loading || "lazy"}
      />
    );
  },
);
