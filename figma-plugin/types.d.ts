// Figma plugin global types
declare const figma: {
  showUI: (html: string, opts?: { width?: number; height?: number }) => void;
  currentPage: { selection: SceneNode[] };
  ui: {
    postMessage: (msg: any) => void;
    onmessage: ((msg: any) => void) | null;
  };
};
declare const __html__: string;

interface SceneNode {
  name: string;
  exportAsync: (opts: { format: string }) => Promise<Uint8Array>;
}
