import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  PromptInput,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";

function AttachedFiles() {
  const { files } = usePromptInputAttachments();
  return <output>{files.map((file) => file.filename).join(", ")}</output>;
}

function fileDragEvent(type: "dragover" | "drop", file: File) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: { types: ["Files"], files: [file] },
  });
  return event;
}

describe("PromptInput file drag and drop", () => {
  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:test-attachment"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it.each([false, true])(
    "accepts browser file drops and prevents navigation (globalDrop=%s)",
    async (globalDrop) => {
      const { container } = render(
        <PromptInput globalDrop={globalDrop} onSubmit={vi.fn()}>
          <AttachedFiles />
        </PromptInput>,
      );
      const target = globalDrop ? document : container.querySelector("form")!;
      const file = new File(["resume content"], "resume.txt", {
        type: "text/plain",
      });
      const dragOver = fileDragEvent("dragover", file);
      const drop = fileDragEvent("drop", file);

      fireEvent(target, dragOver);
      fireEvent(target, drop);

      expect(dragOver.defaultPrevented).toBe(true);
      expect(drop.defaultPrevented).toBe(true);
      await waitFor(() => expect(screen.getByText("resume.txt")).toBeInTheDocument());
    },
  );
});
