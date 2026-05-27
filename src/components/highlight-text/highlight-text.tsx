import { component$ } from "@builder.io/qwik";

export const HighlightText = component$(
  (props: { text: string; query: string; class?: string }) => {
    const { text, query } = props;
    if (!query) {
      return <span class={props.class}>{text}</span>;
    }
    const lowerQuery = query.toLowerCase();
    const lowerText = text.toLowerCase();
    const parts: { text: string; match: boolean }[] = [];
    let i = 0;
    while (i < text.length) {
      const idx = lowerText.indexOf(lowerQuery, i);
      if (idx === -1) {
        parts.push({ text: text.slice(i), match: false });
        break;
      }
      if (idx > i) {
        parts.push({ text: text.slice(i, idx), match: false });
      }
      parts.push({ text: text.slice(idx, idx + query.length), match: true });
      i = idx + query.length;
    }
    return (
      <span class={props.class}>
        {parts.map((part, idx) =>
          part.match ? (
            <mark key={idx} class="bg-primary/20 text-primary rounded px-0.5">
              {part.text}
            </mark>
          ) : (
            <span key={idx}>{part.text}</span>
          ),
        )}
      </span>
    );
  },
);
