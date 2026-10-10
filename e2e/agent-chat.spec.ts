import { type Page } from "@playwright/test";
import { test, expect } from "./fixtures";

// The chat writes nothing of its own to the DB — /api/ai/chat is stubbed, so
// the route's persistence and the model never run. No cleanup registration.

const SSE_HEADERS = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache",
  "x-vercel-ai-ui-message-stream": "v1",
};

// Matches JsonToSseTransformStream: one `data: <json>` frame per chunk, then
// the [DONE] terminator DefaultChatTransport's parser stops on.
function sse(chunks: Record<string, unknown>[]): string {
  return (
    chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") +
    "data: [DONE]\n\n"
  );
}

function textTurn(text: string): Record<string, unknown>[] {
  return [
    { type: "start" },
    { type: "start-step" },
    { type: "text-start", id: "t1" },
    { type: "text-delta", id: "t1", delta: text },
    { type: "text-end", id: "t1" },
    { type: "finish-step" },
    { type: "finish" },
  ];
}

const ADD_JOB_INPUT = {
  company: "Northwind Trading",
  jobTitle: "Staff Platform Engineer",
  location: "Remote",
  source: "Company website",
  jobUrl: "https://northwind.example/careers/42",
  salaryRange: "$190k – $220k",
  tags: ["kubernetes", "go"],
};

function approvalTurn(): Record<string, unknown>[] {
  return [
    { type: "start" },
    { type: "start-step" },
    { type: "tool-input-start", toolCallId: "call-1", toolName: "add_job" },
    {
      type: "tool-input-available",
      toolCallId: "call-1",
      toolName: "add_job",
      input: ADD_JOB_INPUT,
    },
    { type: "tool-approval-request", approvalId: "appr-1", toolCallId: "call-1" },
    { type: "finish-step" },
    { type: "finish" },
  ];
}

// The denial POST continues the SAME assistant message, so it must carry that
// message's id — exactly what the real route does via `originalMessages`.
function deniedTurn(messageId: string): Record<string, unknown>[] {
  return [
    { type: "start", messageId },
    { type: "start-step" },
    { type: "tool-output-denied", toolCallId: "call-1" },
    { type: "finish-step" },
    { type: "finish" },
  ];
}

async function openChat(page: Page) {
  // open() runs a real preflight fetch to check Ollama's reachability before
  // Send is enabled. Stub it so the panel doesn't depend on a live local
  // Ollama daemon — an unmocked call here raced the disabled Send button
  // against test steps and made "keeps the transcript..." flaky.
  await page.route("**/api/ai/ollama/tags", (route) =>
    route.fulfill({ contentType: "application/json", body: "{}" }),
  );
  await page.goto("/dashboard/myjobs");
  await page.getByRole("button", { name: "打开助手" }).click();
  // A shared user can carry a transcript in from another run or a manual
  // pass, so start from Clear. Then reload: clear() calls setMessages([])
  // only after the server action resolves, and waiting on the HTTP response
  // is not enough — it resolves on headers, while the action settles after
  // the RSC body is parsed. A late wipe would swallow the first message the
  // test sends. Remounting past it is deterministic; the row is already
  // deleted by the time the response arrives.
  await Promise.all([
    page.waitForResponse(
      (res) => res.request().method() === "POST" && res.url().includes("/dashboard"),
    ),
    page.getByRole("button", { name: "清空" }).click(),
  ]);
  await page.reload();
  await page.getByRole("button", { name: "打开助手" }).click();
  await expect(page.getByText(/我可以帮您添加要跟踪的岗位/)).toBeVisible();
}

async function send(page: Page, text: string) {
  const box = page.getByRole("textbox", { name: /提问或粘贴招聘信息/i });
  await box.fill(text);
  await page.getByRole("button", { name: "发送" }).click();
}

test.describe("agent chat", () => {
  test("opens from the header, leaves the page usable, and closes", async ({
    page,
  }) => {
    await openChat(page);

    // Docked, not a takeover: the page behind is still clickable, and the
    // panel survives the navigation because the provider is in the layout.
    await page.getByRole("link", { name: "待办事项" }).click();
    await expect(page).toHaveURL(/\/dashboard\/tasks/);
    await expect(page.getByRole("button", { name: "清空" })).toBeVisible();

    await page.getByRole("button", { name: "关闭聊天" }).click();
    await expect(page.getByRole("button", { name: "清空" })).toBeHidden();
    await expect(
      page.getByRole("button", { name: "打开助手" }),
    ).toBeVisible();
  });

  test("keeps the transcript across navigation and reopening", async ({
    page,
  }) => {
    await page.route("**/api/ai/chat", (route) =>
      route.fulfill({
        headers: SSE_HEADERS,
        body: sse(textTurn("I can add a job for you.")),
      }),
    );

    await openChat(page);
    await send(page, "hello there");
    await expect(page.getByText("I can add a job for you.")).toBeVisible();

    await page.getByRole("link", { name: "待办事项" }).click();
    await expect(page).toHaveURL(/\/dashboard\/tasks/);
    await expect(page.getByText("I can add a job for you.")).toBeVisible();

    await page.getByRole("button", { name: "关闭聊天" }).click();
    await page.getByRole("button", { name: "打开助手" }).click();
    await expect(page.getByText("hello there")).toBeVisible();
    await expect(page.getByText("I can add a job for you.")).toBeVisible();
  });

  test("turns an over-threshold paste into a chip instead of a wall of text", async ({
    page,
  }) => {
    await openChat(page);

    const posting = `Staff Platform Engineer at Northwind. ${"Responsibilities include running the payments platform. ".repeat(
      40,
    )}`;
    const box = page.getByRole("textbox", { name: /提问或粘贴招聘信息/i });
    await box.click();
    await box.evaluate((el, text) => {
      const data = new DataTransfer();
      data.setData("text/plain", text);
      el.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
        }),
      );
    }, posting);

    await expect(page.getByText(/已粘贴招聘信息 ·/)).toBeVisible();
    await expect(box).toHaveValue("");
    await page.getByRole("button", { name: "移除粘贴内容" }).click();
    await expect(page.getByText(/已粘贴招聘信息 ·/)).toBeHidden();
  });

  test("renders the approval card and creates nothing when it is cancelled", async ({
    page,
  }) => {
    let call = 0;
    await page.route("**/api/ai/chat", async (route) => {
      call += 1;
      if (call === 1) {
        await route.fulfill({ headers: SSE_HEADERS, body: sse(approvalTurn()) });
        return;
      }
      const body = route.request().postDataJSON() as {
        messages: { id: string }[];
      };
      const lastId = body.messages[body.messages.length - 1].id;
      await route.fulfill({
        headers: SSE_HEADERS,
        body: sse(deniedTurn(lastId)),
      });
    });

    await openChat(page);
    await send(page, "add the Northwind role");

    await expect(page.getByText("需要确认")).toBeVisible();
    await expect(page.getByText("Northwind Trading")).toBeVisible();
    await expect(page.getByText("Staff Platform Engineer")).toBeVisible();
    await expect(page.getByText("$190k – $220k")).toBeVisible();
    await expect(page.getByRole("button", { name: "确认" })).toBeVisible();

    await page.getByRole("button", { name: "取消" }).click();
    await page.getByRole("button", { name: "跳过" }).click();

    await expect(page.getByText("已取消，未保存任何内容。")).toBeVisible();
    await expect(page.getByRole("button", { name: "确认" })).toBeHidden();

    // Nothing reached the jobs list.
    await page.goto("/dashboard/myjobs");
    await expect(page.getByText("Staff Platform Engineer")).toBeHidden();
  });
});
