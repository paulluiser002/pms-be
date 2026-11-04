// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Reporting } from "./reporting";
const ana = { id: "ana", name: "Ana Cruz", title: "Engineer", department: "Engineering", manager: "Lead" };
const ben = { id: "ben", name: "Ben Lee", title: "Designer", department: "Design", manager: "Lead" };
const outside = {
  id: "outside",
  name: "Outside Person",
  title: "Engineer",
  department: "Other company",
  manager: "Other",
};
function cycle(id: string, name: string, employee = ana, released = true) {
  return {
    id,
    name,
    periodStart: "2026-01-01",
    periodEnd: "2026-03-31",
    status: "Completed",
    stages: [
      { type: "Self", deadline: "2026-04-01" },
      { type: "Manager", deadline: "2026-04-02" },
    ],
    records: [
      {
        employee,
        responses: [{ type: "Self" }, { type: "Manager" }],
        finalizedAt: "2026-04-03T00:00:00Z",
        releasedAt: released ? "2026-04-04T00:00:00Z" : undefined,
        result: { goalScore: released ? 3.6 : 4.99, behaviorScore: 4, overall: released ? 3.8 : 4.99 },
      },
    ],
  };
}
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    "pms-react-cycles-v1",
    JSON.stringify([
      cycle("c1", "Released quarter"),
      cycle("c2", "Unreleased quarter", ana, false),
      cycle("c3", "Design review", ben),
      cycle("c4", "Private outside review", outside),
    ]),
  );
  localStorage.setItem(
    "pms-react-cases-v1",
    JSON.stringify({
      journals: [],
      notices: [
        { id: "n1", employeeId: "ana", subject: "Issued notice", status: "Issued", deadline: "2026-04-01" },
        { id: "n2", employeeId: "ana", subject: "Confidential draft", status: "Draft", deadline: "2099-04-01" },
        {
          id: "n3",
          employeeId: "outside",
          subject: "Private outside notice",
          status: "Issued",
          deadline: "2026-04-01",
        },
      ],
      plans: [
        { id: "p1", employeeId: "ana", title: "Delivery improvement", state: "Active" },
        { id: "p2", employeeId: "outside", title: "Private outside plan", state: "Active" },
      ],
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("reports scoped workflow completion and released scores without exposing other employees", () => {
  render(<Reporting employees={[ana]} report role="HR Administrator" />);
  expect(screen.getByRole("table", { name: "Evaluation report" })).toBeTruthy();
  expect(within(screen.getByRole("table", { name: "Evaluation report" })).getByText("Released quarter")).toBeTruthy();
  expect(within(screen.getByRole("table", { name: "Evaluation report" })).getByText("Unreleased quarter")).toBeTruthy();
  expect(screen.queryByText("Private outside review")).toBeNull();
  expect(within(screen.getByRole("table", { name: "Evaluation report" })).queryByText("Design review")).toBeNull();
  expect(screen.queryByText("4.99")).toBeNull();
  expect(screen.getByText("3.80 / 5")).toBeTruthy();
  expect(
    within(screen.getByRole("region", { name: "Improvement and notice summary" })).getByText(
      "Active improvement plans: 1",
    ),
  ).toBeTruthy();
  expect(screen.getByText("Active notices: 1")).toBeTruthy();
});
it("filters cycle and department before computing rows and summary", () => {
  render(<Reporting employees={[ana, ben]} report role="HR Administrator" />);
  fireEvent.change(screen.getByLabelText("Department"), { target: { value: "Design" } });
  expect(within(screen.getByRole("table", { name: "Evaluation report" })).getByText("Design review")).toBeTruthy();
  expect(within(screen.getByRole("table", { name: "Evaluation report" })).queryByText("Released quarter")).toBeNull();
  fireEvent.change(screen.getByLabelText("Department"), { target: { value: "All departments" } });
  fireEvent.change(screen.getByLabelText("Review cycle"), { target: { value: "c2" } });
  expect(within(screen.getByRole("table", { name: "Evaluation report" })).getByText("Unreleased quarter")).toBeTruthy();
  expect(within(screen.getByRole("table", { name: "Evaluation report" })).queryByText("Design review")).toBeNull();
  expect(screen.queryByText("3.80 / 5")).toBeNull();
});
it("employee reports ignore extra directory scope and hide draft NTEs", () => {
  render(<Reporting employees={[ana, ben, outside]} report role="Employee" employeeId="ana" />);
  expect(screen.queryByText("Outside Person")).toBeNull();
  expect(screen.queryByText("Ben Lee")).toBeNull();
  expect(screen.getByText("Active notices: 1")).toBeTruthy();
  expect(screen.getByText("Draft notices: 0")).toBeTruthy();
});
it("exports only filtered authorized released ratings and escapes spreadsheet formulas", async () => {
  const formula = { ...ana, name: "=UNTRUSTED()" };
  localStorage.setItem(
    "pms-react-cycles-v1",
    JSON.stringify([
      cycle("c1", "Released quarter", formula),
      cycle("c2", "Unreleased quarter", formula, false),
      cycle("c4", "Private outside review", outside),
    ]),
  );
  let captured: Blob | undefined;
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        captured = blob;
        return "blob:report";
      }),
      revokeObjectURL: vi.fn(),
    }),
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(<Reporting employees={[formula]} report role="Employee" employeeId="ana" />);
  fireEvent.click(screen.getByRole("button", { name: "Export evaluation report" }));
  const contents = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsText(captured!);
  });
  expect(contents).toContain("'=UNTRUSTED()");
  expect(contents).toContain("Released quarter");
  expect(contents).toContain("Unreleased quarter");
  expect(contents).not.toContain("4.99");
  expect(contents).not.toContain("Outside Person");
});
it("shows a recoverable error without replacing malformed saved records", () => {
  localStorage.setItem("pms-react-cycles-v1", "{broken");
  render(<Reporting employees={[ana]} report />);
  expect(screen.getByRole("alert").textContent).toMatch(/Unable to read/);
  expect(localStorage.getItem("pms-react-cycles-v1")).toBe("{broken");
});

