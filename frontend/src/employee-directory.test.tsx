// @vitest-environment jsdom
import { it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EmployeeDirectory } from "./employee-directory";
it("filters employees by name or department and restores the list", () => {
  render(
    <EmployeeDirectory
      employees={[
        { id: "EMP-001", name: "Maria Cruz", title: "Designer", department: "Design", manager: "Angela Reyes" },
        { id: "EMP-002", name: "James Santos", title: "Engineer", department: "Engineering", manager: "Angela Reyes" },
      ]}
    />,
  );
  fireEvent.change(screen.getByRole("searchbox", { name: "Search employees" }), { target: { value: "engineering" } });
  expect(screen.queryByText("Maria Cruz")).toBeNull();
  expect(screen.getByText("James Santos")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
  expect(screen.getByText("Maria Cruz")).toBeTruthy();
});
