import type { Font } from "@react-pdf/renderer";
import type { FontQuartet } from "./tokens";

export const CJK_FONT_FAMILY = "NotoSansSC";

export function registerCjkFont(font: Pick<typeof Font, "register">) {
  font.register({
    family: CJK_FONT_FAMILY,
    src: "/fonts/NotoSansSC-Regular.ttf",
  });
}

export function pdfWordBreaks(word: string): string[] {
  if (!/\p{Script=Han}/u.test(word)) return [word];
  // Empty segments give react-pdf zero-width line breaks without adding hyphens
  // or changing the text. Keep closing punctuation with its preceding Han glyph.
  const parts = word.match(/\p{Script=Han}[、，。；：！？）】》”’]*|[^\p{Script=Han}]+/gu) ?? [word];
  return parts.flatMap((part) => [part, ""]);
}

// Keep the selected Latin faces, with a bundled font for missing Chinese glyphs.
export function withCjkFallback(font: FontQuartet) {
  return {
    regular: [font.regular, CJK_FONT_FAMILY],
    bold: [font.bold, CJK_FONT_FAMILY],
    italic: [font.italic, CJK_FONT_FAMILY],
    boldItalic: [font.boldItalic, CJK_FONT_FAMILY],
  };
}
