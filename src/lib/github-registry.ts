// ── GitHub Icon Library Registry ────────────────────────────────────────────
// Curated list of popular open-source icon libraries on GitHub.
// Each entry describes where the SVGs live and how to build preview/raw URLs.

export interface IconLibraryVariant {
  id: string;
  label: string;
  /** Path inside the repo where .svg files live (no leading/trailing slash) */
  path: string;
}

export interface IconLibrary {
  id: string;
  name: string;
  description: string;
  repo: string; // "owner/repo"
  branch: string;
  license: string;
  iconCount: number;
  homepage: string;
  /** Brand color used for UI accents */
  color: string;
  /** When the library has multiple style variants (outline/solid/filled…) */
  variants?: IconLibraryVariant[];
  defaultVariant?: string;
  /** Direct icons path when there are no variants */
  iconsPath?: string;
}

export const ICON_LIBRARIES: IconLibrary[] = [
  {
    id: "lucide",
    name: "Lucide",
    description: "精美一致的开源图标库，1500+ SVG 图标",
    repo: "lucide-icons/lucide",
    branch: "main",
    iconsPath: "icons",
    license: "ISC",
    iconCount: 1500,
    homepage: "https://lucide.dev",
    color: "#f97316",
  },
  {
    id: "bootstrap",
    name: "Bootstrap Icons",
    description: "Bootstrap 官方图标库，2000+ 精美 SVG",
    repo: "twbs/icons",
    branch: "main",
    iconsPath: "icons",
    license: "MIT",
    iconCount: 2000,
    homepage: "https://icons.getbootstrap.com",
    color: "#7952b3",
  },
  {
    id: "heroicons",
    name: "Heroicons",
    description: "Tailwind CSS 官方图标，多种风格 SVG",
    repo: "tailwindlabs/heroicons",
    branch: "master",
    variants: [
      { id: "outline", label: "Outline (24px)", path: "src/24/outline" },
      { id: "solid", label: "Solid (24px)", path: "src/24/solid" },
      { id: "mini", label: "Mini (20px)", path: "src/20/solid" },
      { id: "micro", label: "Micro (16px)", path: "src/16/solid" },
    ],
    defaultVariant: "outline",
    license: "MIT",
    iconCount: 292,
    homepage: "https://heroicons.com",
    color: "#0ea5e9",
  },
  {
    id: "feather",
    name: "Feather",
    description: "简洁优雅，287 个轻量 SVG 图标",
    repo: "feathericons/feather",
    branch: "master",
    iconsPath: "icons",
    license: "MIT",
    iconCount: 287,
    homepage: "https://feathericons.com",
    color: "#22c55e",
  },
  {
    id: "tabler",
    name: "Tabler Icons",
    description: "5400+ 精美 SVG，多风格可选",
    repo: "tabler/tabler-icons",
    branch: "master",
    variants: [
      { id: "outline", label: "Outline", path: "icons/outline" },
      { id: "filled", label: "Filled", path: "icons/filled" },
    ],
    defaultVariant: "outline",
    license: "MIT",
    iconCount: 5400,
    homepage: "https://tabler.io/icons",
    color: "#2d6be4",
  },
  {
    id: "radix",
    name: "Radix Icons",
    description: "Radix UI 配套，318 个精致小图标",
    repo: "radix-ui/icons",
    branch: "main",
    iconsPath: "packages/radix-icons/icons",
    license: "MIT",
    iconCount: 318,
    homepage: "https://www.radix-ui.com/icons",
    color: "#1c1c1c",
  },
  {
    id: "phosphor",
    name: "Phosphor Icons",
    description: "灵活开源，多种风格 SVG 图标",
    repo: "phosphor-icons/phosphor-icons",
    branch: "master",
    variants: [
      { id: "regular", label: "Regular", path: "assets/regular" },
      { id: "bold", label: "Bold", path: "assets/bold" },
      { id: "light", label: "Light", path: "assets/light" },
      { id: "fill", label: "Fill", path: "assets/fill" },
      { id: "thin", label: "Thin", path: "assets/thin" },
      { id: "duotone", label: "Duotone", path: "assets/duotone" },
    ],
    defaultVariant: "regular",
    license: "MIT",
    iconCount: 1248,
    homepage: "https://phosphoricons.com",
    color: "#c5a028",
  },
];

/** Resolve the SVG directory path for a library (+ optional variant). */
export function resolveIconsPath(lib: IconLibrary, variantId?: string): string {
  if (lib.variants && lib.variants.length > 0) {
    const vid = variantId ?? lib.defaultVariant;
    const variant = lib.variants.find((v) => v.id === vid);
    return variant?.path ?? lib.variants[0].path;
  }
  return lib.iconsPath ?? "icons";
}

/** Build a raw.githubusercontent.com URL for a file in the repo. */
export function rawGitHubUrl(
  repo: string,
  branch: string,
  filePath: string,
): string {
  return `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`;
}

/** Look up a library by id. */
export function getLibrary(id: string): IconLibrary | undefined {
  return ICON_LIBRARIES.find((lib) => lib.id === id);
}
