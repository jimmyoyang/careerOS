export function escapeLatex(text: string): string;
export function renderLatex(input: {
  templateVersion: string;
  contact: { name: string; email?: string; phone?: string };
  blocks: Array<{ title: string; text: string }>;
}): string;
