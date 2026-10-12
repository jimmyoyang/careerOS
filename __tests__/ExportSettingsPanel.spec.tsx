import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ExportSettingsPanel } from "@/components/profile/export-pdf-dialog/ExportSettingsPanel";
import { defaultResumeExportSettings } from "@/models/resumeExport.model";

// The established shim for driving Radix Select in jsdom — see TaskForm.spec.
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
});

const renderPanel = (patch: Partial<typeof defaultResumeExportSettings> = {}) => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <ExportSettingsPanel
      settings={{ ...defaultResumeExportSettings, ...patch }}
      onChange={onChange}
    />,
  );
  return { onChange, user };
};

describe("ExportSettingsPanel — structure", () => {
  it("pins Template above the two disclosure groups", () => {
    renderPanel();
    expect(screen.getByRole("combobox", { name: "模板" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /字体排版/ }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /布局/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("renders a select for each named setting and a stepper for each number", () => {
    renderPanel();
    expect(screen.getByRole("combobox", { name: "模板" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "字体" })).toBeInTheDocument();
    for (const label of [
      "字号",
      "行高",
      "上下页边距",
      "左右页边距",
      "模块间距",
      "条目间距",
    ]) {
      expect(screen.getByRole("spinbutton", { name: label })).toBeInTheDocument();
    }
  });

  it("shows the current value in every control", () => {
    renderPanel({ template: "professional", font: "times", fontSize: 12.5 });
    expect(screen.getByRole("combobox", { name: "模板" })).toHaveTextContent(
      "专业",
    );
    expect(screen.getByRole("combobox", { name: "字体" })).toHaveTextContent(
      "Times",
    );
    expect(screen.getByRole("spinbutton", { name: "字号" })).toHaveValue(
      12.5,
    );
    expect(
      screen.getByRole("spinbutton", { name: "左右页边距" }),
    ).toHaveValue(48);
  });

  it("gives each stepper its field's own bounds and step", () => {
    renderPanel();
    const size = screen.getByRole("spinbutton", { name: "字号" });
    expect(size).toHaveAttribute("min", "8");
    expect(size).toHaveAttribute("max", "16");
    expect(size).toHaveAttribute("step", "0.5");
    const line = screen.getByRole("spinbutton", { name: "行高" });
    expect(line).toHaveAttribute("step", "0.05");
  });
});

describe("ExportSettingsPanel — disclosure", () => {
  it("hides a collapsed group's rows behind a value summary", async () => {
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: /布局/ }));

    expect(
      screen.queryByRole("spinbutton", { name: "模块间距" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("40 × 48 磅页边距 • 6/8 磅间距"),
    ).toBeInTheDocument();
  });

  it("summarises Typography with all three of its values", async () => {
    const { user } = renderPanel({ font: "courier", fontSize: 9.5 });

    await user.click(screen.getByRole("button", { name: /字体排版/ }));

    expect(screen.getByText("Courier • 9.5 pt • 1.4 倍行距")).toBeInTheDocument();
  });

  it("does not show a summary while the group is open", () => {
    renderPanel();
    expect(
      screen.queryByText(/40 × 48 磅页边距/),
    ).not.toBeInTheDocument();
  });
});

describe("ExportSettingsPanel — stepper buttons", () => {
  it("steps a value up by its own step, emitting the whole object", async () => {
    const { onChange, user } = renderPanel();

    await user.click(screen.getByRole("button", { name: "增大字号" }));

    expect(onChange).toHaveBeenCalledWith({
      ...defaultResumeExportSettings,
      fontSize: 11.5,
    });
  });

  it("steps a value down by its own step", async () => {
    const { onChange, user } = renderPanel();

    await user.click(
      screen.getByRole("button", { name: "减小左右页边距" }),
    );

    expect(onChange).toHaveBeenCalledWith({
      ...defaultResumeExportSettings,
      marginHorizontal: 46,
    });
  });

  // 1.4 + 0.05 is 1.4500000000000002 in IEEE 754, which would land in the
  // style sheet and in the JSON.stringify preview cache key.
  it("rounds the step away from float drift", async () => {
    const { onChange, user } = renderPanel();

    await user.click(
      screen.getByRole("button", { name: "增大行高" }),
    );

    expect(onChange).toHaveBeenCalledWith({
      ...defaultResumeExportSettings,
      lineHeight: 1.45,
    });
  });

  it("clamps rather than stepping past a bound", async () => {
    const { onChange, user } = renderPanel({ fontSize: 15.8 });

    await user.click(screen.getByRole("button", { name: "增大字号" }));

    expect(onChange).toHaveBeenCalledWith({
      ...defaultResumeExportSettings,
      fontSize: 16,
    });
  });

  it("disables the button that would leave the range", () => {
    renderPanel({ fontSize: 16, sectionSpacing: 0 });
    expect(
      screen.getByRole("button", { name: "增大字号" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "减小字号" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "减小模块间距" }),
    ).toBeDisabled();
  });

  it("preserves key order so the preview cache key stays stable", async () => {
    const { onChange, user } = renderPanel();

    await user.click(
      screen.getByRole("button", { name: "增大条目间距" }),
    );

    expect(Object.keys(onChange.mock.calls[0][0])).toEqual(
      Object.keys(defaultResumeExportSettings),
    );
  });
});

describe("ExportSettingsPanel — typing", () => {
  it("commits a typed value that is in range", async () => {
    const { onChange, user } = renderPanel();
    const input = screen.getByRole("spinbutton", { name: "模块间距" });

    await user.clear(input);
    await user.type(input, "18");

    expect(onChange).toHaveBeenLastCalledWith({
      ...defaultResumeExportSettings,
      sectionSpacing: 18,
    });
  });

  it("commits a value off the step grid without snapping it", async () => {
    const { onChange, user } = renderPanel();
    const input = screen.getByRole("spinbutton", { name: "字号" });

    await user.clear(input);
    await user.type(input, "11.3");

    expect(onChange).toHaveBeenLastCalledWith({
      ...defaultResumeExportSettings,
      fontSize: 11.3,
    });
  });

  // Every prefix of "99" is out of range for an 18-90 field, so nothing
  // commits on the way through. "400" would commit 40 as it was typed.
  it("does not commit a value outside the range, and reverts on blur", async () => {
    const { onChange, user } = renderPanel();
    const input = screen.getByRole("spinbutton", { name: "左右页边距" });

    await user.clear(input);
    await user.type(input, "99");
    expect(onChange).not.toHaveBeenCalled();

    await user.tab();
    expect(input).toHaveValue(48);
  });

  it("does not commit an emptied field", async () => {
    const { onChange, user } = renderPanel();

    await user.clear(screen.getByRole("spinbutton", { name: "条目间距" }));

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("ExportSettingsPanel — selects", () => {
  it("emits the whole object when the template changes", async () => {
    const { onChange, user } = renderPanel();

    await user.click(screen.getByRole("combobox", { name: "模板" }));
    await user.click(screen.getByRole("option", { name: "专业" }));

    expect(onChange).toHaveBeenCalledWith({
      ...defaultResumeExportSettings,
      template: "professional",
    });
  });

  it("emits the whole object when the font changes", async () => {
    const { onChange, user } = renderPanel();

    await user.click(screen.getByRole("combobox", { name: "字体" }));
    await user.click(screen.getByRole("option", { name: "Courier" }));

    expect(onChange).toHaveBeenCalledWith({
      ...defaultResumeExportSettings,
      font: "courier",
    });
  });
});

describe("ExportSettingsPanel — reset", () => {
  it("renders no reset control when no handler is given", () => {
    renderPanel();
    expect(
      screen.queryByRole("button", { name: "恢复默认设置" }),
    ).not.toBeInTheDocument();
  });

  it("disables reset while the settings are the defaults", () => {
    const onReset = vi.fn();
    render(
      <ExportSettingsPanel
        settings={defaultResumeExportSettings}
        onChange={vi.fn()}
        onReset={onReset}
        isDefault
      />,
    );
    expect(
      screen.getByRole("button", { name: "恢复默认设置" }),
    ).toBeDisabled();
  });

  it("calls the handler once the settings have moved", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(
      <ExportSettingsPanel
        settings={{ ...defaultResumeExportSettings, fontSize: 13 }}
        onChange={vi.fn()}
        onReset={onReset}
        isDefault={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "恢复默认设置" }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  // The stepper's draft state must follow a value it did not itself change.
  it("shows the reset value in the stepper after the parent re-renders", () => {
    const { rerender } = render(
      <ExportSettingsPanel
        settings={{ ...defaultResumeExportSettings, fontSize: 13 }}
        onChange={vi.fn()}
        onReset={vi.fn()}
        isDefault={false}
      />,
    );
    expect(screen.getByRole("spinbutton", { name: "字号" })).toHaveValue(
      13,
    );

    rerender(
      <ExportSettingsPanel
        settings={defaultResumeExportSettings}
        onChange={vi.fn()}
        onReset={vi.fn()}
        isDefault
      />,
    );

    expect(screen.getByRole("spinbutton", { name: "字号" })).toHaveValue(
      11,
    );
  });
});
