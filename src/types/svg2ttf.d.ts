declare module "svg2ttf" {
  interface Svg2ttfOptions {
    copyright?: string;
    description?: string;
    ts?: number;
    url?: string;
    version?: string;
  }

  interface Svg2ttfResult {
    buffer: Uint8Array;
  }

  function svg2ttf(
    svgFontString: string,
    options?: Svg2ttfOptions,
  ): Svg2ttfResult;

  export default svg2ttf;
}