it('draws role-specific completion and released-rating charts from the permitted selection', () => {
  const view = render(<Reporting employees={[ana, ben]} report={false} role="HR Administrator" />);
  expect(screen.getByRole('img', { name: 'Organization review completion' }).querySelector('desc')?.textContent).toContain('Engineering');
  expect(screen.getByRole('img', { name: 'Released performance rating distribution' })).toBeTruthy();
  view.rerender(<Reporting employees={[ana, ben]} report={false} role="Manager" employeeId="lead" />);
  expect(screen.getByRole('img', { name: 'Team review completion' }).querySelector('desc')?.textContent).toContain('Ana Cruz');
  view.rerender(<Reporting employees={[ana, ben, outside]} report={false} role="Employee" employeeId="ana" />);
  const own = screen.getByRole('img', { name: 'My review completion' });
  expect(own.querySelector('desc')?.textContent).toContain('Released quarter');
  expect(own.querySelector('desc')?.textContent).not.toContain('Design review');
  fireEvent.change(screen.getByLabelText('Review cycle'), { target: { value: 'c2' } });
  expect(screen.queryByRole('img', { name: 'Released performance rating distribution' })).toBeNull();
});
it('reports competency and stage ratings using observed released responses and protects small anonymous groups', () => {
  const base = cycle('ratings', 'Behavior review');
  const questions = [{ id: 'ownership', title: 'Ownership', kind: 'Rating' }, { id: 'collaboration', title: 'Collaboration', kind: 'Rating' }, { id: 'notes', title: 'Written comments', kind: 'Text' }];
  const responses = [
    { type: 'Self', reviewerId: 'ana', answers: { ownership: '2', collaboration: 'NO', notes: '5' } },
    { type: 'Manager', reviewerId: 'lead', answers: { ownership: '4', collaboration: '3', notes: '5' } },
    { type: 'Peer', reviewerId: 'peer1', answers: { ownership: '1', collaboration: '1', notes: '5' } },
    { type: 'Upward', reviewerId: 'up1', answers: { ownership: '3', collaboration: 'NO', notes: '5' } },
    { type: 'Upward', reviewerId: 'up2', answers: { ownership: '5', collaboration: 'NO', notes: '5' } },
  ];
  localStorage.setItem('pms-react-cycles-v1', JSON.stringify([{ ...base, anonymousThreshold: 2, stages: [...base.stages, { type: 'Peer', deadline: '2026-04-03', reviewerIds: ['peer1', 'peer2'] }, { type: 'Upward', deadline: '2026-04-04', reviewerIds: ['up1', 'up2'] }], records: [{ ...base.records[0], behaviorTemplate: { questions }, responses }] }, { ...cycle('hidden', 'Unreleased ratings', ana, false), records: [{ ...cycle('hidden', 'Unreleased ratings', ana, false).records[0], behaviorTemplate: { questions }, responses: [{ type: 'Self', answers: { ownership: '5' } }, { type: 'Manager', answers: { ownership: '5' } }] }] }]));
  render(<Reporting employees={[ana]} report role="HR Administrator" />);
  const competencies = screen.getByRole('table', { name: 'Competency performance summary' });
  expect(within(competencies).getByRole('row', { name: 'Ownership 3.50 / 5 4' })).toBeTruthy();
  expect(within(competencies).getByRole('row', { name: 'Collaboration 3.00 / 5 1' })).toBeTruthy();
  expect(within(competencies).queryByText('Written comments')).toBeNull();
  const stages = screen.getByRole('table', { name: 'Assessment stage breakdown' });
  expect(within(stages).getByRole('row', { name: /Peer.*Withheld/ })).toBeTruthy();
  expect(within(stages).getByRole('row', { name: /Upward.*4.00 \/ 5/ })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Review type'), { target: { value: 'Manager' } });
  expect(within(competencies).getByRole('row', { name: 'Ownership 4.00 / 5 1' })).toBeTruthy();
  expect(within(stages).queryByRole('row', { name: /Peer/ })).toBeNull();
});
it('keeps missing dimension scores absent rather than showing a fabricated zero', () => {
  const base = cycle('goals-only', 'Goals only review');
  localStorage.setItem('pms-react-cycles-v1', JSON.stringify([{ ...base, records: [{ ...base.records[0], result: { goalScore: 4, behaviorScore: null, overall: 4 } }] }]));
  render(<Reporting employees={[ana]} report />);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByText('4.00 / 5')).toBeTruthy();
});
