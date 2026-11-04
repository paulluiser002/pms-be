// @vitest-environment jsdom
import { it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkflowGuide } from "./workflow-guide";
it("lets users select a process and advance its steps", () => {
  render(<WorkflowGuide />);
  fireEvent.change(screen.getByLabelText("Process"), { target: { value: "NTE Files" } });
  expect(screen.getByText("HR issues notice")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Next step" }));
  expect(screen.getByRole("status").textContent).toContain("Employee receives notice");
});
