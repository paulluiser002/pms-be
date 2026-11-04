// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Assignments, processDueManagerAssignments } from "./assignments";
import type { Employee } from "./employee-directory";
const people: Employee[] = [
  { id: "ana", name: "Ana", title: "Engineer", department: "Engineering", manager: "Lead" },
  { id: "lead", name: "Lead", title: "Manager", department: "Engineering", manager: "" },
  { id: "director", name: "Director", title: "Director", department: "Engineering", manager: "" },
];
function Harness({ initial = people }: { initial?: Employee[] }) {
  const [employees, setEmployees] = useState(initial);
  return (
    <>
      <Assignments employees={employees} onChange={setEmployees} />
      <output data-testid="hierarchy">{employees.map((e) => e.id + ":" + e.manager).join("|")}</output>
    </>
  );
}
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
function propose(employee: string, manager: string, effective: string) {
  fireEvent.click(screen.getByRole("button", { name: "Assign manager" }));
  fill("Employee", employee);
  fill("Manager", manager);
  fill("Effective date", effective);
  fireEvent.click(screen.getByRole("button", { name: "Save assignment" }));
}
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-03T01:00:00Z"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("applies a current assignment and retains actor and timestamp in history", () => {
  render(<Harness />);
  propose("ana", "director", "2026-11-03");
  expect(screen.getByTestId("hierarchy").textContent).toContain("ana:Director");
  expect(screen.getByText("Applied")).toBeTruthy();
  const stored = JSON.parse(localStorage.getItem("pms-react-manager-assignments-v1")!);
  expect(stored.assignments[0].history.map((h: { action: string }) => h.action)).toEqual(["Requested", "Applied"]);
  expect(stored.assignments[0].history[0].actor).toBe("HR Administrator");
});
it("schedules without changing current reporting and applies on the Manila due date", () => {
  const view = render(<Harness />);
  propose("ana", "director", "2026-11-04");
  expect(screen.getByTestId("hierarchy").textContent).toContain("ana:Lead");
  expect(screen.getByText("Pending")).toBeTruthy();
  view.unmount();
  vi.setSystemTime(new Date("2026-11-03T16:30:00Z"));
  render(<Harness />);
  expect(screen.getByTestId("hierarchy").textContent).toContain("ana:Director");
  expect(screen.getByText("Applied")).toBeTruthy();
});
it("cancels a future assignment and retains cancellation history", () => {
  render(<Harness />);
  propose("ana", "director", "2026-11-04");
  fireEvent.click(screen.getByRole("button", { name: "Cancel assignment" }));
  expect(screen.getByText("Cancelled")).toBeTruthy();
  vi.setSystemTime(new Date("2026-11-04T01:00:00Z"));
  fireEvent.focus(window);
  expect(screen.getByTestId("hierarchy").textContent).toContain("ana:Lead");
  expect(
    JSON.parse(localStorage.getItem("pms-react-manager-assignments-v1")!).assignments[0].history.at(-1).action,
  ).toBe("Cancelled");
});
it("rejects self management and indirect current reporting cycles", () => {
  render(<Harness />);
  propose("ana", "ana", "2026-11-03");
  expect(screen.getByRole("alert").textContent).toContain("own manager");
  fill("Employee", "lead");
  fill("Manager", "ana");
  fireEvent.click(screen.getByRole("button", { name: "Save assignment" }));
  expect(screen.getByRole("alert").textContent).toContain("reporting cycle");
  expect(screen.getByTestId("hierarchy").textContent).toContain("ana:Lead");
});
it("checks every future hierarchy and prevents duplicate employee effective dates", () => {
  render(<Harness />);
  propose("lead", "director", "2026-11-04");
  propose("director", "ana", "2026-11-05");
  expect(screen.getByRole("alert").textContent).toContain("reporting cycle");
  fill("Employee", "lead");
  fill("Manager", "ana");
  fill("Effective date", "2026-11-04");
  fireEvent.click(screen.getByRole("button", { name: "Save assignment" }));
  expect(screen.getByRole("alert").textContent).toContain("existing assignment");
});
it("blocks overdue assignments if current employee edits make the projected hierarchy cyclic", () => {
  const view = render(<Harness />);
  propose("lead", "director", "2026-11-04");
  view.unmount();
  vi.setSystemTime(new Date("2026-11-04T01:00:00Z"));
  render(<Harness initial={people.map((e) => (e.id === "director" ? { ...e, manager: "Lead" } : e))} />);
  expect(screen.getByText("Blocked")).toBeTruthy();
  expect(screen.getByTestId("hierarchy").textContent).toContain("lead:|director:Lead");
  expect(screen.getAllByText(/reporting cycle/).length).toBeGreaterThan(0);
});
it("does not overwrite malformed assignment storage", () => {
  localStorage.setItem("pms-react-manager-assignments-v1", "invalid original");
  render(<Harness />);
  propose("ana", "director", "2026-11-04");
  expect(localStorage.getItem("pms-react-manager-assignments-v1")).toBe("invalid original");
  expect(screen.getAllByRole("alert").some((node) => node.textContent?.includes("preserved"))).toBe(true);
});
it("keeps other company schedules untouched when processing a company roster", () => {
  localStorage.setItem(
    "pms-react-manager-assignments-v1",
    JSON.stringify({
      assignments: [
        {
          id: "remote",
          employeeId: "remote-employee",
          managerId: "remote-manager",
          employeeName: "Remote",
          managerName: "Remote manager",
          effective: "2020-01-01",
          status: "Pending",
          companyId: "other",
          history: [],
        },
      ],
    }),
  );
  render(
    <Assignments
      employees={people}
      onChange={() => {
        throw new Error("Other company should not update this directory");
      }}
      companyId="mayon"
    />,
  );
  expect(screen.queryByText("Remote")).toBeNull();
  expect(JSON.parse(localStorage.getItem("pms-react-manager-assignments-v1")!).assignments[0].status).toBe("Pending");
});

it("processes due assignments before role scopes initialize without rendering HR controls", () => {
  const view = render(<Harness />);
  propose("ana", "director", "2026-11-04");
  view.unmount();
  vi.setSystemTime(new Date("2026-11-04T01:00:00Z"));
  const next = processDueManagerAssignments(people);
  expect(next.find((e) => e.id === "ana")?.manager).toBe("Director");
  expect(JSON.parse(localStorage.getItem("pms-react-manager-assignments-v1")!).assignments[0].status).toBe("Applied");
});
