// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import {
  Performance,
  indicatorScore,
  validateGoalTemplate,
  createCycle,
  submitAssessment,
  finalizeEvaluation,
  releaseEvaluation,
  saveAssessmentDraft,
  reviseGoal,
  setManagerComment,
  migrateLegacyPerformance,
  extendStageDeadline,
  cancelCycle,
  createPersonalGoal,
  reviewGoalApproval,
  goalProgress,
  getPerformanceNotifications,
  type GoalTemplate,
  type BehaviorTemplate,
} from "./performance";
const goal: GoalTemplate = {
  id: "g1",
  name: "Designer goals",
  position: "Designer",
  description: "",
  version: 1,
  status: "Published",
  indicators: [
    {
      id: "i1",
      name: "Delivery",
      unit: "Count",
      target: 10,
      weight: 100,
      direction: "Higher",
      scoreMet: 5,
      scoreBelow: 2,
    },
  ],
};
const behavior: BehaviorTemplate = {
  id: "b1",
  name: "Core behaviors",
  description: "",
  position: "",
  version: 1,
  status: "Published",
  questions: [{ id: "q1", title: "Teamwork", kind: "Rating", required: true }],
};
const employee = { id: "e1", name: "Alex", title: "Designer", department: "Design", manager: "Taylor" };
function cycle() {
  return createCycle(
    {
      id: "c1",
      name: "Annual",
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      start: "2026-11-01",
      stages: [
        { type: "Self", deadline: "2026-11-10" },
        { type: "Manager", deadline: "2026-11-11" },
        { type: "HR", deadline: "2026-11-12" },
      ],
    },
    [employee],
    [goal],
    behavior,
  );
}
function complete() {
  let c = cycle();
  c = submitAssessment(c, "e1", "Self", { q1: "4" }, { i1: 9 }, "Evidence");
  c = submitAssessment(c, "e1", "Manager", { q1: "5" }, { i1: 9 }, "Checked");
  return submitAssessment(c, "e1", "HR", { q1: "3" }, {}, "Approved");
}
beforeEach(() => vi.setSystemTime(new Date("2026-11-01T04:00:00Z")));
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});
it("uses reference matrices only when scoring is explicitly enabled", () => {
  const indicator = {
    ...goal.indicators[0],
    matrix: {
      kind: "scale" as const,
      bound: "minimum" as const,
      title: "Scale",
      scoring: false,
      rows: [
        { boundary: 0, label: "Low", score: 1 },
        { boundary: 8, label: "Good", score: 4 },
      ],
    },
  };
  expect(indicatorScore(indicator, 9)).toBe(2);
  indicator.matrix.scoring = true;
  expect(indicatorScore(indicator, 9)).toBe(4);
  expect(indicatorScore(indicator, 8)).toBe(4);
  expect(
    indicatorScore(
      {
        ...indicator,
        direction: "Lower",
        matrix: {
          ...indicator.matrix,
          bound: "maximum",
          rows: [
            { boundary: 10, label: "Good", score: 5 },
            { boundary: null, label: "Low", score: 1 },
          ],
        },
      },
      10,
    ),
  ).toBe(5);
});
it("rejects malformed matrix coverage and invalid indicator weights", () => {
  expect(validateGoalTemplate({ ...goal, indicators: [{ ...goal.indicators[0], weight: 20 }] })).toMatch(/100/);
  expect(
    validateGoalTemplate({
      ...goal,
      indicators: [
        {
          ...goal.indicators[0],
          matrix: {
            kind: "scale",
            title: "",
            scoring: true,
            bound: "minimum",
            rows: [{ boundary: 2, label: "Low", score: 1 }],
          },
        },
      ],
    }),
  ).toMatch(/starting at 0/);
});
it("keeps template and employee snapshots when originals change", () => {
  const c = cycle();
  const source = goal.indicators[0].target;
  goal.indicators[0].target = 99;
  expect(c.records[0].goalTemplate.indicators[0].target).toBe(source);
  goal.indicators[0].target = source;
  expect(c.records[0].employee.name).toBe("Alex");
});
it("locks later stages and requires manager verification before finalization", () => {
  expect(() => submitAssessment(cycle(), "e1", "Manager", { q1: "4" }, { i1: 10 }, "")).toThrow(/preceding/);
  expect(() => finalizeEvaluation(cycle(), "e1")).toThrow(/submitted/);
});
it("excludes not observed ratings and separates finalization from release and referral", () => {
  let c = complete();
  c = finalizeEvaluation(c, "e1");
  expect(c.records[0].result?.goalScore).toBe(2);
  expect(c.records[0].result?.behaviorScore).toBe(4);
  expect(c.records[0].result?.overall).toBe(3);
  expect(c.records[0].releasedAt).toBeUndefined();
  const released = releaseEvaluation(c, "e1");
  expect(released.referral?.indicators[0].actual).toBe(9);
  expect(released.cycle.records[0].releasedAt).toBeTruthy();
  expect(releaseEvaluation(released.cycle, "e1").referral).toBeUndefined();
});
it("shows accessible template editor and validates publication", () => {
  render(<Performance role="HR Administrator" />);
  fireEvent.click(screen.getByRole("button", { name: "Create KPI Goal Template" }));
  fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "Delivery goals" } });
  fireEvent.change(screen.getByLabelText("Applicable position"), { target: { value: "Designer" } });
  fireEvent.click(screen.getByRole("button", { name: "Publish template" }));
  expect(screen.getByRole("alert").textContent).toMatch(/indicator/i);
});
it("keeps template authoring unavailable in employee preview", () => {
  render(<Performance role="Employee" />);
  expect(screen.queryByRole("button", { name: "Create KPI Goal Template" })).toBeNull();
  expect(screen.getByRole("button", { name: "My assessments" })).toBeTruthy();
});
it("supports assigned peer reviewers, locks duplicate responses, and uses configured weights", () => {
  let c = createCycle(
    {
      id: "peer-cycle",
      name: "360",
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      start: "2026-11-01",
      weights: { goals: 70, behavioral: 30 },
      behaviorPolicy: "average",
      stages: [
        { type: "Self", deadline: "2026-11-02" },
        { type: "Manager", deadline: "2026-11-03" },
        { type: "Peer", deadline: "2026-11-04", reviewerIds: ["p1", "p2"] },
        { type: "HR", deadline: "2026-11-05" },
      ],
    },
    [employee],
    [goal],
    behavior,
  );
  c = submitAssessment(c, "e1", "Self", { q1: "4" }, { i1: 9 }, "");
  c = submitAssessment(c, "e1", "Manager", { q1: "4" }, { i1: 9 }, "");
  expect(() => submitAssessment(c, "e1", "Peer", { q1: "5" }, {}, "", "unassigned")).toThrow(/assigned/);
  c = submitAssessment(c, "e1", "Peer", { q1: "5" }, {}, "", "p1");
  expect(() => submitAssessment(c, "e1", "Peer", { q1: "5" }, {}, "", "p1")).toThrow(/already/);
  expect(() => submitAssessment(c, "e1", "HR", { q1: "4" }, {}, "")).toThrow(/preceding/);
  c = submitAssessment(c, "e1", "Peer", { q1: "5" }, {}, "", "p2");
  c = submitAssessment(c, "e1", "HR", { q1: "4" }, {}, "");
  c = finalizeEvaluation(c, "e1");
  expect(c.records[0].result?.goalScore).toBe(2);
  expect(c.records[0].result?.behaviorScore).toBeCloseTo(4.4);
  expect(c.records[0].result?.overall).toBeCloseTo(2.72);
});
it("allows authoritative manager behavior and excludes Not Observed", () => {
  let c = cycle();
  c.behaviorPolicy = "Manager";
  c = submitAssessment(c, "e1", "Self", { q1: "NO" }, { i1: 10 }, "");
  c = submitAssessment(c, "e1", "Manager", { q1: "3" }, { i1: 10 }, "");
  c = submitAssessment(c, "e1", "HR", { q1: "5" }, {}, "");
  expect(finalizeEvaluation(c, "e1").records[0].result?.behaviorScore).toBe(3);
});
it("runs employee evidence, manager verification, assessment submission, HR finalization, and persisted PIP referral through React", () => {
  const manager = { id: "m1", name: "Taylor", title: "Manager", department: "Design", manager: "" };
  localStorage.setItem("pms-react-employees-v1", JSON.stringify([employee, manager]));
  localStorage.setItem("pms-react-kpi-templates-v1", JSON.stringify([goal]));
  localStorage.setItem("pms-react-behavior-templates-v1", JSON.stringify([behavior]));
  const assigned = {
    id: "assigned1",
    employeeId: "e1",
    templateId: "g1",
    indicator: goal.indicators[0],
    name: "Delivery",
    start: "2026-01-01",
    deadline: "2026-12-31",
    progress: 50,
    evidence: "",
    verification: "Pending" as const,
    verificationNote: "",
    milestones: [],
  };
  localStorage.setItem("pms-react-goals-v1", JSON.stringify([assigned]));
  const c = createCycle(
    {
      id: "ui-cycle",
      name: "Annual UI",
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      start: "2026-11-01",
      stages: [
        { type: "Self", deadline: "2026-11-10" },
        { type: "Manager", deadline: "2026-11-11" },
        { type: "HR", deadline: "2026-11-12" },
      ],
    },
    [employee],
    [goal],
    behavior,
    [assigned],
  );
  localStorage.setItem("pms-react-cycles-v1", JSON.stringify([c]));
  const mount = (role: string, id: string) => render(<Performance role={role} employeeId={id} />);
  mount("Employee", "e1");
  fireEvent.click(screen.getByRole("button", { name: "Goals & milestones" }));
  fireEvent.click(screen.getByRole("button", { name: "Delivery" }));
  let dialog = within(screen.getByRole("dialog"));
  fireEvent.change(dialog.getByLabelText("Actual result"), { target: { value: "9" } });
  fireEvent.change(dialog.getByLabelText("Accomplishment evidence"), {
    target: { value: "Delivered nine approved assets." },
  });
  fireEvent.click(dialog.getByRole("button", { name: "Save accomplishment" }));
  fireEvent.click(screen.getByRole("button", { name: "My assessments" }));
  fireEvent.click(screen.getByRole("button", { name: "Open Self assessment" }));
  dialog = within(screen.getByRole("dialog"));
  fireEvent.change(dialog.getByLabelText("Teamwork (required)"), { target: { value: "4" } });
  fireEvent.click(dialog.getByRole("button", { name: "Submit assessment" }));
  cleanup();
  mount("Manager", "m1");
  fireEvent.click(screen.getByRole("button", { name: "Goals & milestones" }));
  fireEvent.click(screen.getByRole("button", { name: "Delivery" }));
  dialog = within(screen.getByRole("dialog"));
  fireEvent.change(dialog.getByLabelText("Manager verification note"), {
    target: { value: "Evidence checked against delivery records." },
  });
  fireEvent.click(dialog.getByRole("button", { name: "Verify result" }));
  fireEvent.click(screen.getByRole("button", { name: "My assessments" }));
  fireEvent.click(screen.getByRole("button", { name: "Open Manager assessment" }));
  dialog = within(screen.getByRole("dialog"));
  fireEvent.change(dialog.getByLabelText("Teamwork (required)"), { target: { value: "4" } });
  fireEvent.click(dialog.getByRole("button", { name: "Submit assessment" }));
  cleanup();
  mount("HR Administrator", "hr");
  fireEvent.click(screen.getByRole("button", { name: "Evaluations & results" }));
  fireEvent.click(screen.getByRole("button", { name: "Open HR assessment" }));
  dialog = within(screen.getByRole("dialog"));
  fireEvent.change(dialog.getByLabelText("Teamwork (required)"), { target: { value: "4" } });
  fireEvent.click(dialog.getByRole("button", { name: "Submit assessment" }));
  fireEvent.click(screen.getByRole("button", { name: "Finalize evaluation" }));
  expect(localStorage.getItem("pms-react-pip-referrals-v1")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Release results" }));
  const referrals = JSON.parse(localStorage.getItem("pms-react-pip-referrals-v1") || "[]");
  expect(referrals).toHaveLength(1);
  expect(referrals[0].employeeId).toBe("e1");
  expect(referrals[0].indicators[0].actual).toBe(9);
  cleanup();
  mount("Employee", "e1");
  fireEvent.click(screen.getByRole("button", { name: "Evaluations & results" }));
  fireEvent.click(screen.getByRole("button", { name: "View evaluation" }));
  expect(within(screen.getByRole("dialog")).getByText("3.00 / 5")).toBeTruthy();
});
it("persists incomplete assessment drafts without advancing the stage", () => {
  const c = saveAssessmentDraft(cycle(), "e1", "Self", { q1: "4" }, "Draft feedback");
  expect(c.records[0].drafts["Self"].feedback).toBe("Draft feedback");
  expect(c.records[0].responses).toHaveLength(0);
  expect(submitAssessment(c, "e1", "Self", { q1: "4" }, { i1: 10 }, "Done").records[0].drafts["Self"]).toBeUndefined();
});
it("schedules future cycle starts and rejects invalid calendar dates", () => {
  const input = {
    id: "future",
    name: "Future",
    periodStart: "2027-01-01",
    periodEnd: "2027-12-31",
    start: "2999-11-01",
    stages: [
      { type: "Self" as const, deadline: "2999-11-02" },
      { type: "Manager" as const, deadline: "2999-11-03" },
      { type: "HR" as const, deadline: "2999-11-04" },
    ],
  };
  expect(createCycle(input, [employee], [goal], behavior).status).toBe("Scheduled");
  expect(() => createCycle({ ...input, periodStart: "2027-02-30" }, [employee], [goal], behavior)).toThrow(/valid/);
});
it("validates configured multiple-choice assessment answers", () => {
  let c = cycle();
  c.records[0].behaviorTemplate.questions.push({
    id: "choice",
    title: "Readiness",
    kind: "Choice",
    required: true,
    options: ["Ready", "Needs support"],
  });
  expect(() => submitAssessment(c, "e1", "Self", { q1: "4", choice: "Invalid" }, { i1: 10 }, "")).toThrow(/configured/);
  c = submitAssessment(c, "e1", "Self", { q1: "4", choice: "Ready" }, { i1: 10 }, "");
  expect(c.records[0].responses[0].answers.choice).toBe("Ready");
});
it("assigns peer reviewers per subject without blocking other participants from reviewing", () => {
  const second = { ...employee, id: "e2", name: "Blake" };
  const c = createCycle(
    {
      id: "subject-peer",
      name: "Two participants",
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      start: "2026-11-01",
      stages: [
        { type: "Self", deadline: "2026-11-02" },
        { type: "Manager", deadline: "2026-11-03" },
        { type: "Peer", deadline: "2026-11-04", reviewerByEmployee: { e1: ["e2"], e2: ["e1"] } },
        { type: "HR", deadline: "2026-11-05" },
      ],
    },
    [employee, second],
    [goal],
    behavior,
  );
  let next = submitAssessment(c, "e1", "Self", { q1: "4" }, { i1: 10 }, "");
  next = submitAssessment(next, "e1", "Manager", { q1: "4" }, { i1: 10 }, "");
  expect(() => submitAssessment(next, "e1", "Peer", { q1: "4" }, {}, "", "e1")).toThrow(/assigned/);
  expect(submitAssessment(next, "e1", "Peer", { q1: "4" }, {}, "", "e2").records[0].responses).toHaveLength(3);
});
it("freezes position-specific behavioral overrides independently", () => {
  const custom = { ...behavior, id: "custom-behavior", name: "Designer behaviors", position: "Designer" };
  const c = createCycle(
    {
      id: "override",
      name: "Position behavior",
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      start: "2026-11-01",
      behaviorByPosition: { Designer: custom },
      stages: [
        { type: "Self", deadline: "2026-11-02" },
        { type: "Manager", deadline: "2026-11-03" },
        { type: "HR", deadline: "2026-11-04" },
      ],
    },
    [employee],
    [goal],
    behavior,
  );
  custom.name = "Edited afterward";
  expect(c.records[0].behaviorTemplate.name).toBe("Designer behaviors");
});
it("requires reasons for target revisions and retains previous criteria", () => {
  const assigned = {
    id: "goal-revise",
    employeeId: "e1",
    templateId: "g1",
    indicator: goal.indicators[0],
    name: "Delivery",
    start: "2026-01-01",
    deadline: "2026-12-31",
    progress: 25,
    evidence: "Prior evidence",
    verification: "Verified" as const,
    verificationNote: "Checked",
    milestones: [],
    revisions: [],
  };
  expect(() => reviseGoal(assigned, { target: 12, deadline: "2026-12-30", reason: "" }, "m1")).toThrow(/reason/);
  const next = reviseGoal(assigned, { target: 12, deadline: "2026-12-30", reason: "Scope increased" }, "m1");
  expect(next.indicator.target).toBe(12);
  expect(assigned.indicator.target).toBe(10);
  expect(next.verification).toBe("Pending");
  expect(next.revisions![0].detail).toContain("10");
  expect(next.revisions![0].detail).toContain("Scope increased");
});
it("limits final comments to the assigned manager and preserves comments after release", () => {
  const manager = { id: "m1", name: "Taylor", title: "Lead", department: "Design", manager: "" };
  expect(() => setManagerComment(complete(), "e1", { ...manager, name: "Unrelated" }, "Good work")).toThrow(/manager/);
  let c = finalizeEvaluation(complete(), "e1");
  c = setManagerComment(c, "e1", manager, "Focus next quarter on estimation.");
  expect(releaseEvaluation(c, "e1").cycle.records[0].managerComment).toBe("Focus next quarter on estimation.");
});
it("opens saved cycle drafts with their name, participants, and settings for editing", () => {
  localStorage.setItem("pms-react-employees-v1", JSON.stringify([employee]));
  localStorage.setItem("pms-react-kpi-templates-v1", JSON.stringify([goal]));
  localStorage.setItem("pms-react-behavior-templates-v1", JSON.stringify([behavior]));
  const draft = cycle();
  draft.status = "Draft";
  localStorage.setItem("pms-react-cycles-v1", JSON.stringify([draft]));
  render(<Performance role="HR Administrator" />);
  fireEvent.click(screen.getByRole("button", { name: "Review cycles" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit cycle draft" }));
  expect((screen.getByLabelText("Cycle name") as HTMLInputElement).value).toBe("Annual");
  expect((screen.getByLabelText("Goals weight (%)") as HTMLInputElement).value).toBe("50");
});
function legacyFixture() {
  return {
    employees: [["e1", "Alex", "Designer", "Design", "Taylor", 100, "Completed"]],
    goals: [
      {
        id: 7,
        ownerId: "e1",
        employee: "Alex",
        name: "Delivery",
        startDate: "2026-01-01",
        due: "2026-12-31",
        progress: 75,
        milestones: [{ title: "Approved handoff", done: true }],
        evaluationActuals: { old: { value: 9 } },
        goalVerifications: {
          old: {
            state: "Verified",
            reason: "Checked original evidence",
            history: [{ state: "Pending", by: "e1", at: "2026-11-01" }],
          },
        },
      },
    ],
    unifiedReviews: {
      goalTemplates: [
        {
          ...goal,
          indicators: [
            {
              ...goal.indicators[0],
              matrix: {
                kind: "scale",
                title: "Original scale",
                bound: "minimum",
                scoring: false,
                rows: [
                  { minimum: 0, label: "Low", score: 2 },
                  { minimum: 10, label: "Met", score: 5 },
                ],
              },
            },
          ],
        },
      ],
      templates: [{ ...behavior, questions: [{ id: "q1", title: "Teamwork", type: "Rating", required: true }] }],
      cycles: [
        {
          id: "old",
          name: "Original review",
          periodStart: "2026-01-01",
          periodEnd: "2026-12-31",
          start: "2026-11-01",
          deadline: "2026-11-12",
          participants: ["e1"],
          status: "Completed",
          released: true,
          finalized: "2026-11-12",
          releasedAt: "2026-11-13",
          stages: [
            { type: "Self", deadline: "2026-11-10" },
            { type: "Manager", deadline: "2026-11-11" },
            { type: "HR", deadline: "2026-11-12" },
          ],
          goalTemplates: { e1: "g1" },
          behavioralTemplate: "b1",
          goalLinks: {
            e1: [
              {
                goalId: 7,
                indicatorId: "i1",
                target: 10,
                unit: "Count",
                direction: "Higher",
                weight: 100,
                scoreMet: 5,
                scoreBelow: 2,
              },
            ],
          },
          weights: { goals: 50, behavioral: 50 },
          resultSnapshots: { e1: { goalScore: 2, behaviorScore: 4, overall: 3, at: "2026-11-12" } },
          finalComments: { e1: "Original manager final comment" },
        },
      ],
      assignments: ["Self", "Manager", "HR"].map((type) => ({
        cycle: "old",
        subject: "e1",
        reviewer: type === "Self" ? "e1" : type === "Manager" ? "m1" : "hr1",
        type,
        state: "Completed",
        answers: { q1: "4" },
        actuals: { i1: 9 },
        submitted: "2026-11-10",
        feedback: "Original feedback",
        template: { ...behavior, questions: [{ id: "q1", title: "Teamwork", type: "Rating", required: true }] },
      })),
    },
  };
}
it("migrates original template matrices, goals, snapshots, official scores, and feedback without recomputing history", () => {
  const source = legacyFixture(),
    before = JSON.stringify(source);
  const migrated = migrateLegacyPerformance(source, [employee]);
  expect(JSON.stringify(source)).toBe(before);
  expect(migrated.templates[0].indicators[0].matrix?.kind).toBe("scale");
  expect(migrated.goals[0].milestones[0].name).toBe("Approved handoff");
  expect(migrated.cycles[0].records[0].result?.overall).toBe(3);
  expect(migrated.cycles[0].records[0].managerComment).toBe("Original manager final comment");
  expect(migrated.cycles[0].records[0].responses[1].actuals.i1).toBe(9);
});
it("imports legacy performance once, preserves React edits, and never changes the source store", () => {
  const source = JSON.stringify(legacyFixture());
  localStorage.setItem("people-mvp-v1", source);
  localStorage.setItem("pms-react-employees-v1", JSON.stringify([employee]));
  render(<Performance role="HR Administrator" />);
  expect(screen.getByText("Designer goals")).toBeTruthy();
  expect(localStorage.getItem("people-mvp-v1")).toBe(source);
  cleanup();
  const migrated = JSON.parse(localStorage.getItem("pms-react-kpi-templates-v1") || "[]");
  migrated[0].name = "React edited template";
  localStorage.setItem("pms-react-kpi-templates-v1", JSON.stringify(migrated));
  render(<Performance role="HR Administrator" />);
  expect(screen.getByText("React edited template")).toBeTruthy();
});
it("limits template and employee data to the active company and preserves other companies on save", () => {
  localStorage.setItem(
    "pms-react-kpi-templates-v1",
    JSON.stringify([
      { ...goal, companyId: "mayon" },
      { ...goal, id: "other", name: "Other company goals", companyId: "other" },
    ]),
  );
  render(<Performance role="HR Administrator" companyId="other" />);
  expect(screen.queryByText("Designer goals")).toBeNull();
  expect(screen.getByText("Other company goals")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Other company goals" }));
  fireEvent.click(screen.getByRole("button", { name: "Archive template" }));
  expect(
    JSON.parse(localStorage.getItem("pms-react-kpi-templates-v1") || "[]").find((t: { id: string }) => t.id === "g1")
      .status,
  ).toBe("Published");
});
it("blocks overdue submissions until HR extends the stage with a reason", () => {
  vi.setSystemTime(new Date("2026-11-11T04:00:00Z"));
  expect(() => submitAssessment(cycle(), "e1", "Self", { q1: "4" }, { i1: 10 }, "")).toThrow(/deadline/);
  expect(() => extendStageDeadline(cycle(), "Self", "2026-11-11", "", "hr")).toThrow(/reason/);
  const extended = extendStageDeadline(cycle(), "Self", "2026-11-11", "Allow late submission", "hr");
  expect(extended.stages.find((s) => s.type === "Manager")?.deadline).toBe("2026-11-12");
  expect(extended.stages.find((s) => s.type === "HR")?.deadline).toBe("2026-11-13");
  expect(submitAssessment(extended, "e1", "Self", { q1: "4" }, { i1: 10 }, "").records[0].responses).toHaveLength(1);
  expect(extended.revisions?.[0].detail).toContain("Allow late submission");
});
it("supports goals-only cycles without demanding behavioral templates or ratings", () => {
  let c = createCycle(
    {
      id: "goals-only",
      name: "Goal review",
      components: { goals: true, behavioral: false },
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      start: "2026-11-01",
      stages: [
        { type: "Self", deadline: "2026-11-10" },
        { type: "Manager", deadline: "2026-11-11" },
        { type: "HR", deadline: "2026-11-12" },
      ],
    },
    [employee],
    [goal],
    behavior,
  );
  c = submitAssessment(c, "e1", "Self", {}, { i1: 10 }, "");
  c = submitAssessment(c, "e1", "Manager", {}, { i1: 10 }, "");
  c = submitAssessment(c, "e1", "HR", {}, {}, "");
  const final = finalizeEvaluation(c, "e1");
  expect(final.records[0].result).toEqual({ goalScore: 5, behaviorScore: null, overall: 5 });
  expect(final.weights).toEqual({ goals: 100, behavioral: 0 });
});
it("supports behavior-only cycles without requiring goal templates or actuals", () => {
  let c = createCycle(
    {
      id: "behavior-only",
      name: "Behavior review",
      components: { goals: false, behavioral: true },
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      start: "2026-11-01",
      stages: [
        { type: "Self", deadline: "2026-11-10" },
        { type: "Manager", deadline: "2026-11-11" },
        { type: "HR", deadline: "2026-11-12" },
      ],
    },
    [employee],
    [],
    behavior,
  );
  c = submitAssessment(c, "e1", "Self", { q1: "4" }, {}, "");
  c = submitAssessment(c, "e1", "Manager", { q1: "4" }, {}, "");
  c = submitAssessment(c, "e1", "HR", { q1: "4" }, {}, "");
  expect(finalizeEvaluation(c, "e1").records[0].result).toEqual({ goalScore: null, behaviorScore: 4, overall: 4 });
});
it("cancels cycles with an audit reason and prevents further assessment work", () => {
  expect(() => cancelCycle(cycle(), "", "hr")).toThrow(/reason/);
  const cancelled = cancelCycle(cycle(), "Duplicate cycle", "hr");
  expect(cancelled.status).toBe("Cancelled");
  expect(() => submitAssessment(cancelled, "e1", "Self", { q1: "4" }, { i1: 10 }, "")).toThrow(/not open/);
  expect(cancelled.revisions?.[0].detail).toContain("Duplicate cycle");
});
it("shows prior submitted nonanonymous stages only when the cycle permits evaluator visibility", () => {
  let c = submitAssessment(cycle(), "e1", "Self", { q1: "4" }, { i1: 10 }, "Prior stage evidence");
  c.previousStageVisibility = "responses";
  localStorage.setItem(
    "pms-react-employees-v1",
    JSON.stringify([employee, { id: "m1", name: "Taylor", title: "Lead", department: "Design", manager: "" }]),
  );
  localStorage.setItem("pms-react-cycles-v1", JSON.stringify([c]));
  render(<Performance role="Manager" employeeId="m1" />);
  fireEvent.click(screen.getByRole("button", { name: "Open Manager assessment" }));
  expect(within(screen.getByRole("dialog")).getByText("Prior stage evidence")).toBeTruthy();
});
it("creates described personal goals, calculates milestone progress, and scopes approval to the manager", () => {
  const personal = createPersonalGoal(
    {
      name: "Learn prototyping",
      description: "Complete the course and present results.",
      category: "Growth",
      start: "2026-11-01",
      deadline: "2026-12-01",
      target: 1,
      unit: "Course",
      direction: "Higher",
      trackingMode: "Milestones",
      requestApproval: true,
    },
    employee,
  );
  expect(personal.source).toBe("self");
  expect(personal.approvalStatus).toBe("Pending");
  expect(personal.description).toContain("Complete");
  personal.milestones = [
    { id: "first", name: "Course", deadline: "2026-11-20", done: true },
    { id: "second", name: "Presentation", deadline: "2026-12-01", done: false },
  ];
  expect(goalProgress(personal)).toBe(50);
  const manager = { id: "m1", name: "Taylor", title: "Lead", department: "Design", manager: "" };
  expect(() =>
    reviewGoalApproval(personal, { ...manager, name: "Unrelated" }, employee, "Approved", "Aligned"),
  ).toThrow(/manager/);
  expect(
    reviewGoalApproval(personal, manager, employee, "Approved", "Aligned to team development").approvalStatus,
  ).toBe("Approved");
});
it("offers employee personal-goal creation with required description and measured criteria", () => {
  localStorage.setItem("pms-react-employees-v1", JSON.stringify([employee]));
  render(<Performance role="Employee" employeeId="e1" />);
  fireEvent.click(screen.getByRole("button", { name: "Goals & milestones" }));
  fireEvent.click(screen.getByRole("button", { name: "Create personal goal" }));
  fireEvent.change(screen.getByLabelText("Goal name"), { target: { value: "Learn prototyping" } });
  fireEvent.change(screen.getByLabelText("Goal description"), { target: { value: "Finish the course" } });
  fireEvent.change(screen.getByLabelText("Personal goal start"), { target: { value: "2026-11-01" } });
  fireEvent.change(screen.getByLabelText("Personal goal deadline"), { target: { value: "2026-12-01" } });
  fireEvent.change(screen.getByLabelText("Goal target"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Goal unit"), { target: { value: "Course" } });
  fireEvent.click(screen.getByRole("button", { name: "Save personal goal" }));
  expect(screen.getByRole("button", { name: "Learn prototyping" })).toBeTruthy();
});
it("keeps malformed performance data intact when an author attempts a save", () => {
  const original = '[{"id":"broken"}]';
  localStorage.setItem("pms-react-kpi-templates-v1", original);
  render(<Performance role="HR Administrator" />);
  fireEvent.click(screen.getByRole("button", { name: "Create KPI Goal Template" }));
  fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "New draft" } });
  fireEvent.change(screen.getByLabelText("Applicable position"), { target: { value: "Designer" } });
  fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
  expect(localStorage.getItem("pms-react-kpi-templates-v1")).toBe(original);
});
it("reports pending assessments only to their evaluator in the selected company without writing", () => {
  localStorage.setItem(
    "pms-react-employees-v1",
    JSON.stringify([employee, { id: "m1", name: "Taylor", title: "Lead", department: "Design", manager: "" }]),
  );
  localStorage.setItem("pms-react-cycles-v1", JSON.stringify([cycle()]));
  const original = localStorage.getItem("pms-react-cycles-v1");
  expect(getPerformanceNotifications("Employee", "e1")).toHaveLength(1);
  expect(getPerformanceNotifications("Manager", "m1")).toHaveLength(0);
  expect(getPerformanceNotifications("Employee", "e1", "other")).toHaveLength(0);
  const c = submitAssessment(cycle(), "e1", "Self", { q1: "4" }, { i1: 10 }, "");
  localStorage.setItem("pms-react-cycles-v1", JSON.stringify([c]));
  expect(getPerformanceNotifications("Manager", "m1")[0].employeeId).toBe("e1");
  expect(original).not.toBeNull();
  expect(localStorage.getItem("pms-react-cycles-v1")).toBe(JSON.stringify([c]));
});
it("preserves each historical assessment template and reconstructs only unstored legacy stage scores", () => {
  const source = legacyFixture();
  delete (source.unifiedReviews.cycles[0] as { resultSnapshots?: unknown }).resultSnapshots;
  source.unifiedReviews.assignments[2].template.questions = [
    { id: "q-final", title: "Final HR competency", type: "Rating", required: true },
  ];
  Object.assign(source.unifiedReviews.assignments[2].answers, { "q-final": "5" });
  source.unifiedReviews.assignments[2].actuals.i1 = 10;
  const migrated = migrateLegacyPerformance(source, [employee]);
  expect(migrated.cycles[0].records[0].responses[2].behaviorTemplate?.questions[0].title).toBe("Final HR competency");
  expect(migrated.cycles[0].records[0].result?.behaviorScore).toBe(5);
});
