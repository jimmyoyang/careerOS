import { readFileSync } from "node:fs";
const template = readFileSync(
  new URL("./templates/zh-single-page.tex", import.meta.url),
  "utf8",
);
export function escapeLatex(text) {
  const chars = {
    "\\": "\\textbackslash{}",
    "{": "\\{",
    "}": "\\}",
    $: "\\$",
    "&": "\\&",
    "#": "\\#",
    "%": "\\%",
    _: "\\_",
    "~": "\\textasciitilde{}",
    "^": "\\textasciicircum{}",
  };
  return String(text).replace(/[\\{}$&#%_~^]/g, (char) => chars[char]);
}
export function renderLatex(input) {
  if (
    input?.templateVersion !== "zh-single-page-v1" ||
    typeof input.contact?.name !== "string" ||
    !input.contact.name.trim() ||
    input.contact.name.length > 80 ||
    !Array.isArray(input.blocks) ||
    input.blocks.length > 40 ||
    !input.blocks.length
  )
    throw new Error("INVALID_TEMPLATE_INPUT");
  for (const field of [input.contact.email ?? "", input.contact.phone ?? ""])
    if (typeof field !== "string" || field.length > 120)
      throw new Error("INVALID_TEMPLATE_INPUT");
  if (
    input.blocks.some(
      (block) =>
        typeof block.title !== "string" ||
        block.title.length > 200 ||
        typeof block.text !== "string" ||
        block.text.length > 8000,
    )
  )
    throw new Error("INVALID_TEMPLATE_INPUT");
  if (JSON.stringify(input).length > 40000)
    throw new Error("INVALID_TEMPLATE_INPUT");
  const values = {
    NAME: escapeLatex(input.contact.name),
    CONTACT: escapeLatex(
      [input.contact.email, input.contact.phone].filter(Boolean).join(" · "),
    ),
    BLOCKS: input.blocks
      .map(
        (block) =>
          `\\textbf{${escapeLatex(block.title)}}\\par\n${escapeLatex(block.text).replace(/\r?\n/g, "\\par\n")}\n\\vspace{2mm}`,
      )
      .join("\n"),
  };
  return template.replace(
    /\{\{(NAME|CONTACT|BLOCKS)\}\}/g,
    (_, key) => values[key],
  );
}
