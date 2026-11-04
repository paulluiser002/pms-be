// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Cases } from "./cases";
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    "pms-react-employees-v1",
    JSON.stringify([
      { id: "one", name: "Ana Cruz", title: "Engineer", department: "Engineering", manager: "Lead" },
      { id: "two", name: "Ben Lee", title: "Designer", department: "Design", manager: "Other" },
      { id: "lead", name: "Lead", title: "Manager", department: "Engineering", manager: "" },
    ]),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const fill = (name: string, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } });
it("issues a notice, restricts employee scope, accepts explanation and records HR closure", () => {
  const view = render(<Cases role="HR Administrator" />);
  fireEvent.click(screen.getByRole("tab", { name: "NTE Files" }));
  fireEvent.click(screen.getByRole("button", { name: "Create NTE" }));
  fill("Employee", "one");
  fill("Subject", "Attendance review");
  fill("Notice body", "Explain the missed shift.");
  fill("Explanation deadline", "2099-01-01");
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  expect(screen.getByText("Draft", { selector: "strong" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Issue NTE" }));
  view.rerender(<Cases role="Employee" employeeId="two" />);
  expect(screen.queryByText("Attendance review")).toBeNull();
  view.rerender(<Cases role="Employee" employeeId="one" />);
  fill("Your explanation", "Shift change was approved.");
  fireEvent.click(screen.getByRole("button", { name: "Submit explanation" }));
  view.rerender(<Cases role="HR Administrator" />);
  fill("Closure outcome", "Approved shift change verified.");
  fireEvent.click(screen.getByRole("button", { name: "Close NTE" }));
  expect(screen.getByText("Closed")).toBeTruthy();
  view.unmount();
  render(<Cases role="HR Administrator" />);
  fireEvent.click(screen.getByRole("tab", { name: "NTE Files" }));
  fireEvent.click(screen.getByRole("button", { name: "View NTEs for Ana Cruz" }));
  expect(screen.getByText("Approved shift change verified.")).toBeTruthy();
});
it("keeps manager journal access inside reporting scope and persists journal entries", () => {
  render(<Cases role="Manager" managerId="lead" />);
  fireEvent.click(screen.getByRole("button", { name: "Add journal entry" }));
  expect(screen.queryByRole("option", { name: "Ben Lee" })).toBeNull();
  fill("Employee", "one");
  fill("Journal title", "Coaching");
  fill("Journal entry", "Discussed handoff process.");
  fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
  expect(screen.getByText("Discussed handoff process.")).toBeTruthy();
});
it("consumes persisted evaluation referrals once and supports measurable weekly planning", () => {
  localStorage.setItem(
    "pms-react-pip-referrals-v1",
    JSON.stringify([
      {
        id: "ref1",
        cycleId: "cycle1",
        cycleName: "Annual",
        employeeId: "one",
        employeeName: "Ana Cruz",
        indicators: [{ id: "quality", name: "Quality", target: 90, actual: 70, direction: "Higher" }],
        createdAt: new Date().toISOString(),
      },
    ]),
  );
  const view = render(<Cases role="HR Administrator" />);
  fireEvent.click(screen.getByRole("tab", { name: "PIP" }));
  expect(screen.getAllByText("Performance Improvement Plan").length).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "Add week" }));
  fill("Source indicator", "ref1:quality");
  fill("Weekly goal", "Improve quality");
  fill("Actions", "Review checklist");
  fill("Support", "Manager coaching");
  fill("Target", "90");
  fill("Unit", "percent");
  fill("Week start", "2099-01-01");
  fireEvent.click(screen.getByRole("button", { name: "Save week" }));
  fireEvent.click(screen.getByRole("button", { name: "Activate plan" }));
  expect(screen.getByText("Active")).toBeTruthy();
  view.unmount();
  render(<Cases role="HR Administrator" />);
  fireEvent.click(screen.getByRole("tab", { name: "PIP" }));
  expect(screen.getAllByText("Performance Improvement Plan").length).toBe(1);
});
it("completes a PIP only after employee submission and manager assessment", () => {
  const today = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  localStorage.setItem(
    "pms-react-cases-v1",
    JSON.stringify({
      journals: [],
      notices: [],
      plans: [
        {
          id: "plan1",
          employeeId: "one",
          title: "Quality improvement",
          reason: "Improve delivery",
          origin: "Manual",
          state: "Active",
          referrals: [],
          weeks: [
            {
              id: "week1",
              goal: "Deliver reports",
              actions: "Daily review",
              support: "Coaching",
              target: 5,
              unit: "reports",
              direction: "Higher",
              start,
              end: today,
              state: "Pending",
            },
          ],
        },
      ],
    }),
  );
  const view = render(<Cases role="Employee" employeeId="one" />);
  fireEvent.click(screen.getByRole("tab", { name: "PIP" }));
  fill("Actual result", "6");
  fill("Progress update", "Delivered six reports.");
  fireEvent.click(screen.getByRole("button", { name: "Submit progress" }));
  view.rerender(<Cases role="Manager" managerId="lead" />);
  fill("Verified actual", "6");
  fill("Assessment remarks", "Six accepted reports verified.");
  fireEvent.click(screen.getByRole("button", { name: "Assess week" }));
  fill("Completion note", "All goals met.");
  fireEvent.click(screen.getByRole("button", { name: "Complete plan" }));
  expect(screen.getByText("Completed")).toBeTruthy();
});
it("does not activate a referral plan with unrelated weekly goals", () => {
  localStorage.setItem(
    "pms-react-pip-referrals-v1",
    JSON.stringify([
      {
        id: "r",
        cycleId: "c",
        cycleName: "Annual",
        employeeId: "one",
        employeeName: "Ana Cruz",
        indicators: [{ id: "q", name: "Quality", target: 90, actual: 70, direction: "Higher" }],
        createdAt: new Date().toISOString(),
      },
    ]),
  );
  render(<Cases role="HR Administrator" />);
  fireEvent.click(screen.getByRole("tab", { name: "PIP" }));
  fireEvent.click(screen.getByRole("button", { name: "Activate plan" }));
  expect(screen.getByRole("alert").textContent).toContain("cover every referred indicator");
  expect(screen.getByText("Awaiting Planning")).toBeTruthy();
});
it("preserves malformed stored records instead of overwriting them on a journal save", () => {
  localStorage.setItem("pms-react-cases-v1", '{"journals":"invalid"}');
  render(<Cases role="HR Administrator" />);
  fireEvent.click(screen.getByRole("button", { name: "Add journal entry" }));
  fill("Employee", "one");
  fill("Journal title", "Coaching");
  fill("Journal entry", "Discussed process.");
  fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
  expect(localStorage.getItem("pms-react-cases-v1")).toBe('{"journals":"invalid"}');
  expect(screen.getAllByRole("alert").some((e) => e.textContent?.includes("Unable to save"))).toBe(true);
});
it("keeps expired draft notices private until a valid response window is available", () => {
  localStorage.setItem(
    "pms-react-cases-v1",
    JSON.stringify({
      journals: [],
      plans: [],
      notices: [
        {
          id: "expired",
          employeeId: "one",
          subject: "Old draft",
          body: "Explain incident.",
          category: "Attendance",
          deadline: "2020-01-01",
          status: "Draft",
        },
      ],
    }),
  );
  render(<Cases role="HR Administrator" />);
  fireEvent.click(screen.getByRole("tab", { name: "NTE Files" }));
  fireEvent.click(screen.getByRole("button", { name: "View NTEs for Ana Cruz" }));
  fireEvent.click(screen.getByRole("button", { name: "Issue NTE" }));
  expect(screen.getByText("Draft", { selector: "strong" })).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toContain("deadline");
  fireEvent.click(screen.getByRole("button", { name: "Edit draft" }));
  fill("Explanation deadline", "2099-01-01");
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Issue NTE" }));
  expect(screen.getByText("Issued")).toBeTruthy();
});

