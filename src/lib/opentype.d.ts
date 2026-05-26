declare module "opentype.js" {
  export class Path {
    constructor();
    static fromSVG(d: string): Path;
    transform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  }

  export class Glyph {
    constructor(options: {
      name: string;
      unicode?: number;
      advanceWidth: number;
      path: Path;
    });
  }

  export class Font {
    constructor(options: {
      familyName: string;
      styleName: string;
      unitsPerEm: number;
      ascender: number;
      descender: number;
      glyphs: Glyph[];
    });
    toArrayBuffer(): ArrayBuffer;
    download(fileName?: string): void;
  }
}
