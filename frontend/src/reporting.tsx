import { workflowToday } from "./workflow-clock";
import { useState } from "react";
import { z } from "zod";
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import type { Employee } from "./employee-directory";

const text = z.string().min(1);
const employeeSnapshot = z.object({ id: text, name: text, department: text });
const result = z.object({
  goalScore: z.number().finite().min(1).max(5).nullable(),
  behaviorScore: z.number().finite().min(1).max(5).nullable(),
  overall: z.number().finite().min(1).max(5).nullable(),
});
const behaviorQuestions = z.object({ questions: z.array(z.object({ id: text, title: text, kind: text })) });
const cycleSchema = z.object({
  id: text,
  name: text,
  periodStart: text,
  periodEnd: text,
  status: text,
  anonymousThreshold: z.number().default(2),
  stages: z.array(z.object({ type: text, deadline: text })),
  records: z.array(
    z.object({
      employee: employeeSnapshot,
      behaviorTemplate: behaviorQuestions.optional(),
      responses: z.array(
        z.object({
          type: text,
          reviewerId: text.optional(),
          answers: z.record(z.string(), z.string()).default({}),
          behaviorTemplate: behaviorQuestions.optional(),
        }),
      ),
      finalizedAt: text.optional(),
      releasedAt: text.optional(),
      result: result.optional(),
    }),
  ),
});
const goalSchema = z.object({
  id: text,
  employeeId: text,
  name: text,
  start: text,
  deadline: text,
  progress: z.number().finite().min(0).max(100),
  verification: z.string().optional(),
  actual: z.number().nullable().optional(),
});
const casesSchema = z.object({
  notices: z.array(
    z.object({
      id: text,
      employeeId: text,
      status: z.enum(["Draft", "Issued", "Responded", "Closed", "Cancelled"]),
      deadline: text,
    }),
  ),
  plans: z.array(
    z.object({
      id: text,
      employeeId: text,
      state: z.enum([
        "Draft",
        "Awaiting Planning",
        "Active",
        "Completed",
        "Completed with Exclusions",
        "Not Met",
        "Cancelled",
      ]),
    }),
  ),
});
type ReportCycle = z.infer<typeof cycleSchema>;
function read<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
  const stored = localStorage.getItem(key);
  return stored === null ? fallback : schema.parse(JSON.parse(stored));
}
function download(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((value) => {
          const cell = String(value);
          return '"' + (/^[\s]*[=+@-]/.test(cell) ? "'" : "") + cell.replaceAll('"', '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {value}
        {detail && <p className="dashboard-metric-detail">{detail}</p>}
      </CardContent>
    </Card>
  );
}

export function Reporting({
  employees,
  report,
  role = "HR Administrator",
  employeeId = "",
  onOpenGoals,
  onOpenReviews,
}: {
  employees: Employee[];
  report: boolean;
  role?: string;
  employeeId?: string;
  onOpenGoals?: () => void;
  onOpenReviews?: () => void;
}) {
  const [cycleId, setCycleId] = useState("All cycles");
  const [period, setPeriod] = useState("All periods");
  const [department, setDepartment] = useState("All departments");
  const [reviewType, setReviewType] = useState("All types");
  let cycles: ReportCycle[] = [],
    goals: z.infer<typeof goalSchema>[] = [],
    cases: z.infer<typeof casesSchema> = { notices: [], plans: [] },
    error = "";
  try {
    cycles = read("pms-react-cycles-v1", z.array(cycleSchema), []);
    goals = read("pms-react-goals-v1", z.array(goalSchema), []);
    cases = read("pms-react-cases-v1", casesSchema, { notices: [], plans: [] });
  } catch {
    cycles = [];
    goals = [];
    cases = { notices: [], plans: [] };
    error = "Unable to read saved reporting data. Existing browser records remain unchanged.";
  }
  const authorizedEmployees = employees.filter((employee) => role !== "Employee" || employee.id === employeeId);
  const authorizedIds = new Set(authorizedEmployees.map((employee) => employee.id));
  const scopedCycles = cycles.filter((cycle) => cycle.records.some((record) => authorizedIds.has(record.employee.id)));
  const rows = scopedCycles.flatMap((cycle) =>
    cycle.records.filter((record) => authorizedIds.has(record.employee.id)).map((record) => ({ cycle, record })),
  );
  const departments = [
    ...new Set([
      ...authorizedEmployees.map((employee) => employee.department),
      ...rows.map((row) => row.record.employee.department),
    ]),
  ].sort();
  const selectedEmployees = authorizedEmployees.filter(
    (employee) => department === "All departments" || employee.department === department,
  );
  const selectedIds = new Set(selectedEmployees.map((employee) => employee.id));
  const visibleRows = rows.filter(
    ({ cycle, record }) =>
      (cycleId === "All cycles" || cycle.id === cycleId) &&
      (period === "All periods" || `${cycle.periodStart} to ${cycle.periodEnd}` === period) &&
      (department === "All departments" || record.employee.department === department) &&
      (reviewType === "All types" || cycle.stages.some((stage) => stage.type === reviewType)),
  );
  const releasedScore = (record: ReportCycle["records"][number]) =>
    record.finalizedAt && record.releasedAt ? record.result : undefined;
  const rated = visibleRows.flatMap(({ record }) => {
    const score = releasedScore(record);
    return score && score.overall !== null ? [score.overall] : [];
  });
  const finalized = visibleRows.filter(({ record }) => !!record.finalizedAt).length;
  const average = rated.length
    ? (rated.reduce((sum, score) => sum + score, 0) / rated.length).toFixed(2) + " / 5"
    : "No released scores";
  const submitted = visibleRows.reduce(
    (sum, { record }) =>
      sum + record.responses.filter((response) => reviewType === "All types" || response.type === reviewType).length,
    0,
  );
  const selectedRanges = scopedCycles.filter(
    (cycle) =>
      (cycleId === "All cycles" || cycle.id === cycleId) &&
      (period === "All periods" || `${cycle.periodStart} to ${cycle.periodEnd}` === period),
  );
  const visibleGoals = goals.filter(
    (goal) =>
      selectedIds.has(goal.employeeId) &&
      ((cycleId === "All cycles" && period === "All periods") ||
        selectedRanges.some((cycle) => goal.start <= cycle.periodEnd && goal.deadline >= cycle.periodStart)),
  );
  const today = workflowToday();
  const notices = cases.notices.filter(
    (notice) => selectedIds.has(notice.employeeId) && (role === "HR Administrator" || notice.status !== "Draft"),
  );
  const plans = cases.plans.filter((plan) => selectedIds.has(plan.employeeId));
  const activePlans = plans.filter((plan) => ["Awaiting Planning", "Draft", "Active"].includes(plan.state));
  const status = (record: ReportCycle["records"][number]) =>
    record.finalizedAt ? "Finalized" : record.responses.length ? "In progress" : "Not started";
  function exportEvaluations() {
    download("performance-evaluation-report.csv", [
      [
        "Employee ID",
        "Employee",
        "Department",
        "Cycle",
        "Review period",
        "Review type filter",
        "Evaluation status",
        "Submitted assessments",
        "Results",
        "Goals score",
        "Behavioral score",
        "Overall score",
      ],
      ...visibleRows.map(({ cycle, record }) => {
        const score = releasedScore(record);
        return [
          record.employee.id,
          record.employee.name,
          record.employee.department,
          cycle.name,
          `${cycle.periodStart} to ${cycle.periodEnd}`,
          reviewType,
          status(record),
          record.responses.filter((response) => reviewType === "All types" || response.type === reviewType).length,
          record.releasedAt ? "Released" : "Not released",
          score?.goalScore?.toFixed(2) ?? "",
          score?.behaviorScore?.toFixed(2) ?? "",
          score?.overall?.toFixed(2) ?? "",
        ];
      }),
    ]);
  }
  const completion = new Map<string, { total: number; complete: number }>();
  for (const { cycle, record } of visibleRows) {
    const label =
      role === "Employee" ? cycle.name : role === "Manager" ? record.employee.name : record.employee.department;
    const counts = completion.get(label) ?? { total: 0, complete: 0 };
    counts.total++;
    if (record.finalizedAt) counts.complete++;
    completion.set(label, counts);
  }
  const competencies = new Map<string, number[]>();
  const stages = new Map<string, { scores: number[]; withheld: boolean }>();
  for (const { cycle, record } of visibleRows) {
    if (!record.finalizedAt || !record.releasedAt) continue;
    for (const type of new Set(record.responses.map((response) => response.type))) {
      if (reviewType !== "All types" && reviewType !== type) continue;
      const responses = record.responses.filter((response) => response.type === type);
      const values = stages.get(type) ?? { scores: [], withheld: false };
      stages.set(type, values);
      if (
        (type === "Peer" || type === "Upward") &&
        new Set(responses.map((response) => response.reviewerId).filter(Boolean)).size < cycle.anonymousThreshold
      ) {
        values.withheld = true;
        continue;
      }
      for (const response of responses) {
        for (const question of (response.behaviorTemplate ?? record.behaviorTemplate)?.questions ?? []) {
          const score = Number(response.answers[question.id]);
          if (question.kind !== "Rating" || !Number.isFinite(score) || score < 1 || score > 5) continue;
          const scores = competencies.get(question.title) ?? [];
          scores.push(score);
          competencies.set(question.title, scores);
          values.scores.push(score);
        }
      }
    }
  }
  const mean = (scores: number[]) =>
    scores.length
      ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2) + " / 5"
      : "No observed ratings";
  if (!report) {
    const reviewLabel =
      role === "Employee"
        ? "My review completion"
        : role === "Manager"
          ? "Team review completion"
          : "Organization review completion";
    const reviewTitle =
      role === "Employee" ? "My Review Status" : role === "Manager" ? "Team Review Status" : "Review Status";
    const pending = visibleRows.filter(({ cycle, record }) => cycle.status === "Active" && !record.finalizedAt).length;
    const awaiting = visibleGoals.filter((goal) => goal.verification === "Pending" && goal.actual != null);
    const statusCounts = [
      ["Not Started", visibleRows.filter(({ record }) => !record.finalizedAt && !record.responses.length).length],
      ["In Progress", visibleRows.filter(({ record }) => !record.finalizedAt && record.responses.length).length],
      ["Completed", finalized],
    ] as const;
    const completedPercent = visibleRows.length ? Math.round((finalized / visibleRows.length) * 100) : 0;
    const accomplishmentCounts = [
      ["Draft", visibleGoals.filter((goal) => goal.verification === "Pending" && goal.actual == null).length],
      ["Submitted", awaiting.length],
      ["Returned", visibleGoals.filter((goal) => goal.verification === "Returned").length],
      ["Verified", visibleGoals.filter((goal) => goal.verification === "Verified").length],
    ] as const;
    return (
      <section className="legacy-dashboard">
        <div className="legacy-dashboard-head">
          <div>
            <h1>Dashboard</h1>
            <p>Monitor review activity and goal progress across your organization.</p>
          </div>
          <div className="legacy-dashboard-filters">
            <select aria-label="Review period" value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option>All periods</option>
              {[...new Set(scopedCycles.map((c) => `${c.periodStart} to ${c.periodEnd}`))].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <select aria-label="Review cycle" value={cycleId} onChange={(event) => setCycleId(event.target.value)}>
              <option value="All cycles">All Cycles</option>
              {scopedCycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && <p role="alert">{error}</p>}
        <div className="legacy-dashboard-body">
          <div className="metrics dashboard-metrics">
            <Metric
              label={role === "Manager" ? "Team Members" : role === "Employee" ? "My Goals" : "Employees in Scope"}
              value={role === "Employee" ? visibleGoals.length : selectedEmployees.length}
              detail={
                role === "Manager" ? "Direct reports assigned to you" : "Employees and goals in your current scope"
              }
            />
            <Metric label="Pending Evaluations" value={pending} detail="Not started or in progress reviews" />
            <Metric label="Awaiting Verification" value={awaiting.length} detail="Submitted employee accomplishments" />
            <Metric
              label="Overdue Verification"
              value={awaiting.filter((goal) => goal.deadline < today).length}
              detail="Past the verification deadline"
            />
          </div>
          <div className="dashboard-panels">
            <section className="panel dashboard-chart">
              <h2>{role === "Manager" ? "Team " : ""}Accomplishments</h2>
              <p>Submission and verification status</p>
              {accomplishmentCounts.map(([label, count]) => {
                const percent = visibleGoals.length ? Math.round((count / visibleGoals.length) * 100) : 0;
                return (
                  <div key={label} className="dashboard-bar-row">
                    <span>
                      {label}
                      <small>{count} records</small>
                    </span>
                    <span className="dashboard-bar">
                      <i style={{ width: percent + "%" }} />
                    </span>
                    <b>{percent}%</b>
                  </div>
                );
              })}
            </section>
            <section className="panel dashboard-chart dashboard-review-status">
              <h2>{reviewTitle}</h2>
              <p>Evaluation period</p>
              <div className="dashboard-status">
                <svg role="img" aria-label={reviewLabel} viewBox="0 0 160 160">
                  <desc>{[...completion].map(([name, c]) => `${name}: ${c.complete} of ${c.total}`).join("; ")}</desc>
                  <circle cx="80" cy="80" r="65" stroke="#d5dce4" strokeWidth="19" fill="none" />
                  <circle
                    cx="80"
                    cy="80"
                    r="65"
                    stroke="#6ab999"
                    strokeWidth="19"
                    fill="none"
                    pathLength="100"
                    strokeDasharray={`${completedPercent} 100`}
                    transform="rotate(-90 80 80)"
                  />
                  <text x="80" y="79" textAnchor="middle" fill="currentColor" fontSize="32" fontWeight="700">
                    {completedPercent}%
                  </text>
                  <text x="80" y="101" textAnchor="middle" fill="#607b91" fontSize="10">
                    COMPLETED
                  </text>
                </svg>
                <ul>
                  {statusCounts.map(([label, count], index) => (
                    <li key={label}>
                      <i style={{ background: ["#b7c7d5", "#76add6", "#6ab999"][index] }} />
                      {label}
                      <b>{count}</b>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
            <section className="panel dashboard-chart dashboard-next-actions">
              <h2>Next Actions</h2>
              {awaiting.length > 0 && (
                <div className="next-action">
                  <div>
                    <b>Verify accomplishments</b>
                    <p>{awaiting.length} submitted for verification</p>
                  </div>
                  {onOpenGoals && (
                    <Button variant="outline" onClick={onOpenGoals}>
                      Open Goals →
                    </Button>
                  )}
                </div>
              )}
              {pending > 0 && (
                <div className="next-action">
                  <div>
                    <b>Pending evaluations</b>
                    <p>{pending} in your current scope</p>
                  </div>
                  {onOpenReviews && (
                    <Button variant="outline" onClick={onOpenReviews}>
                      Open Reviews →
                    </Button>
                  )}
                </div>
              )}
              {!awaiting.length && !pending && <p>No actions are due for this selection.</p>}
            </section>
          </div>
          {rated.length > 0 && (
            <section className="panel dashboard-chart">
              <h2>Released ratings</h2>
              <svg
                role="img"
                aria-label="Released performance rating distribution"
                viewBox="0 0 450 72"
                className="dashboard-ratings"
              >
                <desc>{rated.length} released evaluations</desc>
                {[1, 2, 3, 4, 5].map((band, i) => {
                  const height = (rated.filter((score) => Math.floor(score) === band).length / rated.length) * 45;
                  return (
                    <g key={band}>
                      <rect x={15 + i * 90} y={50 - height} width="60" height={height} rx="3" fill="#72abd7" />
                      <text x={45 + i * 90} y="68" textAnchor="middle" fontSize="12">
                        {band}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </section>
          )}
        </div>
      </section>
    );
  }
  return (
    <>
      <h1>{report ? "Reports" : "Dashboard"}</h1>
      <p>Review completion, released performance outcomes, and current employee workflows in your scope.</p>
      {error && <p role="alert">{error}</p>}
      <div className="toolbar" aria-label="Report filters">
        <label>
          Review cycle
          <select value={cycleId} onChange={(event) => setCycleId(event.target.value)}>
            <option>All cycles</option>
            {scopedCycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Review period
          <select value={period} onChange={(event) => setPeriod(event.target.value)}>
            <option>All periods</option>
            {[...new Set(scopedCycles.map((cycle) => `${cycle.periodStart} to ${cycle.periodEnd}`))].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Department
          <select value={department} onChange={(event) => setDepartment(event.target.value)}>
            <option>All departments</option>
            {departments.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Review type
          <select value={reviewType} onChange={(event) => setReviewType(event.target.value)}>
            <option>All types</option>
            {[...new Set(scopedCycles.flatMap((cycle) => cycle.stages.map((stage) => stage.type)))].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          onClick={() => {
            setCycleId("All cycles");
            setPeriod("All periods");
            setDepartment("All departments");
            setReviewType("All types");
          }}
        >
          Clear filters
        </Button>
      </div>
      <div className="metrics">
        <Metric label="Employees in scope" value={selectedEmployees.length} />
        <Metric label="Finalized evaluations" value={`${finalized} / ${visibleRows.length}`} />
        <Metric label="Submitted assessments" value={submitted} />
        <Metric label="Average released rating" value={average} />
        <Metric
          label="Average goal progress"
          value={
            visibleGoals.length
              ? `${Math.round(visibleGoals.reduce((sum, goal) => sum + goal.progress, 0) / visibleGoals.length)}%`
              : "No goals"
          }
        />
        <Metric
          label="Overdue goals"
          value={visibleGoals.filter((goal) => goal.progress < 100 && goal.deadline < today).length}
        />
      </div>
      <div className="toolbar">
        <Button onClick={exportEvaluations} disabled={!!error}>
          Export evaluation report
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            download("employee-report.csv", [
              ["Employee ID", "Name", "Job title", "Department", "Manager"],
              ...selectedEmployees.map((employee) => [
                employee.id,
                employee.name,
                employee.title,
                employee.department,
                employee.manager,
              ]),
            ])
          }
        >
          Export employee report
        </Button>
      </div>
      <section className="panel" aria-label="Evaluation details">
        <div className="panelhead">
          <h2>Evaluation report</h2>
        </div>
        <p>
          Scores include finalized, released evaluations only. Submitted assessments remain separate from HR
          finalization.
        </p>
        <div className="tablewrap">
          <table aria-label="Evaluation report">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Cycle</th>
                <th>Review period</th>
                <th>Submitted assessments</th>
                <th>Status</th>
                <th>Results</th>
                <th>Overall score</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(({ cycle, record }) => (
                <tr key={`${cycle.id}:${record.employee.id}`}>
                  <td>
                    {record.employee.name}
                    <small>{record.employee.department}</small>
                  </td>
                  <td>{cycle.name}</td>
                  <td>
                    {cycle.periodStart} to {cycle.periodEnd}
                  </td>
                  <td>
                    {
                      record.responses.filter((response) => reviewType === "All types" || response.type === reviewType)
                        .length
                    }
                  </td>
                  <td>{status(record)}</td>
                  <td>{record.releasedAt ? "Released" : "Not released"}</td>
                  <td>{releasedScore(record)?.overall?.toFixed(2) ?? "Unavailable"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleRows.length && <p>No evaluations match your scope and filters.</p>}
        </div>
      </section>
      <section className="panel" aria-label="Department completion">
        <div className="panelhead">
          <h2>Evaluation completion by department</h2>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Department</th>
                <th>Finalized</th>
                <th>Evaluations</th>
                <th>Completion</th>
              </tr>
            </thead>
            <tbody>
              {[...new Set(visibleRows.map((row) => row.record.employee.department))].map((name) => {
                const records = visibleRows.filter((row) => row.record.employee.department === name);
                const complete = records.filter((row) => row.record.finalizedAt).length;
                return (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>{complete}</td>
                    <td>{records.length}</td>
                    <td>{Math.round((complete / records.length) * 100)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel" aria-label="Released rating distribution">
        <div className="panelhead">
          <h2>Performance rating distribution</h2>
        </div>
        {rated.length ? (
          <ul>
            {[1, 2, 3, 4, 5].map((band) => (
              <li key={band}>
                {band} to {band === 5 ? "5" : `below ${band + 1}`}:{" "}
                {rated.filter((score) => Math.floor(score) === band).length}
              </li>
            ))}
          </ul>
        ) : (
          <p>No released ratings for this selection.</p>
        )}
      </section>
      <section className="panel">
        <div className="panelhead">
          <h2>Competency performance summary</h2>
        </div>
        <div className="tablewrap">
          <table aria-label="Competency performance summary">
            <thead>
              <tr>
                <th>Competency</th>
                <th>Average rating</th>
                <th>Responses</th>
              </tr>
            </thead>
            <tbody>
              {[...competencies].map(([title, scores]) => (
                <tr key={title}>
                  <td>{title}</td>
                  <td>{mean(scores)}</td>
                  <td>{scores.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="panelhead">
          <h2>Assessment stage breakdown</h2>
        </div>
        <div className="tablewrap">
          <table aria-label="Assessment stage breakdown">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Average rating</th>
                <th>Responses</th>
              </tr>
            </thead>
            <tbody>
              {[...stages].map(([type, value]) => (
                <tr key={type}>
                  <td>{type}</td>
                  <td>
                    {value.scores.length ? mean(value.scores) : value.withheld ? "Withheld" : "No observed ratings"}
                  </td>
                  <td>{value.scores.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel" aria-label="Improvement and notice summary">
        <div className="panelhead">
          <h2>Improvement and notice summary</h2>
        </div>
        <p>
          These current case counts follow the department filter. Review cycle, period, and type filters apply to
          evaluation metrics; goal metrics follow overlapping evaluation periods.
        </p>
        <p>Active improvement plans: {activePlans.length}</p>
        <p>
          Completed improvement plans:{" "}
          {plans.filter((plan) => ["Completed", "Completed with Exclusions"].includes(plan.state)).length}
        </p>
        <p>Plans not met: {plans.filter((plan) => plan.state === "Not Met").length}</p>
        <p>Active notices: {notices.filter((notice) => ["Issued", "Responded"].includes(notice.status)).length}</p>
        <p>
          Overdue notices awaiting response:{" "}
          {notices.filter((notice) => notice.status === "Issued" && notice.deadline < today).length}
        </p>
        <p>Draft notices: {notices.filter((notice) => notice.status === "Draft").length}</p>
      </section>
    </>
  );
}