it("uses Manila calendar dates for explanation windows after UTC afternoon", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-03T16:30:00Z"));
  localStorage.setItem(
    "pms-react-cases-v1",
    JSON.stringify({
      journals: [],
      plans: [],
      notices: [
        {
          id: "boundary",
          employeeId: "one",
          subject: "Timezone notice",
          body: "Explain incident.",
          category: "Attendance",
          deadline: "2026-11-03",
          status: "Draft",
        },
      ],
    }),
  );
  render(<Cases role="HR Administrator" />);
  fireEvent.click(screen.getByRole("tab", { name: "NTE Files" }));
  fireEvent.click(screen.getByRole("button", { name: "View NTEs for Ana Cruz" }));
  fireEvent.click(screen.getByRole("button", { name: "Issue NTE" }));
  expect(screen.getByText("Draft", { selector: "strong" })).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toContain("deadline");
});
const activeWeek = (state = "Submitted", end = "2020-01-07") => ({
  id: "w",
  goal: "Quality work",
  actions: "Review",
  support: "Coaching",
  target: 5,
  unit: "reports",
  direction: "Higher",
  start: "2020-01-01",
  end,
  state,
  actual: 4,
  update: "Four reports delivered.",
});
const putPlan = (extra: Record<string, unknown> = {}) =>
  localStorage.setItem(
    "pms-react-cases-v1",
    JSON.stringify({
      journals: [],
      notices: [],
      plans: [
        {
          id: "p",
          employeeId: "one",
          title: "Improvement",
          reason: "Delivery",
          origin: "Manual",
          state: "Active",
          referrals: [],
          weeks: [activeWeek()],
          ...extra,
        },
      ],
    }),
  );
