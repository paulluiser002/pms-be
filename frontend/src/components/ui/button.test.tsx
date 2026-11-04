// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Button } from "./button";

describe("Button", () => {
  it("invokes its action and respects disabled state", () => {
    const action = vi.fn();
    const { rerender } = render(<Button onClick={action}>Save</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(action).toHaveBeenCalledTimes(1);
    rerender(
      <Button disabled onClick={action}>
        Save
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(action).toHaveBeenCalledTimes(1);
  });
});
