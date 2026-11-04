// @vitest-environment jsdom
import { it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import App from "./app";
afterEach(() => {
  cleanup();
  localStorage.clear();
});
it("creates employees through the React directory", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Employees" }));
  fireEvent.click(screen.getByRole("button", { name: "Add employee" }));
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Test Person" } });
  fireEvent.change(screen.getByLabelText("Job title"), { target: { value: "Tester" } });
  fireEvent.change(screen.getByLabelText("Department"), { target: { value: "QA" } });
  fireEvent.click(screen.getByRole("button", { name: "Save employee" }));
  expect(screen.getByRole("cell", { name: "Test Person Tester" })).toBeTruthy();
});
it("employee preview cannot create employees", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Employees" }));
  fireEvent.keyDown(screen.getByRole("button", { name: "Open profile menu" }), { key: "Enter" });
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "Preview as User Type" }), { key: "ArrowRight" });
  fireEvent.click(screen.getByRole("menuitemradio", { name: "Employee" }));
  expect(screen.queryByRole("button", { name: "Add employee" })).toBeNull();
});
it("opens employee details for HR editing", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Employees" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit Sofia Garcia" }));
  fireEvent.change(screen.getByLabelText("Job title"), { target: { value: "Senior Marketing Specialist" } });
  fireEvent.click(screen.getByRole("button", { name: "Save employee" }));
  expect(screen.getByText("Senior Marketing Specialist")).toBeTruthy();
});
it("imports the existing prototype employee roster without deleting it", () => {
  localStorage.setItem(
    "people-mvp-v1",
    JSON.stringify({
      employees: [["EMP-100", "Legacy Person", "Engineer", "Engineering", "Angela Reyes", 0, "Not started"]],
    }),
  );
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Employees" }));
  expect(screen.getByRole("cell", { name: "Legacy Person Engineer" })).toBeTruthy();
  expect(localStorage.getItem("people-mvp-v1")).toBeTruthy();
});
it("keeps imported employees inside the selected company", () => {
  localStorage.setItem(
    "people-mvp-v1",
    JSON.stringify({
      employees: [
        ["E1", "Mayon User", "Engineer", "Engineering", "", 0, "Not started"],
        ["E2", "Other User", "Engineer", "Engineering", "", 0, "Not started"],
      ],
      pmsEmployeeCompanies: { E1: "mayon", E2: "other" },
    }),
  );
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Employees" }));
  expect(screen.queryByRole("cell", { name: "Other User Engineer" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Company"), { target: { value: "other" } });
  expect(screen.getByRole("cell", { name: "Other User Engineer" })).toBeTruthy();
  expect(screen.queryByRole("cell", { name: "Mayon User Engineer" })).toBeNull();
});
it("rejects reporting relationships that point to the employee", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Employees" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit Sofia Garcia" }));
  fireEvent.change(screen.getByLabelText("Manager"), { target: { value: "Sofia Garcia" } });
  fireEvent.click(screen.getByRole("button", { name: "Save employee" }));
  expect(screen.getByRole("alert").textContent).toMatch(/reporting/i);
});