it("returns submitted progress with a reason and preserves the prior submission on resubmission", () => {
  putPlan();
  const view = render(<Cases role="Manager" managerId="lead" />);
  fireEvent.click(screen.getByRole("tab", { name: "PIP" }));
  fill("Correction reason", "Attach accepted report counts.");
  fireEvent.click(screen.getByRole("button", { name: "Return for correction" }));
  expect(screen.getByText("Pending")).toBeTruthy();
  view.rerender(<Cases role="Employee" employeeId="one" />);
  expect(screen.getByText("Correction requested: Attach accepted report counts.")).toBeTruthy();
  fill("Actual result", "5");
  fill("Progress update", "Five accepted reports.");
  fireEvent.click(screen.getByRole("button", { name: "Submit progress" }));
  const saved = JSON.parse(localStorage.getItem("pms-react-cases-v1")!);
  expect(saved.plans[0].weeks[0].submissions.map((s: { actual: number }) => s.actual)).toEqual([4, 5]);
  expect(saved.plans[0].history.some((h: { action: string }) => h.action === "Week returned for correction")).toBe(
    true,
  );
});
it("requires a documented reason when assessing an overdue missing submission", () => {
  putPlan({ weeks: [activeWeek("Pending")] });
  render(<Cases role="Manager" managerId="lead" />);
  fireEvent.click(screen.getByRole("tab", { name: "PIP" }));
  fill("Verified actual", "3");
  fill("Assessment remarks", "Three reports verified.");
  fill("Missed submission reason", "Employee did not submit after reminder.");
  fireEvent.click(screen.getByRole("button", { name: "Assess missed submission" }));
  expect(screen.getByText("Assessed")).toBeTruthy();
  expect(screen.getByText("Missing submission: Employee did not submit after reminder.")).toBeTruthy();
  const saved = JSON.parse(localStorage.getItem("pms-react-cases-v1")!);
  expect(saved.plans[0].weeks[0].met).toBe(false);
  expect(saved.plans[0].history[0].actor).toContain("lead");
});
it("requires reasons for excluded source indicators and records qualified completion", () => {
  const referral = {
    id: "r",
    cycleId: "c",
    cycleName: "Annual",
    employeeId: "one",
    employeeName: "Ana Cruz",
    createdAt: new Date().toISOString(),
    indicators: [{ id: "q", name: "Quality", target: 90, actual: 70, direction: "Higher" }],
  };
  putPlan({
    origin: "Automatic",
    referrals: [referral],
    weeks: [{ ...activeWeek("Assessed"), met: true, assessment: "Verified" }],
  });
  render(<Cases role="HR Administrator" />);
  fireEvent.click(screen.getByRole("tab", { name: "PIP" }));
  expect(screen.queryByRole("button", { name: "Complete plan" })).toBeNull();
  fill("Exclusion reason: Quality", "Indicator no longer applies after role transfer.");
  fireEvent.click(screen.getByRole("button", { name: "Exclude Quality" }));
  fill("Completion note", "Remaining goals met; exclusion approved.");
  fireEvent.click(screen.getByRole("button", { name: "Complete plan" }));
  expect(screen.getByText("Completed with Exclusions")).toBeTruthy();
  expect(screen.getByText("Indicator no longer applies after role transfer.")).toBeTruthy();
});
it("imports legacy journals and notices once while retaining original browser data", () => {
  const old = JSON.stringify({
    pmsActiveCompanyId: "mayon",
    unifiedReviews: {
      journal: [
        {
          id: "j-old",
          employee: "one",
          title: "Legacy journal",
          description: "Original observation",
          created: "2026-01-01T01:00:00Z",
          author: "lead",
          date: "2026-01-01",
          type: "Coaching",
        },
      ],
      nteFiles: [
        {
          id: "n-old",
          companyId: "mayon",
          employee: "one",
          subject: "Legacy notice",
          body: "Original notice",
          category: "Attendance",
          deadline: "2099-01-01",
          status: "Issued",
          history: [{ action: "Issued", by: "lead", at: "2026-01-01T01:00:00Z" }],
        },
      ],
    },
  });
  localStorage.setItem("people-mvp-v1", old);
  let view = render(<Cases role="HR Administrator" />);
  expect(screen.getByText("Original observation")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "NTE Files" }));
  fireEvent.click(screen.getByRole("button", { name: "View NTEs for Ana Cruz" }));
  expect(screen.getByText("Original notice")).toBeTruthy();
  view.unmount();
  view = render(<Cases role="HR Administrator" />);
  expect(screen.getAllByText("Original observation")).toHaveLength(1);
  expect(localStorage.getItem("people-mvp-v1")).toBe(old);
});
it("imports legacy PIP measurements, exclusions and assessment history", () => {
  localStorage.setItem(
    "people-mvp-v1",
    JSON.stringify({
      pmsActiveCompanyId: "mayon",
      unifiedReviews: {
        pipPlans: [
          {
            id: "legacy-pip",
            employee: "one",
            companyId: "mayon",
            title: "Original improvement plan",
            reason: "Quality",
            origin: "Automatic",
            state: "Completed with Exclusions",
            createdAt: "2026-01-01T01:00:00Z",
            closureNote: "Goals verified.",
            sources: [
              {
                cycleId: "c",
                cycleName: "Annual",
                indicators: [
                  { id: "q", name: "Quality", target: 90, actual: 70, direction: "Higher", verification: "Verified" },
                  { id: "s", name: "Speed", target: 5, actual: 7, direction: "Lower", verification: "Verified" },
                ],
              },
            ],
            exclusions: [{ sourceCycleId: "c", indicatorId: "s", reason: "Role transfer" }],
            weeks: [
              {
                id: "old-w",
                title: "Quality week",
                indicatorId: "q",
                sourceCycleId: "c",
                goal: "Improve quality",
                actions: "Review work",
                support: "Coaching",
                target: 90,
                unit: "percent",
                direction: "Higher",
                start: "2020-01-01",
                end: "2020-01-07",
                state: "Assessed",
                actual: 95,
                update: "Quality improved",
                assessment: { actual: 95, result: "Met", remarks: "Verified quality" },
              },
            ],
            history: [{ action: "Plan closed", by: "lead", at: "2026-01-01T01:00:00Z" }],
          },
        ],
      },
    }),
  );
  render(<Cases role="HR Administrator" />);
  fireEvent.click(screen.getByRole("tab", { name: "PIP" }));
  expect(screen.getByText("Original improvement plan")).toBeTruthy();
  expect(screen.getByText("Completed with Exclusions")).toBeTruthy();
  expect(screen.getByText("Role transfer")).toBeTruthy();
  expect(screen.getByText(/Assessment: Met. Verified quality/)).toBeTruthy();
  expect(JSON.parse(localStorage.getItem("pms-react-cases-v1")!).plans[0].history[0].actor).toBe("lead");
});
it("preserves malformed legacy data while still enrolling new evaluation referrals", () => {
  localStorage.setItem("people-mvp-v1", "malformed original");
  localStorage.setItem(
    "pms-react-pip-referrals-v1",
    JSON.stringify([
      {
        id: "r",
        cycleId: "c",
        cycleName: "Annual",
        employeeId: "one",
        employeeName: "Ana Cruz",
        createdAt: new Date().toISOString(),
        indicators: [{ id: "q", name: "Quality", target: 90, actual: 70, direction: "Higher" }],
      },
    ]),
  );
  render(<Cases role="HR Administrator" />);
  fireEvent.click(screen.getByRole("tab", { name: "PIP" }));
  expect(screen.getByText("Performance Improvement Plan")).toBeTruthy();
  expect(localStorage.getItem("people-mvp-v1")).toBe("malformed original");
});
it("keeps confidential staff journals unavailable to employee preview", () => {
  localStorage.setItem(
    "pms-react-cases-v1",
    JSON.stringify({
      journals: [
        {
          id: "confidential",
          employeeId: "one",
          title: "Staff observation",
          body: "Confidential coaching notes",
          createdAt: "2026-01-01T01:00:00Z",
          author: "HR Administrator",
        },
      ],
      notices: [],
      plans: [],
    }),
  );
  const view = render(<Cases role="HR Administrator" />);
  expect(screen.getByText("Confidential coaching notes")).toBeTruthy();
  view.rerender(<Cases role="Employee" employeeId="one" />);
  expect(screen.queryByRole("tab", { name: "Journal Entries" })).toBeNull();
  expect(screen.queryByText("Confidential coaching notes")).toBeNull();
  expect(screen.queryByRole("button", { name: "Add journal entry" })).toBeNull();
});
it("limits HR records and recipients to the selected company", () => {
  localStorage.setItem(
    "pms-react-employees-v1",
    JSON.stringify([
      {
        id: "one",
        name: "Ana Cruz",
        title: "Engineer",
        department: "Engineering",
        manager: "Lead",
        companyId: "mayon",
      },
      { id: "two", name: "Ben Lee", title: "Designer", department: "Design", manager: "Other", companyId: "other" },
    ]),
  );
  localStorage.setItem(
    "pms-react-cases-v1",
    JSON.stringify({
      journals: [
        {
          id: "j1",
          employeeId: "one",
          title: "Mayon record",
          body: "Mayon only",
          author: "HR",
          createdAt: "2026-01-01T01:00:00Z",
        },
        {
          id: "j2",
          employeeId: "two",
          title: "Other record",
          body: "Other only",
          author: "HR",
          createdAt: "2026-01-01T01:00:00Z",
        },
      ],
      notices: [],
      plans: [],
    }),
  );
  const view = render(<Cases role="HR Administrator" companyId="mayon" />);
  expect(screen.getByText("Mayon only")).toBeTruthy();
  expect(screen.queryByText("Other only")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Add journal entry" }));
  expect(screen.queryByRole("option", { name: "Ben Lee" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  view.rerender(<Cases role="HR Administrator" companyId="other" />);
  expect(screen.queryByText("Mayon only")).toBeNull();
  expect(screen.getByText("Other only")).toBeTruthy();
});
it("records employee acknowledgment and permits documented staff cancellation", () => {
  putPlan();
  const view = render(<Cases role="Employee" employeeId="one" />);
  fireEvent.click(screen.getByRole("tab", { name: "PIP" }));
  fireEvent.click(screen.getByRole("button", { name: "Acknowledge plan" }));
  expect(screen.getByText(/Acknowledged on/)).toBeTruthy();
  view.rerender(<Cases role="HR Administrator" />);
  fill("Cancellation reason", "Plan withdrawn after role transfer.");
  fireEvent.click(screen.getByRole("button", { name: "Cancel plan" }));
  expect(screen.getByText("Cancelled")).toBeTruthy();
  expect(screen.getByText("Plan withdrawn after role transfer.")).toBeTruthy();
});
it("keeps an active referral plan open until staff documents review of covered indicators", () => {
  const referral = {
    id: "r",
    cycleId: "c",
    cycleName: "Annual",
    employeeId: "one",
    employeeName: "Ana Cruz",
    createdAt: new Date().toISOString(),
    indicators: [{ id: "q", name: "Quality", target: 90, actual: 70, direction: "Higher" }],
  };
  putPlan({
    origin: "Automatic",
    needsReview: true,
    referrals: [referral],
    weeks: [{ ...activeWeek("Assessed"), indicatorId: "r:q", met: true, assessment: "Verified" }],
  });
  render(<Cases role="HR Administrator" />);
  fireEvent.click(screen.getByRole("tab", { name: "PIP" }));
  expect(screen.queryByRole("button", { name: "Complete plan" })).toBeNull();
  fill("Referral review note", "All failed indicators addressed.");
  fireEvent.click(screen.getByRole("button", { name: "Review referrals" }));
  expect(screen.getByRole("button", { name: "Complete plan" })).toBeTruthy();
  expect(JSON.parse(localStorage.getItem("pms-react-cases-v1")!).plans[0].needsReview).toBe(false);
});
it("uses the last linked follow-up result when determining plan completion", () => {
  putPlan({
    weeks: [
      { ...activeWeek("Assessed"), indicatorId: "custom", met: false, assessment: "Missed target" },
      {
        ...activeWeek("Assessed", "2020-01-14"),
        id: "follow",
        start: "2020-01-08",
        indicatorId: "custom",
        followUpFor: "w",
        met: true,
        assessment: "Follow-up met",
      },
    ],
  });
  render(<Cases role="HR Administrator" />);
  fireEvent.click(screen.getByRole("tab", { name: "PIP" }));
  fill("Completion note", "Follow-up target met.");
  fireEvent.click(screen.getByRole("button", { name: "Complete plan" }));
  expect(screen.getByText("Completed")).toBeTruthy();
});
it("retains notice incident references, issue/read timestamps and cancellation reason", () => {
  const view = render(<Cases role="HR Administrator" />);
  fireEvent.click(screen.getByRole("tab", { name: "NTE Files" }));
  fireEvent.click(screen.getByRole("button", { name: "Create NTE" }));
  fill("Employee", "one");
  fill("Subject", "Incident review");
  fill("Notice body", "Explain incident.");
  fill("Explanation deadline", "2099-01-01");
  fill("Incident date", "2020-01-01");
  fill("Reference", "CASE-123");
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Issue NTE" }));
  expect(screen.getByText("Reference: CASE-123")).toBeTruthy();
  view.rerender(<Cases role="Employee" employeeId="one" />);
  let notice = JSON.parse(localStorage.getItem("pms-react-cases-v1")!).notices[0];
  expect(notice.readAt).toBeTruthy();
  expect(notice.issuedAt).toBeTruthy();
  view.rerender(<Cases role="HR Administrator" />);
  fill("Cancellation reason", "Withdrawn after fact review.");
  fireEvent.click(screen.getByRole("button", { name: "Cancel NTE" }));
  expect(screen.getByText("Cancelled")).toBeTruthy();
  notice = JSON.parse(localStorage.getItem("pms-react-cases-v1")!).notices[0];
  expect(notice.cancelledAt).toBeTruthy();
  expect(notice.cancelReason).toBe("Withdrawn after fact review.");
});
it("stores journal date, type and related evaluation cycle and applies date/type filters", () => {
  render(<Cases role="HR Administrator" />);
  fireEvent.click(screen.getByRole("button", { name: "Add journal entry" }));
  fill("Employee", "one");
  fill("Journal title", "Coaching record");
  fill("Journal entry", "Discussed quality.");
  fill("Entry date", "2020-01-01");
  fill("Entry type", "Coaching / Feedback");
  fill("Related evaluation cycle", "Historical annual review");
  fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
  expect(screen.getAllByText(/Coaching \/ Feedback/).length).toBeGreaterThan(0);
  fill("Journal from date", "2021-01-01");
  expect(screen.queryByText("Discussed quality.")).toBeNull();
  fill("Journal from date", "");
  fill("Filter entry type", "Achievement");
  expect(screen.queryByText("Discussed quality.")).toBeNull();
  fill("Filter entry type", "Coaching / Feedback");
  expect(screen.getByText("Discussed quality.")).toBeTruthy();
  expect(JSON.parse(localStorage.getItem("pms-react-cases-v1")!).journals[0].cycle).toBe("Historical annual review");
});
it("opens employee NTE lists from a masterlist including employees with no notices", () => {
  localStorage.setItem(
    "pms-react-cases-v1",
    JSON.stringify({
      journals: [],
      plans: [],
      notices: [
        {
          id: "past",
          employeeId: "one",
          subject: "Past notice",
          body: "Past facts",
          category: "Conduct",
          deadline: "2020-01-01",
          status: "Closed",
          closure: "Resolved",
        },
      ],
    }),
  );
  render(<Cases role="HR Administrator" />);
  fireEvent.click(screen.getByRole("tab", { name: "NTE Files" }));
  expect(screen.getByRole("button", { name: "View NTEs for Ben Lee" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "View NTEs for Ana Cruz" }));
  expect(screen.getByText("Past notice")).toBeTruthy();
  fill("Record status", "Active");
  expect(screen.queryByText("Past notice")).toBeNull();
  fill("Record status", "Past");
  expect(screen.getByText("Past notice")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Employee masterlist" }));
  fireEvent.click(screen.getByRole("button", { name: "View NTEs for Ben Lee" }));
  fireEvent.click(screen.getByRole("button", { name: "Create NTE" }));
  expect((screen.getByLabelText("Employee") as HTMLSelectElement).value).toBe("two");
});
it("closes confidential staff drafts and hides selected out-of-team employee identity after role changes", () => {
  const view = render(<Cases role="HR Administrator" />);
  fireEvent.click(screen.getByRole("tab", { name: "NTE Files" }));
  fireEvent.click(screen.getByRole("button", { name: "View NTEs for Ben Lee" }));
  fireEvent.click(screen.getByRole("button", { name: "Create NTE" }));
  fill("Notice body", "Confidential draft facts");
  view.rerender(<Cases role="Manager" managerId="lead" />);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByText("Ben Lee · NTE Files")).toBeNull();
  expect(screen.queryByText("Confidential draft facts")).toBeNull();
  expect(screen.getByRole("button", { name: "View NTEs for Ana Cruz" })).toBeTruthy();
});
it("adds a documented follow-up week while retaining its earlier goal source", () => {
  putPlan({ weeks: [{ ...activeWeek("Assessed"), indicatorId: "custom", met: false, assessment: "Target not met" }] });
  render(<Cases role="HR Administrator" />);
  fireEvent.click(screen.getByRole("tab", { name: "PIP" }));
  fireEvent.click(screen.getByRole("button", { name: "Add week" }));
  fill("Follow-up to week", "w");
  fill("Extension reason", "Additional coaching period");
  fill("Weekly goal", "Deliver complete reports");
  fill("Actions", "Review daily");
  fill("Support", "Manager coaching");
  fill("Target", "5");
  fill("Unit", "reports");
  fill("Week start", "2099-01-01");
  fireEvent.click(screen.getByRole("button", { name: "Save week" }));
  expect(screen.getByText("Follow-up to week 1")).toBeTruthy();
  const saved = JSON.parse(localStorage.getItem("pms-react-cases-v1")!).plans[0];
  expect(saved.weeks[1].followUpFor).toBe("w");
  expect(saved.weeks[1].extensionReason).toBe("Additional coaching period");
});
