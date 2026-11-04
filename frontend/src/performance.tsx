import { workflowToday as today } from "./workflow-clock";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { Button } from "./components/ui/button";
import { Dialog } from "./components/ui/dialog";

const text = z.string().trim().min(1);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) => !Number.isNaN(Date.parse(value)) && new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value,
  );

const number = z.number().finite().nonnegative();
const score = z.number().min(1).max(5);
const Status = z.enum(["Draft", "Published", "Archived"]);
const EmployeeSchema = z.object({
  id: text,
  name: text,
  title: text,
  department: text,
  manager: z.string(),
  companyId: z.string().optional(),
});
const ScaleSchema = z.object({
  kind: z.literal("scale"),
  title: z.string(),
  scoring: z.boolean(),
  bound: z.enum(["minimum", "maximum"]),
  rows: z.array(z.object({ boundary: number.nullable(), label: z.string(), score: z.number() })),
});
const MatrixSchema = z.discriminatedUnion("kind", [
  ScaleSchema,
  z.object({
    kind: z.literal("table"),
    title: z.string(),
    scoring: z.literal(false),
    columns: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  }),
]);
const IndicatorSchema = z.object({
  id: text,
  name: z.string(),
  unit: z.string(),
  target: number,
  weight: number,
  direction: z.enum(["Higher", "Lower"]),
  scoreMet: z.number(),
  scoreBelow: z.number(),
  matrix: MatrixSchema.optional(),
});
const GoalTemplateSchema = z.object({
  id: text,
  companyId: z.string().optional(),
  name: text,
  description: z.string(),
  position: text,
  version: z.number().int().positive(),
  status: Status,
  indicators: z.array(IndicatorSchema),
});
const BehaviorTemplateSchema = z.object({
  id: text,
  companyId: z.string().optional(),
  name: text,
  description: z.string(),
  position: z.string(),
  version: z.number().int().positive(),
  status: Status,
  questions: z.array(
    z.object({
      id: text,
      title: z.string(),
      kind: z.enum(["Rating", "Text", "Choice"]),
      required: z.boolean(),
      options: z.array(z.string()).optional(),
    }),
  ),
});
export type GoalTemplate = z.infer<typeof GoalTemplateSchema>;
export type BehaviorTemplate = z.infer<typeof BehaviorTemplateSchema>;
type Indicator = z.infer<typeof IndicatorSchema>;
type Matrix = z.infer<typeof MatrixSchema>;
type Employee = z.infer<typeof EmployeeSchema>;
const StageSchema = z.object({
  type: z.enum(["Self", "Manager", "Peer", "Upward", "HR"]),
  deadline: date,
  reviewerIds: z.array(text).optional(),
  reviewerByEmployee: z.record(z.string(), z.array(text)).optional(),
});
type Stage = z.infer<typeof StageSchema>;
function anonymous(stage: Stage) {
  return stage.type === "Peer" || stage.type === "Upward";
}
function reviewers(stage: Stage, employeeId: string) {
  return stage.reviewerByEmployee?.[employeeId] ?? stage.reviewerIds ?? [];
}
function stageResponses(record: z.infer<typeof RecordSchema>, stage: Stage) {
  return record.responses.filter((r) => r.type === stage.type);
}
function pendingStage(cycle: Cycle, record: z.infer<typeof RecordSchema>) {
  return cycle.stages.find(
    (stage) =>
      stageResponses(record, stage).length < (anonymous(stage) ? reviewers(stage, record.employee.id).length : 1),
  );
}
const ResponseSchema = z.object({
  behaviorTemplate: BehaviorTemplateSchema.optional(),
  type: StageSchema.shape.type,
  answers: z.record(z.string(), z.string()),
  actuals: z.record(z.string(), number),
  feedback: z.string(),
  reviewerId: z.string().optional(),
  submittedAt: text,
});
const ResultSchema = z.object({
  goalScore: score.nullable(),
  behaviorScore: score.nullable(),
  overall: score.nullable(),
});
const RevisionSchema = z.object({ id: text, at: text, by: text, action: text, detail: text });
const RecordSchema = z.object({
  employee: EmployeeSchema,
  goalTemplate: GoalTemplateSchema,
  behaviorTemplate: BehaviorTemplateSchema,
  goalIds: z.record(z.string(), z.string()).default({}),
  drafts: z
    .record(z.string(), z.object({ answers: z.record(z.string(), z.string()), feedback: z.string() }))
    .default({}),
  responses: z.array(ResponseSchema),
  managerComment: z.string().default(""),
  revisions: z.array(RevisionSchema).optional(),
  result: ResultSchema.optional(),
  finalizedAt: z.string().optional(),
  releasedAt: z.string().optional(),
});
const CycleSchema = z.object({
  id: text,
  companyId: z.string().optional(),
  components: z.object({ goals: z.boolean(), behavioral: z.boolean() }).default({ goals: true, behavioral: true }),
  previousStageVisibility: z.enum(["hidden", "responses"]).default("hidden"),
  revisions: z.array(RevisionSchema).optional(),
  legacyReadOnly: z.boolean().optional(),
  name: text,
  periodStart: date,
  periodEnd: date,
  start: date,
  stages: z.array(StageSchema),
  status: z.enum(["Draft", "Scheduled", "Active", "Completed", "Cancelled"]),
  weights: z.object({ goals: number.max(100), behavioral: number.max(100) }).default({ goals: 50, behavioral: 50 }),
  behaviorPolicy: z.enum(["average", "Self", "Manager", "HR"]).default("average"),
  anonymousThreshold: z.number().int().min(2).max(10).default(2),
  records: z.array(RecordSchema),
});
export type Cycle = z.infer<typeof CycleSchema>;
const GoalSchema = z.object({
  id: text,
  companyId: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  source: z.enum(["assigned", "self"]).optional(),
  trackingMode: z.enum(["Manual", "Milestones"]).optional(),
  approvalStatus: z.enum(["Not Required", "Pending", "Approved", "Rejected"]).optional(),
  assignedBy: z.string().optional(),
  createdAt: z.string().optional(),
  employeeId: text,
  templateId: text,
  indicator: IndicatorSchema,
  name: text,
  start: date,
  deadline: date,
  progress: number.max(100),
  actual: number.optional(),
  evidence: z.string(),
  verification: z.enum(["Pending", "Verified", "Returned"]),
  verificationNote: z.string(),
  revisions: z.array(RevisionSchema).optional(),
  milestones: z.array(z.object({ id: text, name: text, deadline: date, done: z.boolean() })),
});
type Goal = z.infer<typeof GoalSchema>;
const ReferralSchema = z.object({
  id: text,
  cycleId: text,
  cycleName: text,
  employeeId: text,
  employeeName: text,
  createdAt: text,
  companyId: z.string().optional(),
  indicators: z.array(
    z.object({ id: text, name: text, target: number, actual: number, direction: z.enum(["Higher", "Lower"]) }),
  ),
});
type Referral = z.infer<typeof ReferralSchema>;
const keys = {
  goals: "pms-react-goals-v1",
  templates: "pms-react-kpi-templates-v1",
  behavior: "pms-react-behavior-templates-v1",
  cycles: "pms-react-cycles-v1",
  referrals: "pms-react-pip-referrals-v1",
  employees: "pms-react-employees-v1",
};
const uid = () => crypto.randomUUID();
const clone = <T,>(value: T): T => structuredClone(value);
function read<T>(key: string, schema: z.ZodType<T>): T | undefined {
  const raw = localStorage.getItem(key);
  if (!raw) return;
  const parsed = schema.safeParse(JSON.parse(raw));
  if (!parsed.success)
    throw new Error(`Saved ${key} data is invalid. Export or repair browser data before continuing.`);
  return parsed.data;
}
function useSaved<T>(key: string, schema: z.ZodType<T>, initial: T) {
  const [state, setState] = useState<{ value: T; error: string }>(() => {
    try {
      return { value: read(key, schema) ?? initial, error: "" };
    } catch (cause) {
      return { value: initial, error: cause instanceof Error ? cause.message : "Unable to load browser data." };
    }
  });
  function save(next: T) {
    if (state.error) throw new Error(state.error);
    const parsed = schema.parse(next);
    localStorage.setItem(key, JSON.stringify(parsed));
    setState({ value: parsed, error: "" });
  }
  return [state.value, save, state.error] as const;
}
function matrixError(matrix: Matrix | undefined) {
  if (!matrix) return "";
  if (matrix.kind === "table")
    return matrix.columns.length &&
      matrix.columns.every((c) => c.trim()) &&
      matrix.rows.length &&
      matrix.rows.every((r) => r.length === matrix.columns.length)
      ? ""
      : "Reference tables need named columns and complete rows.";
  const rows = matrix.rows;
  if (
    !rows.length ||
    rows.some(
      (r, i) =>
        !r.label.trim() ||
        !score.safeParse(r.score).success ||
        (matrix.bound === "maximum" && i === rows.length - 1
          ? r.boundary !== null
          : r.boundary === null ||
            !number.safeParse(r.boundary).success ||
            (i > 0 && r.boundary <= Number(rows[i - 1].boundary))),
    )
  )
    return "Numeric scales need increasing nonnegative boundaries, labels, scores from 1 to 5, and a final unlimited maximum row.";
  if (matrix.bound === "minimum" && rows[0].boundary !== 0) return "Minimum scales need thresholds starting at 0.";
  return "";
}
export function validateGoalTemplate(template: GoalTemplate) {
  if (!template.name.trim() || !template.position.trim()) return "Enter a template name and applicable position.";
  if (!template.indicators.length) return "Add at least one indicator.";
  for (const indicator of template.indicators) {
    if (
      !indicator.name.trim() ||
      !indicator.unit.trim() ||
      !number.safeParse(indicator.target).success ||
      indicator.weight <= 0 ||
      !score.safeParse(indicator.scoreMet).success ||
      !score.safeParse(indicator.scoreBelow).success
    )
      return "Each indicator needs a name, unit, nonnegative target, positive weight, and scores from 1 to 5.";
    const invalid = matrixError(indicator.matrix);
    if (invalid) return invalid;
  }
  return Math.abs(template.indicators.reduce((sum, i) => sum + i.weight, 0) - 100) > 0.001
    ? "Indicator weights must total 100%."
    : "";
}
function validateBehavior(template: BehaviorTemplate) {
  return !template.name.trim()
    ? "Enter a template name."
    : !template.questions.length || template.questions.some((q) => !q.title.trim())
      ? "Add at least one question and name every question."
      : template.questions.some(
            (q) =>
              q.kind === "Choice" &&
              (!q.options ||
                q.options.length < 2 ||
                q.options.some((v) => !v.trim()) ||
                new Set(q.options).size !== q.options.length),
          )
        ? "Choice questions need at least two distinct labeled options."
        : !template.questions.some((q) => q.kind === "Rating")
          ? "Add at least one rating question for the behavioral score."
          : "";
}
export function indicatorScore(indicator: Indicator, actual: number) {
  if (!number.safeParse(actual).success) throw new Error("Actual results must be nonnegative numbers.");
  const matrix = indicator.matrix;
  if (matrix?.kind === "scale" && matrix.scoring) {
    const invalid = matrixError(matrix);
    if (invalid) throw new Error(invalid);
    return (
      matrix.bound === "maximum"
        ? matrix.rows.find((r) => r.boundary === null || actual <= r.boundary)
        : matrix.rows.filter((r) => r.boundary !== null && actual >= r.boundary).at(-1)
    )!.score;
  }
  return (indicator.direction === "Lower" ? actual <= indicator.target : actual >= indicator.target)
    ? indicator.scoreMet
    : indicator.scoreBelow;
}
export function createCycle(
  input: {
    id: string;
    name: string;
    companyId?: string;
    components?: { goals: boolean; behavioral: boolean };
    previousStageVisibility?: "hidden" | "responses";
    periodStart: string;
    periodEnd: string;
    start: string;
    stages: Stage[];
    weights?: { goals: number; behavioral: number };
    behaviorPolicy?: "average" | "Self" | "Manager" | "HR";
    anonymousThreshold?: number;
    behaviorByPosition?: Record<string, BehaviorTemplate>;
  },
  employees: Employee[],
  goals: GoalTemplate[],
  behavior: BehaviorTemplate | undefined,
  assigned: Goal[] = [],
): Cycle {
  const components = input.components ?? { goals: true, behavioral: true };
  if (!components.goals && !components.behavioral) throw new Error("Enable at least one evaluation component.");
  if (
    !input.name.trim() ||
    !date.safeParse(input.periodStart).success ||
    !date.safeParse(input.periodEnd).success ||
    input.periodStart > input.periodEnd ||
    !date.safeParse(input.start).success ||
    !employees.length
  )
    throw new Error("Enter a name, valid evaluation period, operating start date, and participants.");
  if (input.companyId && employees.some((e) => (e.companyId ?? "mayon") !== input.companyId))
    throw new Error("Participants must belong to the active company.");
  if (
    input.stages
      .filter((s) => !anonymous(s))
      .map((s) => s.type)
      .join(",") !== "Self,Manager,HR" ||
    new Set(input.stages.map((s) => s.type)).size !== input.stages.length ||
    input.stages.some(
      (s, i) =>
        !date.safeParse(s.deadline).success ||
        s.deadline < input.start ||
        (i > 0 && s.deadline <= input.stages[i - 1].deadline),
    )
  )
    throw new Error(
      "Keep Self, Manager, and HR in sequence. All stage deadlines must increase after the operating start.",
    );
  const weights =
    components.goals && components.behavioral
      ? (input.weights ?? { goals: 50, behavioral: 50 })
      : components.goals
        ? { goals: 100, behavioral: 0 }
        : { goals: 0, behavioral: 100 };
  if (weights.goals + weights.behavioral !== 100) throw new Error("Component weights must total 100%.");
  for (const stage of input.stages.filter(anonymous))
    for (const employee of employees) {
      const ids = reviewers(stage, employee.id);
      if (!ids.length || new Set(ids).size !== ids.length || ids.includes(employee.id))
        throw new Error("Assign unique peer or upward evaluators for each subject. Subjects cannot review themselves.");
    }
  return clone(
    CycleSchema.parse({
      ...input,
      components,
      weights,
      status: input.start > today() ? "Scheduled" : "Active",
      records: employees.map((employee) => {
        const template = components.goals
          ? goals.find((t) => t.position === employee.title && t.status === "Published")
          : undefined;
        if (components.goals && (!template || validateGoalTemplate(template)))
          throw new Error(`${employee.name} needs a valid published KPI template matching ${employee.title}.`);
        const selectedBehavior = components.behavioral
          ? (input.behaviorByPosition?.[employee.title] ?? behavior)
          : undefined;
        if (
          components.behavioral &&
          (!selectedBehavior || selectedBehavior.status !== "Published" || validateBehavior(selectedBehavior))
        )
          throw new Error("Choose a valid published Behavioral Assessment Template.");
        if (selectedBehavior?.position && selectedBehavior.position !== employee.title)
          throw new Error("The behavioral template does not match every participant position.");
        const goalIds = Object.fromEntries(
          (template?.indicators ?? []).map((indicator) => [
            indicator.id,
            assigned.find(
              (g) =>
                g.employeeId === employee.id &&
                g.templateId === template?.id &&
                g.indicator.id === indicator.id &&
                g.start <= input.periodEnd &&
                g.deadline >= input.periodStart,
            )?.id || "",
          ]),
        );
        return {
          employee,
          goalTemplate: template
            ? {
                ...template,
                indicators: template.indicators.map((indicator) => {
                  const linked = assigned.find((g) => g.id === goalIds[indicator.id]);
                  return linked ? { ...indicator, target: linked.indicator.target } : indicator;
                }),
              }
            : {
                id: `${input.id}:no-goals`,
                name: "Goals Performance not included",
                position: employee.title,
                description: "",
                version: 1,
                status: "Archived",
                indicators: [],
              },
          behaviorTemplate: selectedBehavior ?? {
            id: `${input.id}:no-behavior`,
            name: "Behavioral Performance not included",
            position: "",
            description: "",
            version: 1,
            status: "Archived",
            questions: [],
          },
          goalIds,
          responses: [],
        };
      }),
    }),
  );
}
export function submitAssessment(
  cycle: Cycle,
  employeeId: string,
  type: Stage["type"],
  answers: Record<string, string>,
  actuals: Record<string, number>,
  feedback: string,
  reviewerId?: string,
): Cycle {
  const next = clone(cycle),
    record = next.records.find((r) => r.employee.id === employeeId);
  if (!record || next.status !== "Active" || record.finalizedAt) throw new Error("This assessment is not open.");
  const stage = pendingStage(next, record);
  if (!stage || stage.type !== type) throw new Error("Submit the preceding assessment first.");
  if (today() > stage.deadline)
    throw new Error("The assessment deadline has passed. HR must extend the stage before submission.");
  if (anonymous(stage)) {
    if (!reviewerId || !reviewers(stage, record.employee.id).includes(reviewerId))
      throw new Error("You are not an assigned evaluator.");
    if (stageResponses(record, stage).some((r) => r.reviewerId === reviewerId))
      throw new Error("You already submitted this assessment.");
  }
  for (const question of next.components.behavioral ? record.behaviorTemplate.questions : []) {
    const value = answers[question.id]?.trim();
    if (question.required && !value) throw new Error("Complete every required behavioral question.");
    if (question.kind === "Choice" && value && !question.options?.includes(value))
      throw new Error("Choose one of the configured answer options.");
    if (question.kind === "Rating" && value && value !== "NO" && !score.safeParse(Number(value)).success)
      throw new Error("Ratings must be from 1 to 5 or Not Observed.");
  }
  if (next.components.goals && (type === "Self" || type === "Manager"))
    for (const indicator of record.goalTemplate.indicators)
      if (!number.safeParse(actuals[indicator.id]).success) throw new Error("Enter every nonnegative actual result.");
  delete record.drafts[anonymous(stage) ? `${type}:${reviewerId}` : type];
  record.responses.push(
    ResponseSchema.parse({ type, answers, actuals, feedback, reviewerId, submittedAt: new Date().toISOString() }),
  );
  return next;
}
export function saveAssessmentDraft(
  cycle: Cycle,
  employeeId: string,
  type: Stage["type"],
  answers: Record<string, string>,
  feedback: string,
  reviewerId?: string,
) {
  const next = clone(cycle),
    record = next.records.find((r) => r.employee.id === employeeId);
  if (!record || next.status !== "Active" || record.finalizedAt) throw new Error("This assessment is not open.");
  const stage = pendingStage(next, record);
  if (!stage || stage.type !== type) throw new Error("Submit the preceding assessment first.");
  if (today() > stage.deadline)
    throw new Error("The assessment deadline has passed. HR must extend it before saving a draft.");
  if (
    anonymous(stage) &&
    (!reviewerId ||
      !reviewers(stage, record.employee.id).includes(reviewerId) ||
      stageResponses(record, stage).some((r) => r.reviewerId === reviewerId))
  )
    throw new Error("This reviewer is not eligible.");
  record.drafts[anonymous(stage) ? `${type}:${reviewerId}` : type] = z
    .object({ answers: z.record(z.string(), z.string()), feedback: z.string() })
    .parse({ answers, feedback });
  return next;
}
export function finalizeEvaluation(cycle: Cycle, employeeId: string): Cycle {
  const next = clone(cycle),
    record = next.records.find((r) => r.employee.id === employeeId);
  if (!record || pendingStage(next, record)) throw new Error("Every assessment must be submitted before finalization.");
  if (record.finalizedAt) return next;
  if (next.status !== "Active") throw new Error("Only active cycles can be finalized.");
  let goalScore: number | null = null,
    behaviorScore: number | null = null;
  if (next.components.goals) {
    const verified = record.responses.find((r) => r.type === "Manager");
    if (!verified) throw new Error("Manager verification is required.");
    goalScore = record.goalTemplate.indicators.reduce(
      (sum, i) => sum + (indicatorScore(i, verified.actuals[i.id]) * i.weight) / 100,
      0,
    );
  }
  if (next.components.behavioral) {
    const eligible = record.responses.filter((r) => {
      if (next.behaviorPolicy !== "average") return r.type === next.behaviorPolicy;
      const stage = next.stages.find((s) => s.type === r.type)!;
      return !anonymous(stage) || stageResponses(record, stage).length >= next.anonymousThreshold;
    });
    const ratings = eligible
      .flatMap((r) =>
        (r.behaviorTemplate ?? record.behaviorTemplate).questions
          .filter((q) => q.kind === "Rating")
          .map((q) => r.answers[q.id]),
      )
      .filter((v) => v && v !== "NO")
      .map(Number);
    if (!ratings.length) throw new Error("At least one observed behavioral rating is required.");
    behaviorScore = ratings.reduce((sum, v) => sum + v, 0) / ratings.length;
  }
  record.result = {
    goalScore,
    behaviorScore,
    overall: ((goalScore ?? 0) * next.weights.goals) / 100 + ((behaviorScore ?? 0) * next.weights.behavioral) / 100,
  };
  record.finalizedAt = new Date().toISOString();
  if (next.records.every((r) => r.finalizedAt)) next.status = "Completed";
  return next;
}
export function extendStageDeadline(
  cycle: Cycle,
  type: Stage["type"],
  deadline: string,
  reason: string,
  actorId: string,
): Cycle {
  if (!reason.trim()) throw new Error("Enter an extension reason.");
  if (!["Active", "Scheduled", "Draft"].includes(cycle.status))
    throw new Error("Only open cycles allow deadline extensions.");
  const next = clone(cycle),
    index = next.stages.findIndex((stage) => stage.type === type),
    stage = next.stages[index];
  if (!stage || !date.safeParse(deadline).success || deadline <= stage.deadline || deadline < today())
    throw new Error("Choose a later valid deadline on or after today.");
  const shift = Math.round(
    (Date.parse(deadline + "T12:00:00Z") - Date.parse(stage.deadline + "T12:00:00Z")) / 86400000,
  );
  for (let i = index; i < next.stages.length; i++) {
    const previous = next.stages[i].deadline;
    next.stages[i].deadline = new Date(Date.parse(previous + "T12:00:00Z") + shift * 86400000)
      .toISOString()
      .slice(0, 10);
  }
  next.revisions = [
    ...(next.revisions ?? []),
    revision(
      actorId,
      "Assessment deadline extended",
      `${reason.trim()}. ${type}: ${stage.deadline}. Later stages move ${shift} days to preserve sequence.`,
    ),
  ];
  return next;
}
export function cancelCycle(cycle: Cycle, reason: string, actorId: string): Cycle {
  if (!reason.trim()) throw new Error("Enter a cancellation reason.");
  if (cycle.status === "Completed" || cycle.records.some((r) => r.releasedAt))
    throw new Error("Completed or released cycles cannot be cancelled.");
  return {
    ...clone(cycle),
    status: "Cancelled",
    revisions: [...(cycle.revisions ?? []), revision(actorId, "Cycle cancelled", reason.trim())],
  };
}
export function releaseEvaluation(cycle: Cycle, employeeId: string): { cycle: Cycle; referral?: Referral } {
  const next = clone(cycle),
    record = next.records.find((r) => r.employee.id === employeeId);
  if (!record?.finalizedAt) throw new Error("Finalize the evaluation before releasing results.");
  if (record.releasedAt) return { cycle: next };
  record.releasedAt = new Date().toISOString();
  const actuals = record.responses.find((r) => r.type === "Manager")!.actuals;
  const indicators = record.goalTemplate.indicators
    .filter((i) => (i.direction === "Lower" ? actuals[i.id] > i.target : actuals[i.id] < i.target))
    .map((i) => ({ id: i.id, name: i.name, target: i.target, actual: actuals[i.id], direction: i.direction }));
  return {
    cycle: next,
    ...(indicators.length
      ? {
          referral: {
            id: `${next.id}:${employeeId}`,
            cycleId: next.id,
            cycleName: next.name,
            companyId: next.companyId,
            employeeId,
            employeeName: record.employee.name,
            createdAt: record.releasedAt,
            indicators,
          },
        }
      : {}),
  };
}

function revision(by: string, action: string, detail: string) {
  return RevisionSchema.parse({ id: uid(), at: new Date().toISOString(), by, action, detail });
}
export function reviseGoal(
  goal: Goal,
  input: { target: number; deadline: string; reason: string },
  actorId: string,
): Goal {
  if (!input.reason.trim()) throw new Error("Enter a revision reason.");
  if (!number.safeParse(input.target).success || !date.safeParse(input.deadline).success || input.deadline < goal.start)
    throw new Error("Enter a nonnegative target and valid deadline after the goal start.");
  return {
    ...clone(goal),
    indicator: { ...clone(goal.indicator), target: input.target },
    deadline: input.deadline,
    verification: "Pending",
    verificationNote: "",
    revisions: [
      ...(goal.revisions || []),
      revision(
        actorId,
        "Goal criteria revised",
        `${input.reason.trim()}. Target: ${goal.indicator.target} to ${input.target}. Deadline: ${goal.deadline} to ${input.deadline}.`,
      ),
    ],
  };
}
export function setManagerComment(cycle: Cycle, employeeId: string, actor: Employee, comment: string): Cycle {
  const next = clone(cycle),
    record = next.records.find((r) => r.employee.id === employeeId);
  if (!record || record.employee.manager !== actor.name || record.employee.id === actor.id)
    throw new Error("Only the assigned manager can edit the final comment.");
  if (comment.length > 10000) throw new Error("Manager comment must be at most 10000 characters.");
  record.revisions = [
    ...(record.revisions || []),
    revision(actor.id, "Manager final comment updated", `Previous: ${record.managerComment}. New: ${comment.trim()}`),
  ];
  record.managerComment = comment.trim();
  return next;
}

export function getPerformanceNotifications(
  role: string,
  employeeId: string,
  companyId = "mayon",
): { id: string; subject: string; employeeId: string; status: string }[] {
  z.enum(["HR Administrator", "Manager", "Employee"]).parse(role);
  z.string().parse(employeeId);
  text.parse(companyId);
  const employees = (read(keys.employees, z.array(EmployeeSchema)) ?? []).filter(
      (e) => (e.companyId ?? "mayon") === companyId,
    ),
    actor = employees.find((e) => e.id === employeeId);
  const cycles = (read(keys.cycles, z.array(CycleSchema)) ?? []).filter((c) => (c.companyId ?? "mayon") === companyId);
  return cycles.flatMap((cycle) =>
    cycle.records.flatMap((record) => {
      const stage = pendingStage(cycle, record);
      if (
        !stage ||
        record.finalizedAt ||
        cycle.legacyReadOnly ||
        !["Active", "Scheduled"].includes(cycle.status) ||
        cycle.start > today() ||
        (record.employee.companyId ?? "mayon") !== companyId
      )
        return [];
      const allowed = anonymous(stage)
        ? reviewers(stage, record.employee.id).includes(employeeId) &&
          !stageResponses(record, stage).some((r) => r.reviewerId === employeeId)
        : stage.type === "Self"
          ? record.employee.id === employeeId
          : stage.type === "Manager"
            ? role === "Manager" && actor?.name === record.employee.manager && actor.id !== record.employee.id
            : role === "HR Administrator";
      return allowed
        ? [
            {
              id: `${cycle.id}:${record.employee.id}:${stage.type}:${employeeId}`,
              subject: `${record.employee.name}: ${stage.type} assessment for ${cycle.name}`,
              employeeId: record.employee.id,
              status: stage.deadline < today() ? "Overdue" : "Pending",
            },
          ]
        : [];
    }),
  );
}
const PersonalGoalInput = z.object({
  name: text.max(140),
  description: text.max(10000),
  category: z.enum(["Quality", "Delivery", "Growth", "Collaboration"]),
  start: date,
  deadline: date,
  target: number,
  unit: text,
  direction: z.enum(["Higher", "Lower"]),
  trackingMode: z.enum(["Manual", "Milestones"]),
  requestApproval: z.boolean(),
});
export function createPersonalGoal(input: unknown, owner: Employee): Goal {
  const values = PersonalGoalInput.parse(input);
  EmployeeSchema.parse(owner);
  if (values.deadline < values.start) throw new Error("Goal deadline must be on or after the start date.");
  return GoalSchema.parse({
    id: uid(),
    companyId: owner.companyId ?? "mayon",
    employeeId: owner.id,
    templateId: "personal",
    name: values.name,
    description: values.description,
    category: values.category,
    source: "self",
    assignedBy: owner.name,
    createdAt: new Date().toISOString(),
    trackingMode: values.trackingMode,
    approvalStatus: values.requestApproval ? "Pending" : "Not Required",
    indicator: {
      id: uid(),
      name: values.name,
      unit: values.unit,
      target: values.target,
      weight: 100,
      direction: values.direction,
      scoreMet: 5,
      scoreBelow: 2,
    },
    start: values.start,
    deadline: values.deadline,
    progress: 0,
    evidence: "",
    verification: "Pending",
    verificationNote: "",
    milestones: [],
    revisions: [revision(owner.id, "Personal goal created", values.description)],
  });
}
export function goalProgress(goal: Goal) {
  return goal.trackingMode === "Milestones"
    ? goal.milestones.length
      ? (goal.milestones.filter((m) => m.done).length / goal.milestones.length) * 100
      : 0
    : goal.progress;
}
export function reviewGoalApproval(
  goal: Goal,
  actor: Employee,
  owner: Employee,
  decision: "Approved" | "Rejected",
  reason: string,
): Goal {
  if (
    goal.employeeId !== owner.id ||
    owner.manager !== actor.name ||
    actor.id === owner.id ||
    (owner.companyId ?? "mayon") !== (actor.companyId ?? "mayon")
  )
    throw new Error("Only the reporting manager can approve this goal.");
  if (goal.approvalStatus !== "Pending") throw new Error("This goal is not awaiting approval.");
  if (!reason.trim()) throw new Error("Enter an approval decision reason.");
  return {
    ...clone(goal),
    approvalStatus: decision,
    revisions: [
      ...(goal.revisions ?? []),
      revision(actor.id, `Personal goal ${decision.toLowerCase()}`, reason.trim()),
    ],
  };
}

const LegacyObject = z.record(z.string(), z.unknown());
function legacyObject(value: unknown) {
  return value === undefined || value === null ? {} : LegacyObject.parse(value);
}
function legacyArray(value: unknown) {
  return value === undefined ? [] : z.array(z.unknown()).parse(value);
}
function legacyString(value: unknown, fallback = "") {
  return value === undefined || value === null ? fallback : z.string().parse(value);
}
function legacyNumber(value: unknown, fallback: number) {
  return value === undefined || value === null ? fallback : z.number().finite().parse(value);
}
function legacyId(value: unknown, fallback = "") {
  return value === undefined ? fallback : z.union([z.string(), z.number()]).parse(value).toString();
}
function legacyDate(value: unknown, fallback: string) {
  const valueString = legacyString(value, fallback).slice(0, 10);
  return date.parse(valueString);
}
function legacyMatrix(value: unknown): Matrix | undefined {
  if (!value) return;
  const matrix = legacyObject(value);
  if (matrix.kind === "table") return MatrixSchema.parse({ ...matrix, scoring: false });
  const bound = matrix.bound === "maximum" ? "maximum" : "minimum";
  return MatrixSchema.parse({
    ...matrix,
    bound,
    scoring: matrix.scoring === true,
    rows: legacyArray(matrix.rows).map((value) => {
      const row = legacyObject(value);
      return {
        boundary: row.boundary ?? row[bound] ?? (bound === "maximum" ? null : undefined),
        label: row.label,
        score: row.score,
      };
    }),
  });
}
function legacyIndicator(value: unknown): Indicator {
  const indicator = legacyObject(value);
  return IndicatorSchema.parse({
    ...indicator,
    id: legacyId(indicator.id),
    name: legacyString(indicator.name),
    unit: legacyString(indicator.unit, "Count"),
    target: legacyNumber(indicator.target, 0),
    weight: legacyNumber(indicator.weight, 100),
    direction: indicator.direction === "Lower" ? "Lower" : "Higher",
    scoreMet: legacyNumber(indicator.scoreMet, 5),
    scoreBelow: legacyNumber(indicator.scoreBelow, 2),
    matrix: legacyMatrix(indicator.matrix),
  });
}
function legacyGoalTemplate(value: unknown): GoalTemplate {
  const template = legacyObject(value);
  return GoalTemplateSchema.parse({
    ...template,
    id: legacyId(template.id),
    description: legacyString(template.description),
    position: legacyString(template.position, "All positions"),
    version: legacyNumber(template.version, 1),
    status: template.status ?? "Draft",
    indicators: legacyArray(template.indicators).map(legacyIndicator),
  });
}
function legacyBehavior(value: unknown): BehaviorTemplate {
  const template = legacyObject(value);
  return BehaviorTemplateSchema.parse({
    ...template,
    id: legacyId(template.id),
    description: legacyString(template.description),
    position: legacyString(template.position),
    version: legacyNumber(template.version, 1),
    status: template.status ?? "Draft",
    questions: legacyArray(template.questions).map((value) => {
      const question = legacyObject(value);
      return {
        ...question,
        id: legacyId(question.id),
        kind: question.kind ?? (question.type === "Rating" ? "Rating" : question.type === "Choice" ? "Choice" : "Text"),
        required: question.required !== false,
      };
    }),
  });
}
export function migrateLegacyPerformance(source: unknown, employees: Employee[]) {
  const data = z
    .object({
      goals: z.array(z.unknown()).optional(),
      unifiedReviews: LegacyObject.optional(),
      pmsEmployeeCompanies: z.record(z.string(), z.string()).optional(),
    })
    .passthrough()
    .parse(source);
  const reviews = legacyObject(data.unifiedReviews);
  const templates = legacyArray(reviews.goalTemplates).map(legacyGoalTemplate),
    behaviors = legacyArray(reviews.templates).map(legacyBehavior);
  const rawCycles = legacyArray(reviews.cycles).map(legacyObject),
    assignments = legacyArray(reviews.assignments).map(legacyObject);
  const companyOf = (id: string) =>
    employees.find((e) => e.id === id)?.companyId ?? data.pmsEmployeeCompanies?.[id] ?? "mayon";
  const rawGoals = legacyArray(data.goals).map(legacyObject);
  const goals: Goal[] = rawGoals.map((raw) => {
    const id = legacyId(raw.id),
      employee = employees.find((e) => e.id === raw.ownerId || e.name === raw.employee);
    if (!employee)
      throw new Error(
        `Legacy goal ${id} has an unknown employee. Restore its employee before importing performance records.`,
      );
    const linked = rawCycles
      .flatMap((cycle) =>
        legacyArray(legacyObject(cycle.goalLinks)[employee.id]).map((value) => ({ cycle, link: legacyObject(value) })),
      )
      .find(({ link }) => legacyId(link.goalId) === id);
    const templateId = linked ? legacyString(legacyObject(linked.cycle.goalTemplates)[employee.id]) : "",
      template = templates.find((t) => t.id === templateId),
      criterion = template?.indicators.find((i) => i.id === linked?.link.indicatorId);
    const indicator = linked
      ? legacyIndicator({ ...criterion, ...linked.link, id: linked.link.indicatorId, name: raw.name })
      : {
          id: `legacy-goal-${id}`,
          name: legacyString(raw.name),
          unit: legacyString(raw.unit, "Count"),
          target: legacyNumber(raw.target, 100),
          weight: 100,
          direction: "Higher" as const,
          scoreMet: 5,
          scoreBelow: 2,
        };
    const deadline = legacyDate(raw.due, "2026-12-31"),
      start = legacyDate(raw.startDate, deadline.slice(0, 4) + "-01-01");
    const actuals = legacyObject(raw.evaluationActuals),
      verifications = legacyObject(raw.goalVerifications),
      latest = Object.keys(actuals).at(-1),
      verification = latest ? legacyObject(verifications[latest]) : {};
    const history = legacyArray(raw.updates).map((value, index) =>
      revision("legacy", "Imported accomplishment history", JSON.stringify({ index, record: value })),
    );
    for (const [cycleId, value] of Object.entries(verifications))
      for (const entry of legacyArray(legacyObject(value).history))
        history.push(revision("legacy", `Imported verification for ${cycleId}`, JSON.stringify(entry)));
    return GoalSchema.parse({
      id,
      companyId: companyOf(employee.id),
      employeeId: employee.id,
      templateId: templateId || "personal",
      indicator,
      name: raw.name,
      description: legacyString(raw.description),
      category: legacyString(raw.category, "Growth"),
      source: raw.source === "self" ? "self" : "assigned",
      trackingMode: raw.trackingMode === "milestones" ? "Milestones" : "Manual",
      approvalStatus: raw.status === "Pending Approval" ? "Pending" : "Not Required",
      assignedBy: legacyString(raw.assignedBy, legacyString(raw.createdByName, "Legacy record")),
      createdAt: legacyString(raw.createdAt, start),
      start,
      deadline,
      progress: legacyNumber(raw.progress, 0),
      actual: latest ? number.parse(legacyObject(actuals[latest]).value) : undefined,
      evidence: latest
        ? "Imported actual result. Original accomplishment and verification history remains in the legacy archive."
        : "",
      verification:
        verification.state === "Verified" ? "Verified" : verification.state === "Returned" ? "Returned" : "Pending",
      verificationNote: legacyString(verification.reason),
      revisions: history,
      milestones: legacyArray(raw.milestones).map((value, index) => {
        const milestone = typeof value === "string" ? { title: value } : legacyObject(value);
        return {
          id: `${id}:milestone:${index}`,
          name: legacyString(milestone.title, legacyString(milestone.name)),
          deadline: legacyDate(milestone.deadline, deadline),
          done: milestone.done === true,
        };
      }),
    });
  });
  const cycles: Cycle[] = rawCycles.map((raw) => {
    const id = legacyId(raw.id),
      cycleAssignments = assignments.filter((a) => a.cycle === id),
      participants = z
        .array(z.string())
        .parse(raw.participants ?? Array.from(new Set(cycleAssignments.map((a) => a.subject))));
    const fallbackDeadline = legacyDate(raw.deadline, legacyString(raw.periodEnd, "2026-12-31"));
    const stages: Stage[] = raw.stages
      ? legacyArray(raw.stages).map((value) => {
          const stage = legacyObject(value),
            type = StageSchema.shape.type.parse(stage.type);
          return StageSchema.parse({
            type,
            deadline: legacyDate(stage.deadline, fallbackDeadline),
            reviewerByEmployee: Object.fromEntries(
              participants.map((subject) => [
                subject,
                cycleAssignments
                  .filter((a) => a.type === type && a.subject === subject)
                  .map((a) => legacyId(a.reviewer)),
              ]),
            ),
          });
        })
      : (Array.from(new Set(cycleAssignments.map((a) => a.type))) as Stage["type"][]).map((type) =>
          StageSchema.parse({
            type,
            deadline: fallbackDeadline,
            reviewerByEmployee: Object.fromEntries(
              participants.map((subject) => [
                subject,
                cycleAssignments
                  .filter((a) => a.type === type && a.subject === subject)
                  .map((a) => legacyId(a.reviewer)),
              ]),
            ),
          }),
        );
    const records = participants.map((subject) => {
      const snapshot = legacyObject(legacyObject(raw.resultSnapshots)[subject]),
        historicalEmployee = legacyObject(snapshot.employee),
        employee = employees.find((e) => e.id === subject);
      if (!employee)
        throw new Error(
          `Legacy evaluation ${id} has an unknown employee ${subject}. Restore its employee before importing.`,
        );
      const own = cycleAssignments.filter((a) => a.subject === subject),
        goalSnapshot = legacyObject(raw.goalTemplateSnapshots)[subject],
        goalId = legacyObject(raw.goalTemplates)[subject],
        links = legacyArray(legacyObject(raw.goalLinks)[subject]).map(legacyObject);
      const templateSource =
        goalSnapshot ??
        snapshot.goalTemplate ??
        templates.find((t) => t.id === goalId) ??
        own.find((a) => a.goalsTemplate)?.goalsTemplate;
      const goalTemplate = templateSource
        ? legacyGoalTemplate(templateSource)
        : {
            id: `${id}:${subject}:no-goals`,
            name: "Goals Performance not configured",
            description: "No KPI template exists in this historical evaluation.",
            position: employee.title,
            version: 1,
            status: "Archived" as const,
            indicators: [],
          };
      if (links.length)
        goalTemplate.indicators = goalTemplate.indicators.map((indicator) => {
          const link = links.find((l) => l.indicatorId === indicator.id);
          return link ? legacyIndicator({ ...indicator, ...link, id: indicator.id, name: indicator.name }) : indicator;
        });
      const behaviorSource =
        legacyObject(raw.behaviorByEmployee)[subject] ??
        legacyObject(raw.behaviorSnapshots)[employee.title] ??
        behaviors.find(
          (t) => t.id === (legacyObject(raw.behaviorByPosition)[employee.title] ?? raw.behavioralTemplate),
        ) ??
        own[0]?.template;
      const behaviorTemplate = behaviorSource
        ? legacyBehavior(behaviorSource)
        : {
            id: `${id}:${subject}:no-behavior`,
            name: "Behavioral Performance not configured",
            description: "No behavioral template exists in this historical evaluation.",
            position: employee.title,
            version: 1,
            status: "Archived" as const,
            questions: [],
          };
      const actualsFor = (assignment: Record<string, unknown>) =>
        Object.fromEntries(
          goalTemplate.indicators.flatMap((indicator) => {
            const link = links.find((l) => l.indicatorId === indicator.id),
              goal = rawGoals.find((g) => legacyId(g.id) === legacyId(link?.goalId)),
              fixedGoal = legacyArray(snapshot.goals)
                .map(legacyObject)
                .find((g) => g.indicatorId === indicator.id),
              actual =
                fixedGoal?.actual ??
                legacyObject(legacyObject(goal?.evaluationActuals)[id]).value ??
                legacyObject(assignment.actuals)[indicator.id];
            return actual === undefined || actual === null ? [] : [[indicator.id, number.parse(actual)]];
          }),
        );
      const responses = own
        .filter((a) => ["Submitted", "Completed"].includes(legacyString(a.state)))
        .map((a) =>
          ResponseSchema.parse({
            type: a.type,
            behaviorTemplate: a.template ? legacyBehavior(a.template) : undefined,
            reviewerId: legacyId(a.reviewer),
            answers: a.answers ?? {},
            actuals: actualsFor(a),
            feedback: legacyString(a.feedback),
            submittedAt: legacyString(a.submitted, legacyString(a.finalized, fallbackDeadline)),
          }),
        );
      const drafts = Object.fromEntries(
        own
          .filter((a) => !["Submitted", "Completed"].includes(legacyString(a.state)))
          .map((a) => [
            a.type === "Peer" || a.type === "Upward" ? `${a.type}:${a.reviewer}` : String(a.type),
            { answers: a.answers ?? {}, feedback: legacyString(a.feedback) },
          ]),
      );
      const historicalMean = (assignment: Record<string, unknown>) => {
        const template = assignment.template ? legacyBehavior(assignment.template) : behaviorTemplate,
          answers = legacyObject(assignment.answers),
          ratings = template.questions
            .filter((q) => q.kind === "Rating")
            .map((q) => answers[q.id])
            .filter((value) => value !== undefined && value !== "" && value !== "NO")
            .map((value) => score.parse(Number(value)));
        return ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null;
      };
      const submitted = own.filter(
        (a) => ["Submitted", "Completed"].includes(legacyString(a.state)) && a.type !== "Peer" && a.type !== "Upward",
      );
      const ordered = stages.flatMap((stage) => submitted.filter((a) => a.type === stage.type)),
        lastObserved = [...ordered].reverse().find((a) => historicalMean(a) !== null);
      const fallbackBehavior =
        raw.stages && raw.workflowVersion !== 2
          ? lastObserved
            ? historicalMean(lastObserved)
            : null
          : submitted.length
            ? (() => {
                const means = submitted.map(historicalMean).filter((value): value is number => value !== null);
                return means.length ? means.reduce((sum, value) => sum + value, 0) / means.length : null;
              })()
            : null;
      const verifiedActuals = actualsFor(submitted.find((a) => a.type === "Manager") ?? {}),
        goalRows = goalTemplate.indicators.filter((indicator) => verifiedActuals[indicator.id] !== undefined),
        goalWeight = goalRows.reduce((sum, indicator) => sum + indicator.weight, 0),
        fallbackGoals = goalWeight
          ? goalRows.reduce(
              (sum, indicator) => sum + indicatorScore(indicator, verifiedActuals[indicator.id]) * indicator.weight,
              0,
            ) / goalWeight
          : null;
      const goalScore =
          snapshot.goalScore === undefined
            ? fallbackGoals
            : snapshot.goalScore === null
              ? null
              : score.parse(snapshot.goalScore),
        behaviorScore =
          snapshot.behaviorScore === undefined
            ? fallbackBehavior
            : snapshot.behaviorScore === null
              ? null
              : score.parse(snapshot.behaviorScore),
        weights = legacyObject(snapshot.weights ?? raw.weights);
      const overall =
        snapshot.overall === undefined || snapshot.overall === null
          ? goalScore !== null && behaviorScore !== null
            ? (goalScore * legacyNumber(weights.goals, 50)) / 100 +
              (behaviorScore * legacyNumber(weights.behavioral, 50)) / 100
            : (goalScore ?? behaviorScore)
          : score.parse(snapshot.overall);
      return RecordSchema.parse({
        employee: {
          ...employee,
          ...historicalEmployee,
          title: historicalEmployee.position ?? historicalEmployee.title ?? employee.title,
          companyId: companyOf(subject),
        },
        goalTemplate,
        behaviorTemplate,
        goalIds: Object.fromEntries(links.map((link) => [legacyString(link.indicatorId), legacyId(link.goalId)])),
        responses,
        drafts,
        managerComment: legacyString(legacyObject(raw.finalComments)[subject]),
        result: raw.status === "Completed" || raw.finalized ? { goalScore, behaviorScore, overall } : undefined,
        finalizedAt: raw.finalized
          ? legacyString(raw.finalized)
          : raw.status === "Completed"
            ? legacyString(snapshot.at, fallbackDeadline)
            : undefined,
        releasedAt: raw.released ? legacyString(raw.releasedAt, fallbackDeadline) : undefined,
      });
    });
    const componentSource = legacyObject(raw.components),
      components = {
        goals:
          componentSource.goals === undefined
            ? records.some((r) => r.goalTemplate.indicators.length > 0)
            : componentSource.goals === true,
        behavioral:
          componentSource.behavioral === undefined
            ? records.some((r) => r.behaviorTemplate.questions.length > 0)
            : componentSource.behavioral === true,
      };
    const weights = raw.weights ?? {
      goals: components.goals ? (components.behavioral ? 50 : 100) : 0,
      behavioral: components.behavioral ? (components.goals ? 50 : 100) : 0,
    };
    return CycleSchema.parse({
      id,
      companyId: records[0]?.employee.companyId ?? "mayon",
      name: raw.name,
      periodStart: legacyDate(raw.periodStart, legacyString(raw.start, fallbackDeadline)),
      periodEnd: legacyDate(raw.periodEnd, fallbackDeadline),
      start: legacyDate(raw.start, fallbackDeadline),
      stages,
      status: raw.status,
      weights,
      components,
      behaviorPolicy: legacyObject(raw.scoring).behavioral ?? "average",
      anonymousThreshold: legacyNumber(raw.threshold, 2),
      previousStageVisibility: legacyObject(raw.releasePolicy).previousStages === "responses" ? "responses" : "hidden",
      records,
      legacyReadOnly: raw.workflowVersion !== 2,
      revisions: [],
    });
  });
  for (const template of [...templates, ...behaviors])
    if (!template.companyId) {
      const companies = Array.from(
        new Set(
          employees.filter((e) => !template.position || e.title === template.position).map((e) => companyOf(e.id)),
        ),
      );
      template.companyId = companies.length === 1 ? companies[0] : "mayon";
    }
  const companyCycles = cycles.flatMap((cycle) => {
    const companies = Array.from(new Set(cycle.records.map((record) => record.employee.companyId ?? "mayon")));
    return companies.map((companyId) => ({
      ...cycle,
      id: companies.length > 1 ? `${cycle.id}:${companyId}` : cycle.id,
      companyId,
      records: cycle.records.filter((record) => (record.employee.companyId ?? "mayon") === companyId),
    }));
  });
  return { templates, behaviors, goals, cycles: companyCycles };
}
function importLegacyPerformance() {
  const marker = "pms-react-performance-legacy-import-v1";
  if (localStorage.getItem(marker)) return;
  const source = localStorage.getItem("people-mvp-v1");
  if (!source) return;
  const employees = read(keys.employees, z.array(EmployeeSchema)) ?? [];
  const imported = migrateLegacyPerformance(JSON.parse(source), employees);
  const writes: [string, string][] = [
    [
      keys.templates,
      JSON.stringify([
        ...(read(keys.templates, z.array(GoalTemplateSchema)) ?? []),
        ...imported.templates.filter(
          (t) => !(read(keys.templates, z.array(GoalTemplateSchema)) ?? []).some((current) => current.id === t.id),
        ),
      ]),
    ],
    [
      keys.behavior,
      JSON.stringify([
        ...(read(keys.behavior, z.array(BehaviorTemplateSchema)) ?? []),
        ...imported.behaviors.filter(
          (t) => !(read(keys.behavior, z.array(BehaviorTemplateSchema)) ?? []).some((current) => current.id === t.id),
        ),
      ]),
    ],
    [
      keys.goals,
      JSON.stringify([
        ...(read(keys.goals, z.array(GoalSchema)) ?? []),
        ...imported.goals.filter(
          (t) => !(read(keys.goals, z.array(GoalSchema)) ?? []).some((current) => current.id === t.id),
        ),
      ]),
    ],
    [
      keys.cycles,
      JSON.stringify([
        ...(read(keys.cycles, z.array(CycleSchema)) ?? []),
        ...imported.cycles.filter(
          (t) => !(read(keys.cycles, z.array(CycleSchema)) ?? []).some((current) => current.id === t.id),
        ),
      ]),
    ],
    ["pms-react-performance-legacy-archive-v1", source],
    [marker, new Date().toISOString()],
  ];
  const previous = writes.map(([key]) => [key, localStorage.getItem(key)] as const);
  try {
    for (const [key, value] of writes) localStorage.setItem(key, value);
  } catch (cause) {
    for (const [key, value] of previous)
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    throw cause;
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}
function MatrixEditor({
  matrix,
  onChange,
  direction,
  target,
}: {
  matrix?: Matrix;
  onChange: (matrix: Matrix | undefined) => void;
  direction: string;
  target: number;
}) {
  const setScale = (bound: "minimum" | "maximum") =>
    onChange({
      kind: "scale",
      title: "Numeric threshold scale",
      bound,
      scoring: false,
      rows:
        bound === "maximum"
          ? [
              { boundary: target, label: "Target met", score: 5 },
              { boundary: null, label: "Below target", score: 1 },
            ]
          : target === 0
            ? [{ boundary: 0, label: "Target met", score: 5 }]
            : [
                { boundary: 0, label: "Below target", score: 1 },
                { boundary: target, label: "Target met", score: 5 },
              ],
    });
  return (
    <div className="panel">
      <Field label="Indicator matrix">
        <select
          value={matrix?.kind || "none"}
          onChange={(e) => {
            if (e.target.value === "scale") setScale(direction === "Lower" ? "maximum" : "minimum");
            else
              onChange(
                e.target.value === "table"
                  ? {
                      kind: "table",
                      title: "Reference matrix",
                      scoring: false,
                      columns: ["Criteria", "Guidance"],
                      rows: [["", ""]],
                    }
                  : undefined,
              );
          }}
        >
          <option value="none">No matrix</option>
          <option value="scale">Numeric threshold scale</option>
          <option value="table">Custom reference table</option>
        </select>
      </Field>
      {matrix && (
        <>
          <Field label="Matrix title">
            <input value={matrix.title} onChange={(e) => onChange({ ...matrix, title: e.target.value })} />
          </Field>
          {matrix.kind === "scale" ? (
            <>
              <Field label="Threshold type">
                <select
                  value={matrix.bound}
                  onChange={(e) => setScale(e.target.value === "maximum" ? "maximum" : "minimum")}
                >
                  <option value="minimum">Minimum actual (inclusive)</option>
                  <option value="maximum">Maximum actual (inclusive)</option>
                </select>
              </Field>
              <Field label="Use for scoring">
                <input
                  type="checkbox"
                  checked={matrix.scoring}
                  onChange={(e) => onChange({ ...matrix, scoring: e.target.checked })}
                />
              </Field>
              <p>
                {matrix.scoring
                  ? "Threshold scale replaces target-met scoring."
                  : "Reference only. Target-met scoring applies."}
              </p>
              {matrix.rows.map((row, index) => (
                <div className="formgrid" key={index}>
                  <Field label={`Boundary row ${index + 1}`}>
                    {row.boundary === null ? (
                      <input value="No upper limit" disabled />
                    ) : (
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={row.boundary}
                        onChange={(e) =>
                          onChange({
                            ...matrix,
                            rows: matrix.rows.map((r, i) =>
                              i === index ? { ...r, boundary: e.target.valueAsNumber } : r,
                            ),
                          })
                        }
                      />
                    )}
                  </Field>
                  <Field label={`Rating label row ${index + 1}`}>
                    <input
                      value={row.label}
                      onChange={(e) =>
                        onChange({
                          ...matrix,
                          rows: matrix.rows.map((r, i) => (i === index ? { ...r, label: e.target.value } : r)),
                        })
                      }
                    />
                  </Field>
                  <Field label={`Score row ${index + 1}`}>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      step="any"
                      value={row.score}
                      onChange={(e) =>
                        onChange({
                          ...matrix,
                          rows: matrix.rows.map((r, i) => (i === index ? { ...r, score: e.target.valueAsNumber } : r)),
                        })
                      }
                    />
                  </Field>
                  <Button
                    variant="outline"
                    disabled={row.boundary === null}
                    onClick={() => onChange({ ...matrix, rows: matrix.rows.filter((_, i) => i !== index) })}
                  >
                    Remove scale row {index + 1}
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() => {
                  const rows = [...matrix.rows],
                    row = {
                      boundary:
                        matrix.bound === "maximum"
                          ? Number(rows.at(-2)?.boundary ?? 0) + 1
                          : Number(rows.at(-1)?.boundary ?? 0) + 1,
                      label: "New threshold",
                      score: 3,
                    };
                  rows.splice(matrix.bound === "maximum" ? rows.length - 1 : rows.length, 0, row);
                  onChange({ ...matrix, rows });
                }}
              >
                Add scale row
              </Button>
              {matrixError(matrix) && <p role="status">{matrixError(matrix)}</p>}
              <p>
                Exact target scale score:{" "}
                {!matrixError(matrix)
                  ? indicatorScore(
                      {
                        id: "preview",
                        name: "Preview",
                        unit: "",
                        weight: 100,
                        target,
                        direction: direction === "Lower" ? "Lower" : "Higher",
                        scoreMet: 5,
                        scoreBelow: 2,
                        matrix: { ...matrix, scoring: true },
                      },
                      target,
                    )
                  : "Complete thresholds first"}
              </p>
            </>
          ) : (
            <>
              <p>Reference only. Add and remove your own columns and rows.</p>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      {matrix.columns.map((column, c) => (
                        <th key={c}>
                          <input
                            aria-label={`Column ${c + 1} label`}
                            value={column}
                            onChange={(e) =>
                              onChange({
                                ...matrix,
                                columns: matrix.columns.map((v, i) => (i === c ? e.target.value : v)),
                              })
                            }
                          />
                          <Button
                            variant="outline"
                            onClick={() =>
                              onChange({
                                ...matrix,
                                columns: matrix.columns.filter((_, i) => i !== c),
                                rows: matrix.rows.map((row) => row.filter((_, i) => i !== c)),
                              })
                            }
                          >
                            Remove column {c + 1}
                          </Button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td key={c}>
                            <input
                              aria-label={`Row ${r + 1}, column ${c + 1}`}
                              value={cell}
                              onChange={(e) =>
                                onChange({
                                  ...matrix,
                                  rows: matrix.rows.map((v, i) =>
                                    i === r ? v.map((value, j) => (j === c ? e.target.value : value)) : v,
                                  ),
                                })
                              }
                            />
                          </td>
                        ))}
                        <td>
                          <Button
                            variant="outline"
                            onClick={() => onChange({ ...matrix, rows: matrix.rows.filter((_, i) => i !== r) })}
                          >
                            Remove table row {r + 1}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  onChange({
                    ...matrix,
                    columns: [...matrix.columns, `Column ${matrix.columns.length + 1}`],
                    rows: matrix.rows.map((row) => [...row, ""]),
                  })
                }
              >
                Add column
              </Button>
              <Button
                variant="outline"
                onClick={() => onChange({ ...matrix, rows: [...matrix.rows, matrix.columns.map(() => "")] })}
              >
                Add table row
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
}
function MatrixView({ matrix }: { matrix?: Matrix }) {
  if (!matrix) return null;
  const headers =
    matrix.kind === "table"
      ? matrix.columns
      : [matrix.bound === "minimum" ? "Minimum actual" : "Maximum actual", "Label", "Score"];
  const rows =
    matrix.kind === "table"
      ? matrix.rows
      : matrix.rows.map((r) => [r.boundary === null ? "No upper limit" : String(r.boundary), r.label, String(r.score)]);
  return (
    <details>
      <summary>
        {matrix.title || "Indicator matrix"} ({matrix.scoring ? "Used for scoring" : "Reference only"})
      </summary>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function Performance({
  role,
  employeeId,
  companyId = "mayon",
  initialTab,
}: {
  role: string;
  employeeId?: string;
  companyId?: string;
  initialTab?: string;
}) {
  const hr = role === "HR Administrator",
    manager = role === "Manager";
  const [migrationError] = useState(() => {
    try {
      importLegacyPerformance();
      return "";
    } catch (cause) {
      return cause instanceof Error
        ? `Performance import requires attention: ${cause.message}`
        : "Unable to import legacy performance data. Original records remain unchanged.";
    }
  });
  const [allTemplates, persistTemplates, templateError] = useSaved(keys.templates, z.array(GoalTemplateSchema), []);
  const [allBehaviors, persistBehaviors, behaviorError] = useSaved(keys.behavior, z.array(BehaviorTemplateSchema), []);
  const [allCycles, persistCycles, cycleError] = useSaved(keys.cycles, z.array(CycleSchema), []);
  const [allGoals, persistGoals, goalError] = useSaved(keys.goals, z.array(GoalSchema), []);
  const [allEmployees, , employeeError] = useSaved(keys.employees, z.array(EmployeeSchema), []);
  const templates = allTemplates.filter((value) => (value.companyId ?? "mayon") === companyId);
  function saveTemplates(next: GoalTemplate[]) {
    persistTemplates([
      ...allTemplates.filter((value) => (value.companyId ?? "mayon") !== companyId),
      ...next.map((value) => ({ ...value, companyId })),
    ]);
  }
  const behaviors = allBehaviors.filter((value) => (value.companyId ?? "mayon") === companyId);
  function saveBehaviors(next: BehaviorTemplate[]) {
    persistBehaviors([
      ...allBehaviors.filter((value) => (value.companyId ?? "mayon") !== companyId),
      ...next.map((value) => ({ ...value, companyId })),
    ]);
  }
  const cycles = allCycles.filter((value) => (value.companyId ?? "mayon") === companyId);
  function saveCycles(next: Cycle[]) {
    persistCycles([
      ...allCycles.filter((value) => (value.companyId ?? "mayon") !== companyId),
      ...next.map((value) => ({ ...value, companyId })),
    ]);
  }
  const goals = allGoals.filter((value) => (value.companyId ?? "mayon") === companyId);
  function saveGoals(next: Goal[]) {
    persistGoals([
      ...allGoals.filter((value) => (value.companyId ?? "mayon") !== companyId),
      ...next.map((value) => ({ ...value, companyId })),
    ]);
  }
  const employees = allEmployees.filter((value) => (value.companyId ?? "mayon") === companyId);
  const [tab, setTab] = useState(initialTab ?? (hr ? "KPI Goal Templates" : "My assessments"));
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All");
  const [goalEditor, setGoalEditor] = useState<GoalTemplate | null>(null),
    [behaviorEditor, setBehaviorEditor] = useState<BehaviorTemplate | null>(null);
  const [cycleComponents, setCycleComponents] = useState({ goals: true, behavioral: true });
  const [personalGoalOpen, setPersonalGoalOpen] = useState(false);
  const [cycleAction, setCycleAction] = useState<{ cycleId: string; kind: "extend" | "cancel" } | null>(null);
  const [editingCycle, setEditingCycle] = useState<Cycle | null>(null);
  const [optionalStages, setOptionalStages] = useState<("Peer" | "Upward")[]>([]);
  const [cycleOpen, setCycleOpen] = useState(false),
    [goalOpen, setGoalOpen] = useState(false),
    [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [assessment, setAssessment] = useState<{ cycleId: string; employeeId: string } | null>(null),
    [result, setResult] = useState<{ cycleId: string; employeeId: string } | null>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const identity = employees.find((e) => e.id === employeeId);
  const scoped = employees.filter((e) => hr || (manager && e.manager === identity?.name) || e.id === employeeId);
  const canReview = (cycle: Cycle, record: z.infer<typeof RecordSchema>) => {
    const stage = pendingStage(cycle, record);
    return (
      !!stage &&
      (anonymous(stage)
        ? !!employeeId &&
          !!reviewers(stage, record.employee.id).includes(employeeId) &&
          !stageResponses(record, stage).some((r) => r.reviewerId === employeeId)
        : stage.type === "Self"
          ? record.employee.id === employeeId
          : stage.type === "Manager"
            ? manager && mayManage(record.employee.id)
            : hr)
    );
  };
  const ownGoal = (goal: Goal) => goal.employeeId === employeeId;
  const mayManage = (id: string) =>
    hr || (manager && employees.some((e) => e.id === id && e.manager === identity?.name));
  const currentCycle = assessment && cycles.find((c) => c.id === assessment.cycleId),
    currentRecord = currentCycle?.records.find((r) => r.employee.id === assessment?.employeeId);
  const assessmentStage = currentCycle && currentRecord ? pendingStage(currentCycle, currentRecord) : undefined;
  const assessmentDraft =
    currentRecord && assessmentStage
      ? currentRecord.drafts[
          anonymous(assessmentStage) ? `${assessmentStage.type}:${employeeId}` : assessmentStage.type
        ]
      : undefined;
  const resultCycle = result && cycles.find((c) => c.id === result.cycleId),
    resultRecord = resultCycle?.records.find((r) => r.employee.id === result?.employeeId);
  const selectedGoals = goals.filter((g) => scoped.some((e) => e.id === g.employeeId));
  const dataError = [migrationError, templateError, behaviorError, cycleError, goalError, employeeError].find(Boolean);
  const guard = (action: () => void) => {
    setError("");
    setNotice("");
    try {
      if (dataError) throw new Error(dataError);
      action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save. Check available browser storage.");
    }
  };
  const changeTab = (value: string) => {
    setTab(value);
    setQuery("");
    setFilter("All");
    setError("");
  };
  const freshGoal = (): GoalTemplate => ({
    id: uid(),
    name: "",
    description: "",
    position: "",
    status: "Draft",
    version: 1,
    indicators: [],
  });
  const freshBehavior = (): BehaviorTemplate => ({
    id: uid(),
    name: "",
    description: "",
    position: "",
    status: "Draft",
    version: 1,
    questions: [],
  });
  function saveTemplate(status: "Draft" | "Published") {
    if (!hr || !goalEditor) return;
    guard(() => {
      const draft = { ...goalEditor, status };
      if (status === "Published") {
        const invalid = validateGoalTemplate(draft);
        if (invalid) throw new Error(invalid);
      }
      const parsed = GoalTemplateSchema.parse(draft);
      saveTemplates([...templates.filter((t) => t.id !== parsed.id), parsed]);
      setGoalEditor(null);
      setNotice(`KPI template ${status.toLowerCase()}.`);
    });
  }
  function saveBehavior(status: "Draft" | "Published") {
    if (!hr || !behaviorEditor) return;
    guard(() => {
      const draft = { ...behaviorEditor, status };
      if (status === "Published") {
        const invalid = validateBehavior(draft);
        if (invalid) throw new Error(invalid);
      }
      const parsed = BehaviorTemplateSchema.parse(draft);
      saveBehaviors([...behaviors.filter((t) => t.id !== parsed.id), parsed]);
      setBehaviorEditor(null);
      setNotice(`Behavioral template ${status.toLowerCase()}.`);
    });
  }
  function assignGoals(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hr) return;
    const form = new FormData(event.currentTarget);
    guard(() => {
      const employee = employees.find((e) => e.id === form.get("employee")),
        template = templates.find((t) => t.id === form.get("template") && t.status === "Published"),
        start = String(form.get("start")),
        deadline = String(form.get("deadline"));
      if (!employee || !template || template.position !== employee.title)
        throw new Error("Choose a published template matching the employee position.");
      if (!start || !deadline || start > deadline) throw new Error("Enter valid goal dates.");
      const assigned = template.indicators.map((indicator) => ({
        id: uid(),
        employeeId: employee.id,
        templateId: template.id,
        indicator: clone(indicator),
        name: indicator.name,
        description: template.description,
        category: "Delivery",
        source: "assigned" as const,
        assignedBy: identity?.name || "HR Administrator",
        createdAt: new Date().toISOString(),
        trackingMode: "Manual" as const,
        approvalStatus: "Not Required" as const,
        start,
        deadline,
        progress: 0,
        evidence: "",
        verification: "Pending" as const,
        verificationNote: "",
        milestones: [],
      }));
      saveGoals([...goals, ...assigned]);
      setGoalOpen(false);
      setNotice(`${assigned.length} goals assigned to ${employee.name}.`);
    });
  }
  function startCycle(event: FormEvent<HTMLFormElement>, draft: boolean) {
    event.preventDefault();
    if (!hr) return;
    const form = new FormData(event.currentTarget);
    guard(() => {
      const behavior = behaviors.find((t) => t.id === form.get("behavior"));
      if (cycleComponents.behavioral && !behavior)
        throw new Error("Choose a published Behavioral Assessment Template.");
      const participants = employees.filter((e) => form.getAll("participants").includes(e.id));
      const selected = Array.from(new Set(participants.map((e) => e.title)))
        .map((position) => templates.find((t) => t.id === form.get(`template-${position}`)))
        .filter((t): t is GoalTemplate => !!t);
      const cycle = createCycle(
        {
          id: editingCycle?.id ?? uid(),
          companyId,
          components: cycleComponents,
          previousStageVisibility: form.get("previousStageVisibility") === "responses" ? "responses" : "hidden",
          name: String(form.get("name")),
          periodStart: String(form.get("periodStart")),
          periodEnd: String(form.get("periodEnd")),
          start: String(form.get("start")),
          weights: { goals: Number(form.get("goalWeight")), behavioral: Number(form.get("behaviorWeight")) },
          behaviorPolicy: String(form.get("behaviorPolicy")) as Cycle["behaviorPolicy"],
          anonymousThreshold: Number(form.get("anonymousThreshold")),
          behaviorByPosition: Object.fromEntries(
            Array.from(new Set(participants.map((e) => e.title)))
              .map((position) => [position, behaviors.find((t) => t.id === form.get(`behavior-${position}`))])
              .filter((entry): entry is [string, BehaviorTemplate] => !!entry[1]),
          ),
          stages: [
            { type: "Self", deadline: String(form.get("selfDeadline")) },
            { type: "Manager", deadline: String(form.get("managerDeadline")) },
            ...optionalStages.map((type) => ({
              type,
              deadline: String(form.get(`${type}Deadline`)),
              reviewerByEmployee: Object.fromEntries(
                participants.map((employee) => [
                  employee.id,
                  form.getAll(`${type}Reviewers-${employee.id}`).map(String),
                ]),
              ),
            })),
            { type: "HR", deadline: String(form.get("hrDeadline")) },
          ],
        },
        participants,
        selected,
        behavior,
        goals,
      );
      if (cycle.records.some((r) => Object.values(r.goalIds).some((id) => !id)))
        throw new Error(
          "Assign every selected template indicator as an employee goal within the evaluation period before creating the cycle.",
        );
      if (participants.some((e) => !employees.some((m) => m.name === e.manager && m.id !== e.id)))
        throw new Error("Every participant needs a valid reporting manager in the employee directory.");
      if (draft) cycle.status = "Draft";
      if (editingCycle && cycles.find((c) => c.id === editingCycle.id)?.status !== "Draft")
        throw new Error("Only draft cycles can be edited.");
      saveCycles([...cycles.filter((c) => c.id !== cycle.id), cycle]);
      setCycleOpen(false);
      setEditingCycle(null);
      setNotice(draft ? "Review cycle saved as draft." : "Review cycle launched with immutable template snapshots.");
    });
  }
  function saveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeGoal) return;
    const form = new FormData(event.currentTarget);
    guard(() => {
      const canEdit = ownGoal(activeGoal) || mayManage(activeGoal.employeeId);
      if (!canEdit) throw new Error("This goal is outside your scope.");
      if (cycles.some((c) => c.records.some((r) => r.finalizedAt && Object.values(r.goalIds).includes(activeGoal.id))))
        throw new Error("This goal belongs to a finalized evaluation and is locked.");
      const actual = String(form.get("actual"));
      const progress =
        activeGoal.trackingMode === "Milestones" ? goalProgress(activeGoal) : Number(form.get("progress"));
      const next = {
        ...activeGoal,
        revisions: [
          ...(activeGoal.revisions || []),
          revision(
            employeeId || "HR",
            "Accomplishment updated",
            `Progress: ${activeGoal.progress} to ${progress}. Actual: ${activeGoal.actual ?? "Not recorded"} to ${actual || "Not recorded"}. Previous evidence: ${activeGoal.evidence}`,
          ),
        ],
        progress,
        actual: actual === "" ? undefined : Number(actual),
        evidence: String(form.get("evidence")),
        verification: "Pending" as const,
        verificationNote: "",
      };
      if (
        (next.actual !== undefined && !number.safeParse(next.actual).success) ||
        !number.max(100).safeParse(progress).success
      )
        throw new Error("Progress must be from 0 to 100 and actual must be nonnegative.");
      if (!next.evidence.trim() && next.actual !== undefined)
        throw new Error("Add accomplishment evidence for the actual result.");
      saveGoals(goals.map((g) => (g.id === next.id ? next : g)));
      setActiveGoal(null);
      setNotice("Accomplishment saved. Manager verification is pending.");
    });
  }
  function verifyGoal(state: "Verified" | "Returned") {
    if (!activeGoal || !mayManage(activeGoal.employeeId) || (hr && !manager)) return;
    guard(() => {
      if (activeGoal.employeeId === employeeId) throw new Error("You cannot verify your own goal.");
      if (activeGoal.actual === undefined || !activeGoal.evidence.trim())
        throw new Error("Employee actual and accomplishment evidence are required.");
      if (!activeGoal.verificationNote.trim()) throw new Error("Enter a manager verification note.");
      saveGoals(
        goals.map((g) =>
          g.id === activeGoal.id
            ? {
                ...activeGoal,
                verification: state,
                revisions: [
                  ...(activeGoal.revisions || []),
                  revision(employeeId || "manager", `Goal ${state.toLowerCase()}`, activeGoal.verificationNote),
                ],
              }
            : g,
        ),
      );
      setActiveGoal(null);
      setNotice(`Goal ${state.toLowerCase()}.`);
    });
  }
  function sendAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentCycle || !currentRecord) return;
    const form = new FormData(event.currentTarget);
    guard(() => {
      const activeStage = pendingStage(currentCycle, currentRecord);
      const type = activeStage?.type;
      if (!type) throw new Error("All stages are submitted.");
      if (!canReview(currentCycle, currentRecord)) throw new Error("This stage belongs to another evaluator.");
      const answers = Object.fromEntries(
        currentRecord.behaviorTemplate.questions.map((q) => [q.id, String(form.get(q.id) || "")]),
      );
      const linked = currentRecord.goalTemplate.indicators.map((i) =>
        goals.find((g) => g.id === currentRecord.goalIds[i.id]),
      );
      if (
        currentCycle.components.goals &&
        (type === "Self" || type === "Manager") &&
        linked.some((g) => !g || g.actual === undefined || !g.evidence.trim())
      )
        throw new Error("Record actual results and accomplishment evidence on every assigned goal first.");
      if (currentCycle.components.goals && type === "Manager" && linked.some((g) => g?.verification !== "Verified"))
        throw new Error("Manager must verify every goal before submitting the assessment.");
      const actuals = Object.fromEntries(
        currentRecord.goalTemplate.indicators.map((i, index) => [i.id, linked[index]?.actual ?? 0]),
      );
      const next = submitAssessment(
        currentCycle,
        currentRecord.employee.id,
        type,
        answers,
        actuals,
        String(form.get("feedback") || ""),
        employeeId,
      );
      saveCycles(cycles.map((c) => (c.id === next.id ? next : c)));
      setAssessment(null);
      setNotice(`${type} assessment submitted. The next stage is now available.`);
    });
  }
  function finalize(cycle: Cycle, id: string) {
    if (!hr) return;
    guard(() => {
      const record = cycle.records.find((r) => r.employee.id === id)!;
      if (
        record.goalTemplate.indicators.some((i) => {
          const goal = goals.find((g) => g.id === record.goalIds[i.id]);
          return (
            !goal ||
            goal.verification !== "Verified" ||
            goal.actual !== record.responses.find((r) => r.type === "Manager")?.actuals[i.id]
          );
        })
      )
        throw new Error(
          "Manager verification changed. Reopen the assessments and verify current goals before finalization.",
        );
      const next = finalizeEvaluation(cycle, id);
      saveCycles(cycles.map((c) => (c.id === next.id ? next : c)));
      setNotice("Evaluation finalized. Results remain unreleased.");
    });
  }
  function release(cycle: Cycle, id: string) {
    if (!hr) return;
    guard(() => {
      const released = releaseEvaluation(cycle, id),
        previous = localStorage.getItem(keys.referrals);
      if (released.referral) {
        const referrals = read(keys.referrals, z.array(ReferralSchema)) ?? [];
        if (!referrals.some((r) => r.id === released.referral!.id))
          localStorage.setItem(keys.referrals, JSON.stringify([...referrals, released.referral]));
      }
      try {
        saveCycles(cycles.map((c) => (c.id === cycle.id ? released.cycle : c)));
      } catch (cause) {
        if (previous === null) localStorage.removeItem(keys.referrals);
        else localStorage.setItem(keys.referrals, previous);
        throw cause;
      }
      if (released.referral) window.dispatchEvent(new CustomEvent("pms-pip-referral", { detail: released.referral }));
      setNotice(
        released.referral ? "Results released. Below-target indicators referred for PIP review." : "Results released.",
      );
    });
  }
  function draftAssessment(form: HTMLFormElement) {
    if (!currentCycle || !currentRecord || !assessmentStage) return;
    guard(() => {
      if (!canReview(currentCycle, currentRecord)) throw new Error("This stage belongs to another evaluator.");
      const values = new FormData(form),
        answers = Object.fromEntries(
          currentRecord.behaviorTemplate.questions.map((q) => [q.id, String(values.get(q.id) || "")]),
        );
      const next = saveAssessmentDraft(
        currentCycle,
        currentRecord.employee.id,
        assessmentStage.type,
        answers,
        String(values.get("feedback") || ""),
        employeeId,
      );
      saveCycles(cycles.map((c) => (c.id === next.id ? next : c)));
      setAssessment(null);
      setNotice("Assessment draft saved. The stage remains open.");
    });
  }
  useEffect(() => {
    const activate = () => {
      if (cycles.some((c) => c.status === "Scheduled" && c.start <= today())) {
        try {
          saveCycles(
            cycles.map((c) => (c.status === "Scheduled" && c.start <= today() ? { ...c, status: "Active" } : c)),
          );
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Unable to start scheduled cycles.");
        }
      }
    };
    activate();
    window.addEventListener("pms-workflow-clock-changed", activate);
    const timer = window.setInterval(activate, 60000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pms-workflow-clock-changed", activate);
    };
  }, [cycles]);
  useEffect(() => {
    setTab(initialTab ?? (hr ? "KPI Goal Templates" : "My assessments"));
    setGoalEditor(null);
    setBehaviorEditor(null);
    setAssessment(null);
    setActiveGoal(null);
    setResult(null);
    setCycleOpen(false);
    setGoalOpen(false);
    setError("");
  }, [role, employeeId, companyId]);
  const search = (...values: string[]) => values.join(" ").toLowerCase().includes(query.toLowerCase());
  const visibleRecords = cycles.flatMap((cycle) =>
    cycle.records
      .filter((record) => scoped.some((e) => e.id === record.employee.id) || canReview(cycle, record))
      .map((record) => ({ cycle, record })),
  );
  const tabs = hr
    ? [
        "KPI Goal Templates",
        "Behavioral Assessment Templates",
        "Goals & milestones",
        "Review cycles",
        "Evaluations & results",
      ]
    : ["My assessments", "Goals & milestones", "Evaluations & results"];
  const editorReadonly = goalEditor?.status !== "Draft",
    behaviorReadonly = behaviorEditor?.status !== "Draft";
  const topError = error || dataError;
  return (
    <section className="performance-workspace">
      <nav className="performance-tabs" aria-label="Performance navigation">
        {tabs.map((name) => (
          <Button
            key={name}
            variant={tab === name ? "default" : "outline"}
            aria-current={tab === name ? "page" : undefined}
            onClick={() => changeTab(name)}
          >
            {name}
          </Button>
        ))}
      </nav>
      <div className="heading">
        <div>
          <h1>{tab}</h1>
          <p>
            {tab.includes("Template")
              ? "Versioned assessment standards and scoring guidance."
              : tab === "Goals & milestones"
                ? "Assigned goals, accomplishments, and manager verification."
                : "Sequential assessments with explicit HR finalization and release."}
          </p>
        </div>
        {hr && tab === "KPI Goal Templates" && (
          <Button
            onClick={() => {
              setError("");
              setGoalEditor(freshGoal());
            }}
          >
            Create KPI Goal Template
          </Button>
        )}
        {hr && tab === "Behavioral Assessment Templates" && (
          <Button
            onClick={() => {
              setError("");
              setBehaviorEditor(freshBehavior());
            }}
          >
            Create Behavioral Assessment Template
          </Button>
        )}
        {hr && tab === "Review cycles" && (
          <Button
            onClick={() => {
              setError("");
              setEditingCycle(null);
              setCycleComponents({ goals: true, behavioral: true });
              setOptionalStages([]);
              setCycleOpen(true);
            }}
          >
            Create review cycle
          </Button>
        )}
        {role === "Employee" && identity && tab === "Goals & milestones" && (
          <Button
            onClick={() => {
              setPersonalGoalOpen(true);
              setError("");
            }}
          >
            Create personal goal
          </Button>
        )}
        {hr && tab === "Goals & milestones" && (
          <Button
            onClick={() => {
              setError("");
              setGoalOpen(true);
            }}
          >
            Assign goals
          </Button>
        )}
      </div>
      {topError && (
        <p role="alert" className="form-error">
          {topError}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {hr && localStorage.getItem("pms-react-performance-legacy-archive-v1") && (
        <details>
          <summary>Legacy performance archive</summary>
          <p>
            The original browser record is retained without changes. Historical evaluations without connected templates
            remain read-only.
          </p>
        </details>
      )}
      <div className="toolbar">
        <input
          type="search"
          aria-label={`Search ${tab}`}
          placeholder="Search name, position, or employee"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {tab.includes("Template") && (
          <Field label="Template status">
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              {["All", "Draft", "Published", "Archived"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        )}
      </div>
      {tab === "KPI Goal Templates" && hr && (
        <section className="panel">
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Template name</th>
                  <th>Applicable position</th>
                  <th>Indicators</th>
                  <th>Status</th>
                  <th>Version</th>
                </tr>
              </thead>
              <tbody>
                {templates
                  .filter((t) => search(t.name, t.position) && (filter === "All" || t.status === filter))
                  .map((t) => (
                    <tr key={t.id}>
                      <td>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setError("");
                            setGoalEditor(clone(t));
                          }}
                        >
                          {t.name}
                        </Button>
                      </td>
                      <td>{t.position}</td>
                      <td>{t.indicators.length}</td>
                      <td>{t.status}</td>
                      <td>{t.version}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!templates.length && <p>No KPI Goal Templates. Create a position-specific template to begin.</p>}
          </div>
        </section>
      )}
      {tab === "Behavioral Assessment Templates" && hr && (
        <section className="panel">
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Template name</th>
                  <th>Applicable position</th>
                  <th>Questions</th>
                  <th>Status</th>
                  <th>Version</th>
                </tr>
              </thead>
              <tbody>
                {behaviors
                  .filter((t) => search(t.name, t.position) && (filter === "All" || t.status === filter))
                  .map((t) => (
                    <tr key={t.id}>
                      <td>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setError("");
                            setBehaviorEditor(clone(t));
                          }}
                        >
                          {t.name}
                        </Button>
                      </td>
                      <td>{t.position || "All positions"}</td>
                      <td>{t.questions.length}</td>
                      <td>{t.status}</td>
                      <td>{t.version}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!behaviors.length && (
              <p>No Behavioral Assessment Templates. Create rating and narrative questions to begin.</p>
            )}
          </div>
        </section>
      )}
      {tab === "Goals & milestones" && (
        <section className="panel">
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Goal / employee</th>
                  <th>Target</th>
                  <th>Progress</th>
                  <th>Actual result</th>
                  <th>Verification</th>
                  <th>Deadline</th>
                </tr>
              </thead>
              <tbody>
                {selectedGoals
                  .filter((g) => search(g.name, employees.find((e) => e.id === g.employeeId)?.name || ""))
                  .map((g) => (
                    <tr key={g.id}>
                      <td>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setError("");
                            setActiveGoal(clone(g));
                          }}
                        >
                          {g.name}
                        </Button>
                        <small>{employees.find((e) => e.id === g.employeeId)?.name}</small>
                      </td>
                      <td>
                        {g.indicator.direction === "Lower" ? "At most" : "At least"} {g.indicator.target}{" "}
                        {g.indicator.unit}
                      </td>
                      <td>{goalProgress(g).toFixed(0)}%</td>
                      <td>{g.actual ?? "Not recorded"}</td>
                      <td>
                        {g.verification}
                        <small>
                          {g.approvalStatus === "Pending"
                            ? "Awaiting goal approval"
                            : g.approvalStatus === "Rejected"
                              ? "Goal rejected"
                              : ""}
                        </small>
                      </td>
                      <td>{g.deadline}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!selectedGoals.length && <p>No assigned goals in your scope.</p>}
          </div>
        </section>
      )}
      {tab === "Review cycles" && hr && (
        <section className="panel">
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Review cycle</th>
                  <th>Evaluation period</th>
                  <th>Participants</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {cycles
                  .filter((c) => search(c.name))
                  .map((c) => (
                    <tr key={c.id}>
                      <td>
                        {c.name}
                        <small>Self → Manager → HR</small>
                      </td>
                      <td>
                        {c.periodStart} to {c.periodEnd}
                      </td>
                      <td>{c.records.length}</td>
                      <td>{c.status}</td>
                      <td>
                        {c.status === "Draft" && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditingCycle(clone(c));
                              setCycleComponents(c.components);
                              setOptionalStages(c.stages.filter(anonymous).map((s) => s.type as "Peer" | "Upward"));
                              setCycleOpen(true);
                            }}
                          >
                            Edit cycle draft
                          </Button>
                        )}
                        {c.status === "Draft" && (
                          <Button
                            variant="outline"
                            onClick={() =>
                              guard(() => {
                                saveCycles(
                                  cycles.map((item) =>
                                    item.id === c.id
                                      ? { ...item, status: item.start > today() ? "Scheduled" : "Active" }
                                      : item,
                                  ),
                                );
                                setNotice("Cycle launched.");
                              })
                            }
                          >
                            Launch cycle
                          </Button>
                        )}
                        {["Draft", "Active", "Scheduled"].includes(c.status) && (
                          <>
                            <Button variant="outline" onClick={() => setCycleAction({ cycleId: c.id, kind: "extend" })}>
                              Extend stage deadline
                            </Button>
                            <Button variant="outline" onClick={() => setCycleAction({ cycleId: c.id, kind: "cancel" })}>
                              Cancel cycle
                            </Button>
                          </>
                        )}
                        <Button variant="outline" onClick={() => changeTab("Evaluations & results")}>
                          View evaluations
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!cycles.length && <p>No review cycles. Publish templates and assign employee goals first.</p>}
          </div>
        </section>
      )}
      {(tab === "My assessments" || tab === "Evaluations & results") && (
        <section className="panel">
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Employee / cycle</th>
                  <th>Assessment progress</th>
                  <th>Evaluation</th>
                  <th>Results</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords
                  .filter(({ cycle, record }) => search(cycle.name, record.employee.name))
                  .map(({ cycle, record }) => {
                    const stage = pendingStage(cycle, record),
                      canAssess =
                        cycle.status === "Active" &&
                        !cycle.legacyReadOnly &&
                        !record.finalizedAt &&
                        canReview(cycle, record),
                      canRead = hr || !!record.releasedAt;
                    return (
                      <tr key={`${cycle.id}:${record.employee.id}`}>
                        <td>
                          {record.employee.name}
                          <small>{cycle.name}</small>
                        </td>
                        <td>
                          {record.responses.length} responses submitted
                          <small>{stage ? `${stage.type} due ${stage.deadline}` : "All assessments submitted"}</small>
                        </td>
                        <td>
                          {record.finalizedAt ? "Finalized" : cycle.status === "Draft" ? "Draft cycle" : "In progress"}
                        </td>
                        <td>{record.releasedAt ? "Released" : "Not released"}</td>
                        <td>
                          {canAssess && (
                            <Button
                              onClick={() => {
                                setError("");
                                setAssessment({ cycleId: cycle.id, employeeId: record.employee.id });
                              }}
                            >
                              Open {stage?.type} assessment
                            </Button>
                          )}
                          {hr && !record.finalizedAt && !pendingStage(cycle, record) && (
                            <Button onClick={() => finalize(cycle, record.employee.id)}>Finalize evaluation</Button>
                          )}
                          {hr && record.finalizedAt && !record.releasedAt && (
                            <Button onClick={() => release(cycle, record.employee.id)}>Release results</Button>
                          )}
                          {canRead && (
                            <Button
                              variant="outline"
                              onClick={() => setResult({ cycleId: cycle.id, employeeId: record.employee.id })}
                            >
                              View evaluation
                            </Button>
                          )}
                          {hr && record.responses.length > 0 && !record.finalizedAt && (
                            <Button
                              variant="outline"
                              onClick={() =>
                                guard(() => {
                                  const next = clone(cycle);
                                  next.records.find((r) => r.employee.id === record.employee.id)!.responses = [];
                                  saveCycles(cycles.map((c) => (c.id === next.id ? next : c)));
                                  setNotice("Assessments reopened. All stages must be resubmitted.");
                                })
                              }
                            >
                              Reopen assessments
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            {!visibleRecords.length && <p>No evaluations in your scope.</p>}
          </div>
        </section>
      )}
      <Dialog
        open={!!goalEditor}
        onOpenChange={(open) => {
          if (!open) setGoalEditor(null);
        }}
        title={editorReadonly ? "KPI Goal Template details" : "KPI Goal Template builder"}
      >
        {goalEditor && (
          <>
            <p>
              Version {goalEditor.version} · {goalEditor.status}. Published versions remain unchanged in existing
              cycles.
            </p>
            <Field label="Template name">
              <input
                maxLength={120}
                value={goalEditor.name}
                disabled={editorReadonly}
                onChange={(e) => setGoalEditor({ ...goalEditor, name: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <textarea
                value={goalEditor.description}
                disabled={editorReadonly}
                onChange={(e) => setGoalEditor({ ...goalEditor, description: e.target.value })}
              />
            </Field>
            <Field label="Applicable position">
              <input
                value={goalEditor.position}
                disabled={editorReadonly}
                onChange={(e) => setGoalEditor({ ...goalEditor, position: e.target.value })}
              />
            </Field>
            {goalEditor.indicators.map((indicator, index) => (
              <fieldset key={indicator.id} disabled={editorReadonly}>
                <legend>Indicator {index + 1}</legend>
                {[
                  ["name", "Indicator name"],
                  ["unit", "Measurement unit"],
                  ["target", "Target value"],
                  ["weight", "Weight (%)"],
                  ["scoreMet", "Score when target met"],
                  ["scoreBelow", "Score below target"],
                ].map(([key, label]) => (
                  <Field key={key} label={`${label} ${index + 1}`}>
                    <input
                      type={["name", "unit"].includes(key) ? "text" : "number"}
                      step="any"
                      value={String(indicator[key as keyof Indicator] ?? "")}
                      onChange={(e) =>
                        setGoalEditor({
                          ...goalEditor,
                          indicators: goalEditor.indicators.map((item, i) =>
                            i === index
                              ? {
                                  ...item,
                                  [key]: ["name", "unit"].includes(key) ? e.target.value : e.target.valueAsNumber,
                                }
                              : item,
                          ),
                        })
                      }
                    />
                  </Field>
                ))}
                <Field label={`Achievement direction ${index + 1}`}>
                  <select
                    value={indicator.direction}
                    onChange={(e) =>
                      setGoalEditor({
                        ...goalEditor,
                        indicators: goalEditor.indicators.map((item, i) =>
                          i === index ? { ...item, direction: e.target.value === "Lower" ? "Lower" : "Higher" } : item,
                        ),
                      })
                    }
                  >
                    <option>Higher</option>
                    <option>Lower</option>
                  </select>
                </Field>
                {editorReadonly ? (
                  <MatrixView matrix={indicator.matrix} />
                ) : (
                  <MatrixEditor
                    matrix={indicator.matrix}
                    direction={indicator.direction}
                    target={indicator.target}
                    onChange={(matrix) =>
                      setGoalEditor({
                        ...goalEditor,
                        indicators: goalEditor.indicators.map((item, i) => (i === index ? { ...item, matrix } : item)),
                      })
                    }
                  />
                )}
                <Button
                  variant="outline"
                  onClick={() =>
                    setGoalEditor({ ...goalEditor, indicators: goalEditor.indicators.filter((_, i) => i !== index) })
                  }
                >
                  Remove indicator {index + 1}
                </Button>
              </fieldset>
            ))}
            {!editorReadonly ? (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    setGoalEditor({
                      ...goalEditor,
                      indicators: [
                        ...goalEditor.indicators,
                        {
                          id: uid(),
                          name: "",
                          unit: "Percentage",
                          target: 100,
                          weight: 100,
                          direction: "Higher",
                          scoreMet: 5,
                          scoreBelow: 2,
                        },
                      ],
                    })
                  }
                >
                  Add indicator
                </Button>
                <Button variant="outline" onClick={() => saveTemplate("Draft")}>
                  Save as draft
                </Button>
                <Button onClick={() => saveTemplate("Published")}>Publish template</Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() =>
                    setGoalEditor({ ...clone(goalEditor), id: uid(), status: "Draft", version: goalEditor.version + 1 })
                  }
                >
                  Create new version
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    setGoalEditor({
                      ...clone(goalEditor),
                      id: uid(),
                      name: `${goalEditor.name} (Copy)`,
                      status: "Draft",
                      version: 1,
                    })
                  }
                >
                  Duplicate template
                </Button>
                {goalEditor.status !== "Archived" && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      guard(() => {
                        saveTemplates(
                          templates.map((t) => (t.id === goalEditor.id ? { ...t, status: "Archived" } : t)),
                        );
                        setGoalEditor(null);
                      })
                    }
                  >
                    Archive template
                  </Button>
                )}
              </>
            )}
            {error && <p role="alert">{error}</p>}
          </>
        )}
      </Dialog>
      <Dialog
        open={!!behaviorEditor}
        onOpenChange={(open) => {
          if (!open) setBehaviorEditor(null);
        }}
        title={behaviorReadonly ? "Behavioral Assessment Template details" : "Behavioral Assessment Template builder"}
      >
        {behaviorEditor && (
          <>
            <p>
              Version {behaviorEditor.version} · {behaviorEditor.status}
            </p>
            <Field label="Template name">
              <input
                value={behaviorEditor.name}
                disabled={behaviorReadonly}
                onChange={(e) => setBehaviorEditor({ ...behaviorEditor, name: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <textarea
                value={behaviorEditor.description}
                disabled={behaviorReadonly}
                onChange={(e) => setBehaviorEditor({ ...behaviorEditor, description: e.target.value })}
              />
            </Field>
            <Field label="Applicable position (blank for all)">
              <input
                value={behaviorEditor.position}
                disabled={behaviorReadonly}
                onChange={(e) => setBehaviorEditor({ ...behaviorEditor, position: e.target.value })}
              />
            </Field>
            {behaviorEditor.questions.map((question, index) => (
              <fieldset key={question.id} disabled={behaviorReadonly}>
                <legend>Question {index + 1}</legend>
                <Field label={`Question title ${index + 1}`}>
                  <input
                    value={question.title}
                    onChange={(e) =>
                      setBehaviorEditor({
                        ...behaviorEditor,
                        questions: behaviorEditor.questions.map((q, i) =>
                          i === index ? { ...q, title: e.target.value } : q,
                        ),
                      })
                    }
                  />
                </Field>
                <Field label={`Question type ${index + 1}`}>
                  <select
                    value={question.kind}
                    onChange={(e) =>
                      setBehaviorEditor({
                        ...behaviorEditor,
                        questions: behaviorEditor.questions.map((q, i) =>
                          i === index
                            ? {
                                ...q,
                                kind:
                                  e.target.value === "Text"
                                    ? "Text"
                                    : e.target.value === "Choice"
                                      ? "Choice"
                                      : "Rating",
                              }
                            : q,
                        ),
                      })
                    }
                  >
                    <option>Rating</option>
                    <option>Text</option>
                    <option>Choice</option>
                  </select>
                </Field>
                {question.kind === "Choice" && (
                  <Field label={`Answer options ${index + 1} (one per line)`}>
                    <textarea
                      value={(question.options || []).join("\n")}
                      onChange={(e) =>
                        setBehaviorEditor({
                          ...behaviorEditor,
                          questions: behaviorEditor.questions.map((q, i) =>
                            i === index ? { ...q, options: e.target.value.split("\n") } : q,
                          ),
                        })
                      }
                    />
                  </Field>
                )}
                <Field label={`Required question ${index + 1}`}>
                  <input
                    type="checkbox"
                    checked={question.required}
                    onChange={(e) =>
                      setBehaviorEditor({
                        ...behaviorEditor,
                        questions: behaviorEditor.questions.map((q, i) =>
                          i === index ? { ...q, required: e.target.checked } : q,
                        ),
                      })
                    }
                  />
                </Field>
                <Button
                  variant="outline"
                  onClick={() =>
                    setBehaviorEditor({
                      ...behaviorEditor,
                      questions: behaviorEditor.questions.filter((_, i) => i !== index),
                    })
                  }
                >
                  Remove question {index + 1}
                </Button>
              </fieldset>
            ))}
            {!behaviorReadonly ? (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    setBehaviorEditor({
                      ...behaviorEditor,
                      questions: [
                        ...behaviorEditor.questions,
                        { id: uid(), title: "", kind: "Rating", required: true },
                      ],
                    })
                  }
                >
                  Add question
                </Button>
                <Button variant="outline" onClick={() => saveBehavior("Draft")}>
                  Save as draft
                </Button>
                <Button onClick={() => saveBehavior("Published")}>Publish template</Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() =>
                    setBehaviorEditor({
                      ...clone(behaviorEditor),
                      id: uid(),
                      status: "Draft",
                      version: behaviorEditor.version + 1,
                    })
                  }
                >
                  Create new version
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    setBehaviorEditor({
                      ...clone(behaviorEditor),
                      id: uid(),
                      name: `${behaviorEditor.name} (Copy)`,
                      status: "Draft",
                      version: 1,
                    })
                  }
                >
                  Duplicate template
                </Button>
                {behaviorEditor.status !== "Archived" && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      guard(() => {
                        saveBehaviors(
                          behaviors.map((t) => (t.id === behaviorEditor.id ? { ...t, status: "Archived" } : t)),
                        );
                        setBehaviorEditor(null);
                      })
                    }
                  >
                    Archive template
                  </Button>
                )}
              </>
            )}
            {error && <p role="alert">{error}</p>}
          </>
        )}
      </Dialog>
      <Dialog open={goalOpen} onOpenChange={setGoalOpen} title="Assign employee goals">
        <form onSubmit={assignGoals}>
          <Field label="Employee">
            <select name="employee" required>
              <option value="">Select employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="KPI Goal Template">
            <select name="template" required>
              <option value="">Select published template</option>
              {templates
                .filter((t) => t.status === "Published")
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.position} · v{t.version}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Goal start">
            <input name="start" type="date" defaultValue={editingCycle?.start || ""} required />
          </Field>
          <Field label="Goal deadline">
            <input name="deadline" type="date" required />
          </Field>
          <p>Creates an assigned goal for each template indicator. Existing progress remains unchanged.</p>
          {error && <p role="alert">{error}</p>}
          <Button type="submit">Save goal assignment</Button>
        </form>
      </Dialog>
      <Dialog
        open={!!activeGoal}
        onOpenChange={(open) => {
          if (!open) setActiveGoal(null);
        }}
        title="Goal accomplishments & milestones"
      >
        {activeGoal && (
          <>
            <p>
              <strong>{activeGoal.name}</strong> · {employees.find((e) => e.id === activeGoal.employeeId)?.name}
            </p>
            <p>
              {activeGoal.indicator.direction === "Lower" ? "At most" : "At least"} {activeGoal.indicator.target}{" "}
              {activeGoal.indicator.unit} · Weight {activeGoal.indicator.weight}%
            </p>
            <p>{activeGoal.description || "No description recorded."}</p>
            <p>
              {activeGoal.category || "Delivery"} · {activeGoal.source === "self" ? "Personal goal" : "Assigned goal"} ·
              Assigned by {activeGoal.assignedBy || "Legacy record"}
            </p>
            <MatrixView matrix={activeGoal.indicator.matrix} />
            <form key={activeGoal.id} onSubmit={saveGoal}>
              <Field label="Goal description">
                <textarea
                  value={activeGoal.description || ""}
                  onChange={(e) => setActiveGoal({ ...activeGoal, description: e.target.value })}
                />
              </Field>
              <Field label="Goal category">
                <select
                  value={activeGoal.category || "Delivery"}
                  onChange={(e) => setActiveGoal({ ...activeGoal, category: e.target.value })}
                >
                  {["Quality", "Delivery", "Growth", "Collaboration"].map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </Field>
              <Field label="Progress tracking">
                <select
                  value={activeGoal.trackingMode || "Manual"}
                  onChange={(e) =>
                    setActiveGoal({
                      ...activeGoal,
                      trackingMode: e.target.value === "Milestones" ? "Milestones" : "Manual",
                    })
                  }
                >
                  <option>Manual</option>
                  <option>Milestones</option>
                </select>
              </Field>
              <Field label="Progress (%)">
                <input
                  disabled={activeGoal.trackingMode === "Milestones"}
                  type="number"
                  name="progress"
                  min="0"
                  max="100"
                  step="any"
                  defaultValue={goalProgress(activeGoal)}
                  required
                />
              </Field>
              <Field label="Actual result">
                <input type="number" name="actual" min="0" step="any" defaultValue={activeGoal.actual} />
              </Field>
              <Field label="Accomplishment evidence">
                <textarea name="evidence" defaultValue={activeGoal.evidence} maxLength={10000} />
              </Field>
              <h3>Milestones</h3>
              {activeGoal.milestones.map((milestone, index) => (
                <div key={milestone.id} className="formgrid">
                  <Field label={`Milestone ${index + 1}`}>
                    <input
                      value={milestone.name}
                      onChange={(e) =>
                        setActiveGoal({
                          ...activeGoal,
                          milestones: activeGoal.milestones.map((m, i) =>
                            i === index ? { ...m, name: e.target.value } : m,
                          ),
                        })
                      }
                      required
                    />
                  </Field>
                  <Field label={`Milestone deadline ${index + 1}`}>
                    <input
                      type="date"
                      value={milestone.deadline}
                      min={activeGoal.start}
                      max={activeGoal.deadline}
                      onChange={(e) =>
                        setActiveGoal({
                          ...activeGoal,
                          milestones: activeGoal.milestones.map((m, i) =>
                            i === index ? { ...m, deadline: e.target.value } : m,
                          ),
                        })
                      }
                      required
                    />
                  </Field>
                  <Field label={`Milestone completed ${index + 1}`}>
                    <input
                      type="checkbox"
                      checked={milestone.done}
                      onChange={(e) =>
                        setActiveGoal({
                          ...activeGoal,
                          milestones: activeGoal.milestones.map((m, i) =>
                            i === index ? { ...m, done: e.target.checked } : m,
                          ),
                        })
                      }
                    />
                  </Field>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setActiveGoal({ ...activeGoal, milestones: activeGoal.milestones.filter((_, i) => i !== index) })
                    }
                  >
                    Remove milestone {index + 1}
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  setActiveGoal({
                    ...activeGoal,
                    milestones: [
                      ...activeGoal.milestones,
                      { id: uid(), name: "", deadline: activeGoal.deadline, done: false },
                    ],
                  })
                }
              >
                Add milestone
              </Button>
              <Button type="submit">Save accomplishment</Button>
            </form>
            {(hr || (manager && mayManage(activeGoal.employeeId))) && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const values = new FormData(event.currentTarget);
                  guard(() => {
                    if (
                      cycles.some(
                        (c) =>
                          c.status !== "Draft" &&
                          c.records.some((r) => Object.values(r.goalIds).includes(activeGoal.id)),
                      )
                    )
                      throw new Error(
                        "Goal criteria are frozen in launched cycles. Create a new assigned goal for future evaluations.",
                      );
                    const next = reviseGoal(
                      activeGoal,
                      {
                        target: Number(values.get("target")),
                        deadline: String(values.get("deadline")),
                        reason: String(values.get("reason")),
                      },
                      employeeId || "HR",
                    );
                    saveGoals(goals.map((g) => (g.id === next.id ? next : g)));
                    setActiveGoal(next);
                    setNotice("Goal criteria revised. Existing template remains unchanged.");
                  });
                }}
              >
                <h3>Revise goal criteria</h3>
                <Field label="Employee-specific target">
                  <input
                    name="target"
                    type="number"
                    min="0"
                    step="any"
                    defaultValue={activeGoal.indicator.target}
                    required
                  />
                </Field>
                <Field label="Revised goal deadline">
                  <input
                    name="deadline"
                    type="date"
                    min={activeGoal.start}
                    defaultValue={activeGoal.deadline}
                    required
                  />
                </Field>
                <Field label="Revision reason">
                  <textarea name="reason" required />
                </Field>
                <Button type="submit">Save goal revision</Button>
              </form>
            )}
            <details>
              <summary>Goal revision history</summary>
              {(activeGoal.revisions || []).map((entry) => (
                <p key={entry.id}>
                  {entry.at} · {entry.by} · {entry.action}: {entry.detail}
                </p>
              ))}
              {!activeGoal.revisions?.length && <p>No revisions recorded.</p>}
            </details>
            {manager && identity && activeGoal.approvalStatus === "Pending" && mayManage(activeGoal.employeeId) && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const values = new FormData(event.currentTarget);
                  guard(() => {
                    const owner = employees.find((e) => e.id === activeGoal.employeeId);
                    if (!owner) throw new Error("Employee unavailable.");
                    const next = reviewGoalApproval(
                      activeGoal,
                      identity,
                      owner,
                      values.get("decision") === "Rejected" ? "Rejected" : "Approved",
                      String(values.get("reason")),
                    );
                    saveGoals(goals.map((g) => (g.id === next.id ? next : g)));
                    setActiveGoal(next);
                    setNotice("Goal approval decision recorded.");
                  });
                }}
              >
                <h3>Goal approval</h3>
                <Field label="Approval decision">
                  <select name="decision">
                    <option>Approved</option>
                    <option>Rejected</option>
                  </select>
                </Field>
                <Field label="Approval reason">
                  <textarea name="reason" required />
                </Field>
                <Button type="submit">Save approval decision</Button>
              </form>
            )}
            <p>
              Verification: {activeGoal.verification} · {activeGoal.verificationNote || "Awaiting manager review"}
            </p>
            {manager && mayManage(activeGoal.employeeId) && activeGoal.employeeId !== employeeId && (
              <>
                <Field label="Manager verification note">
                  <textarea
                    value={activeGoal.verificationNote}
                    onChange={(e) => setActiveGoal({ ...activeGoal, verificationNote: e.target.value })}
                  />
                </Field>
                <Button onClick={() => verifyGoal("Verified")}>Verify result</Button>
                <Button variant="outline" onClick={() => verifyGoal("Returned")}>
                  Return for correction
                </Button>
              </>
            )}
            {error && <p role="alert">{error}</p>}
          </>
        )}
      </Dialog>
      <Dialog open={cycleOpen} onOpenChange={setCycleOpen} title="Create review cycle">
        <form key={editingCycle?.id || "new-cycle"} onSubmit={(e) => startCycle(e, false)}>
          <fieldset>
            <legend>Evaluation components</legend>
            <Field label="Include Goals Performance">
              <input
                type="checkbox"
                checked={cycleComponents.goals}
                onChange={(e) => setCycleComponents({ ...cycleComponents, goals: e.target.checked })}
              />
            </Field>
            <Field label="Include Behavioral Performance">
              <input
                type="checkbox"
                checked={cycleComponents.behavioral}
                onChange={(e) => setCycleComponents({ ...cycleComponents, behavioral: e.target.checked })}
              />
            </Field>
          </fieldset>
          <Field label="Previous-stage response visibility">
            <select name="previousStageVisibility" defaultValue={editingCycle?.previousStageVisibility || "hidden"}>
              <option value="hidden">Hide previous responses</option>
              <option value="responses">Show submitted nonanonymous responses to later evaluators</option>
            </select>
          </Field>
          <Field label="Cycle name">
            <input name="name" defaultValue={editingCycle?.name || ""} required maxLength={120} />
          </Field>
          <div className="formgrid">
            <Field label="Evaluation period start">
              <input name="periodStart" type="date" defaultValue={editingCycle?.periodStart || ""} required />
            </Field>
            <Field label="Evaluation period end">
              <input name="periodEnd" type="date" defaultValue={editingCycle?.periodEnd || ""} required />
            </Field>
            <Field label="Operating start date">
              <input name="start" type="date" defaultValue={editingCycle?.start || ""} required />
            </Field>
          </div>
          <fieldset>
            <legend>Participants</legend>
            {employees.map((e) => (
              <Field key={e.id} label={`${e.name} · ${e.title}`}>
                <input
                  type="checkbox"
                  name="participants"
                  value={e.id}
                  defaultChecked={editingCycle?.records.some((r) => r.employee.id === e.id)}
                />
              </Field>
            ))}
          </fieldset>
          <p>
            Choose position-specific KPI templates. Every indicator must have a linked assigned goal in this evaluation
            period.
          </p>
          {Array.from(new Set(employees.map((e) => e.title))).map((position) => (
            <Field key={position} label={`KPI template for ${position}`}>
              <select
                name={`template-${position}`}
                defaultValue={editingCycle?.records.find((r) => r.employee.title === position)?.goalTemplate.id || ""}
              >
                <option value="">Select template</option>
                {templates
                  .filter((t) => t.status === "Published" && t.position === position)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · v{t.version}
                    </option>
                  ))}
              </select>
            </Field>
          ))}
          <Field label="Behavioral Assessment Template">
            <select
              name="behavior"
              required={cycleComponents.behavioral}
              defaultValue={editingCycle?.records[0]?.behaviorTemplate.id || ""}
            >
              <option value="">Select published template</option>
              {behaviors
                .filter((t) => t.status === "Published")
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · v{t.version} · {t.position || "All positions"}
                  </option>
                ))}
            </select>
          </Field>
          <div className="formgrid">
            {Array.from(new Set(employees.map((e) => e.title))).map((position) => (
              <Field key={position} label={`Behavioral override for ${position}`}>
                <select
                  name={`behavior-${position}`}
                  defaultValue={
                    editingCycle?.records.find((r) => r.employee.title === position)?.behaviorTemplate.id || ""
                  }
                >
                  <option value="">Use cycle default</option>
                  {behaviors
                    .filter((t) => t.status === "Published" && (!t.position || t.position === position))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} · v{t.version}
                      </option>
                    ))}
                </select>
              </Field>
            ))}
            <Field label="Goals weight (%)">
              <input
                type="number"
                min="0"
                max="100"
                name="goalWeight"
                defaultValue={editingCycle?.weights.goals ?? 50}
                required
              />
            </Field>
            <Field label="Behavioral weight (%)">
              <input
                type="number"
                min="0"
                max="100"
                name="behaviorWeight"
                defaultValue={editingCycle?.weights.behavioral ?? 50}
                required
              />
            </Field>
          </div>
          <Field label="Behavioral scoring policy">
            <select name="behaviorPolicy" defaultValue={editingCycle?.behaviorPolicy || "average"}>
              <option value="average">Average eligible observed ratings</option>
              <option value="Self">Self is authoritative</option>
              <option value="Manager">Manager is authoritative</option>
              <option value="HR">HR is authoritative</option>
            </select>
          </Field>
          <Field label="Anonymous response threshold">
            <input
              type="number"
              name="anonymousThreshold"
              min="2"
              max="10"
              defaultValue={editingCycle?.anonymousThreshold ?? 2}
              required
            />
          </Field>
          <p>
            Progress and achievement remain separate. Results release requires HR action. Peer and upward feedback below
            the anonymous threshold is withheld and excluded from scores.
          </p>
          {[
            ["selfDeadline", "Self assessment deadline"],
            ["managerDeadline", "Manager assessment deadline"],
            ["hrDeadline", "HR assessment deadline"],
          ].map(([name, label]) => (
            <Field key={name} label={label}>
              <input
                type="date"
                name={name}
                defaultValue={
                  editingCycle?.stages.find(
                    (s) =>
                      s.type === (name === "selfDeadline" ? "Self" : name === "managerDeadline" ? "Manager" : "HR"),
                  )?.deadline || ""
                }
                required
              />
            </Field>
          ))}
          {(["Peer", "Upward"] as const).map((type) => (
            <div key={type}>
              <Field label={`Include ${type} assessment`}>
                <input
                  type="checkbox"
                  checked={optionalStages.includes(type)}
                  onChange={(e) =>
                    setOptionalStages(
                      e.target.checked ? [...optionalStages, type] : optionalStages.filter((s) => s !== type),
                    )
                  }
                />
              </Field>
              {optionalStages.includes(type) && (
                <fieldset>
                  <legend>{type} evaluator assignment</legend>
                  <p>
                    Assign evaluators for each participating subject. A subject cannot review their own assessment.
                    Sequence follows selection order, before HR.
                  </p>
                  <Field label={`${type} assessment deadline`}>
                    <input
                      name={`${type}Deadline`}
                      type="date"
                      defaultValue={editingCycle?.stages.find((s) => s.type === type)?.deadline || ""}
                      required
                    />
                  </Field>
                  {employees.map((subject) => (
                    <details key={subject.id}>
                      <summary>
                        {type} evaluators for {subject.name}
                      </summary>
                      {employees
                        .filter((e) => e.id !== subject.id)
                        .map((e) => (
                          <Field key={e.id} label={`${type} evaluator for ${subject.name}: ${e.name}`}>
                            <input
                              type="checkbox"
                              name={`${type}Reviewers-${subject.id}`}
                              value={e.id}
                              defaultChecked={
                                editingCycle?.stages.find((s) => s.type === type) &&
                                reviewers(
                                  editingCycle.stages.find((s) => s.type === type)!,
                                  subject.id,
                                ).includes(e.id)
                              }
                            />
                          </Field>
                        ))}
                    </details>
                  ))}
                </fieldset>
              )}
            </div>
          ))}
          <Button
            variant="outline"
            type="submit"
            onClick={(e) => {
              const form = e.currentTarget.form;
              if (form) {
                e.preventDefault();
                startCycle({ preventDefault: () => {}, currentTarget: form } as FormEvent<HTMLFormElement>, true);
              }
            }}
          >
            Save cycle draft
          </Button>
          <Button type="submit">Launch review cycle</Button>
          {error && <p role="alert">{error}</p>}
        </form>
      </Dialog>
      <Dialog
        open={!!assessment}
        onOpenChange={(open) => {
          if (!open) setAssessment(null);
        }}
        title={`${(currentCycle && currentRecord ? pendingStage(currentCycle, currentRecord)?.type : "") || ""} assessment`}
      >
        {currentRecord && currentCycle && (
          <form key={`${currentCycle.id}:${currentRecord.employee.id}`} onSubmit={sendAssessment}>
            <h3>
              {currentRecord.employee.name} · {currentCycle.name}
            </h3>
            <p>
              Template snapshots: {currentRecord.goalTemplate.name} v{currentRecord.goalTemplate.version} ·{" "}
              {currentRecord.behaviorTemplate.name} v{currentRecord.behaviorTemplate.version}
            </p>
            {currentCycle.previousStageVisibility === "responses" && (
              <details open>
                <summary>Previous submitted assessments</summary>
                {currentRecord.responses
                  .filter((r) => r.type !== "Peer" && r.type !== "Upward")
                  .map((response) => (
                    <article key={response.type}>
                      <strong>{response.type}</strong>
                      <p>{response.feedback}</p>
                      {(response.behaviorTemplate ?? currentRecord.behaviorTemplate).questions.map((q) => (
                        <p key={q.id}>
                          {q.title}: {response.answers[q.id] || "Unanswered"}
                        </p>
                      ))}
                    </article>
                  ))}
              </details>
            )}
            <h3>Goals Performance</h3>
            {currentRecord.goalTemplate.indicators.map((i) => {
              const goal = goals.find((g) => g.id === currentRecord.goalIds[i.id]);
              return (
                <section key={i.id}>
                  <strong>{i.name}</strong>
                  <p>
                    Target: {i.target} {i.unit} · Actual: {goal?.actual ?? "Not recorded"} · Progress:{" "}
                    {goal?.progress ?? 0}% · {goal?.verification || "Missing goal"}
                  </p>
                  <p>{goal?.evidence || "Accomplishment evidence required."}</p>
                  <MatrixView matrix={i.matrix} />
                  {goal && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAssessment(null);
                        setActiveGoal(clone(goal));
                      }}
                    >
                      Open assigned goal
                    </Button>
                  )}
                </section>
              );
            })}
            <h3>Behavioral Performance</h3>
            {currentRecord.behaviorTemplate.questions.map((q) => (
              <Field key={q.id} label={`${q.title}${q.required ? " (required)" : ""}`}>
                {q.kind === "Rating" ? (
                  <select name={q.id} required={q.required} defaultValue={assessmentDraft?.answers[q.id] || ""}>
                    <option value="">Select rating</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} / 5
                      </option>
                    ))}
                    <option value="NO">Not Observed</option>
                  </select>
                ) : q.kind === "Choice" ? (
                  <select name={q.id} required={q.required} defaultValue={assessmentDraft?.answers[q.id] || ""}>
                    <option value="">Select answer</option>
                    {q.options?.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <textarea
                    name={q.id}
                    required={q.required}
                    maxLength={10000}
                    defaultValue={assessmentDraft?.answers[q.id] || ""}
                  />
                )}
              </Field>
            ))}
            <Field label="Assessment feedback">
              <textarea name="feedback" maxLength={10000} defaultValue={assessmentDraft?.feedback || ""} />
            </Field>
            <Button
              variant="outline"
              onClick={(e) => {
                if (e.currentTarget.form) draftAssessment(e.currentTarget.form);
              }}
            >
              Save assessment draft
            </Button>
            <Button type="submit">Submit assessment</Button>
            {error && <p role="alert">{error}</p>}
          </form>
        )}
      </Dialog>
      <Dialog
        open={!!result}
        onOpenChange={(open) => {
          if (!open) setResult(null);
        }}
        title="Employee evaluation results"
      >
        {resultRecord && resultCycle && (hr || resultRecord.releasedAt) && (
          <>
            <h3>
              {resultRecord.employee.name} · {resultCycle.name}
            </h3>
            <p>
              {resultRecord.employee.title} · {resultRecord.employee.department}
            </p>
            <p>
              Evaluation period: {resultCycle.periodStart} to {resultCycle.periodEnd}
            </p>
            <p>
              {resultRecord.finalizedAt ? "Finalized" : "In progress"} ·{" "}
              {resultRecord.releasedAt ? "Released" : "Not released"}
            </p>
            {resultRecord.result ? (
              <dl>
                <dt>Goals Performance ({resultCycle.weights.goals}%)</dt>
                <dd>{resultRecord.result.goalScore?.toFixed(2) ?? "Not configured"} / 5</dd>
                <dt>Behavioral Performance ({resultCycle.weights.behavioral}%)</dt>
                <dd>{resultRecord.result.behaviorScore?.toFixed(2) ?? "Not configured"} / 5</dd>
                <dt>Overall Performance Rating</dt>
                <dd>{resultRecord.result.overall?.toFixed(2) ?? "Not configured"} / 5</dd>
              </dl>
            ) : (
              <p>Official scores become available after HR finalization.</p>
            )}
            <h3>Goal achievement</h3>
            {resultRecord.goalTemplate.indicators.map((i) => {
              const actual = resultRecord.responses.find((r) => r.type === "Manager")?.actuals[i.id];
              return (
                <section key={i.id}>
                  <strong>{i.name}</strong>
                  <p>
                    Target: {i.target} {i.unit} · Verified actual: {actual ?? "Pending"} ·{" "}
                    {actual === undefined
                      ? "Awaiting verification"
                      : (i.direction === "Lower" ? actual <= i.target : actual >= i.target)
                        ? "Target met"
                        : "Below target"}{" "}
                    · Weight: {i.weight}%
                  </p>
                  <MatrixView matrix={i.matrix} />
                </section>
              );
            })}
            <h3>Manager final comment</h3>
            {manager && mayManage(resultRecord.employee.id) && identity ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const value = String(new FormData(event.currentTarget).get("managerComment") || "");
                  guard(() => {
                    const next = setManagerComment(resultCycle, resultRecord.employee.id, identity, value);
                    saveCycles(cycles.map((c) => (c.id === next.id ? next : c)));
                    setNotice("Manager final comment saved.");
                  });
                }}
              >
                <Field label="Manager final comment">
                  <textarea name="managerComment" defaultValue={resultRecord.managerComment} maxLength={10000} />
                </Field>
                <Button type="submit">Save final comment</Button>
              </form>
            ) : (
              <p>{resultRecord.managerComment || "No final comment recorded."}</p>
            )}
            <h3>Assessment feedback</h3>
            {resultRecord.responses
              .filter((response) => response.type !== "Peer" && response.type !== "Upward")
              .map((response) => (
                <section key={response.type}>
                  <strong>{response.type} assessment</strong>
                  <p>{response.feedback || "No additional feedback."}</p>
                  {(response.behaviorTemplate ?? resultRecord.behaviorTemplate).questions.map((q) => (
                    <p key={q.id}>
                      {q.title}:{" "}
                      {response.answers[q.id] === "NO" ? "Not Observed" : response.answers[q.id] || "Unanswered"}
                    </p>
                  ))}
                </section>
              ))}
            {resultCycle.stages.filter(anonymous).map((stage) => {
              const responses = stageResponses(resultRecord, stage),
                observed = responses
                  .flatMap((r) =>
                    resultRecord.behaviorTemplate.questions
                      .filter((q) => q.kind === "Rating")
                      .map((q) => r.answers[q.id]),
                  )
                  .filter((v) => v && v !== "NO")
                  .map(Number);
              return (
                <p key={stage.type}>
                  {stage.type} feedback:{" "}
                  {responses.length < resultCycle.anonymousThreshold
                    ? "Withheld: insufficient anonymous responses"
                    : observed.length
                      ? `${(observed.reduce((sum, n) => sum + n, 0) / observed.length).toFixed(2)} / 5 (${responses.length} responses)`
                      : "Not Observed"}
                </p>
              );
            })}
            <p>
              Behavior policy: {resultCycle.behaviorPolicy}. Not Observed and narrative responses are excluded from
              numerical scoring. Calculations use unrounded scores. Any verified below-target indicator triggers a PIP
              review referral when HR releases results.
            </p>
          </>
        )}
      </Dialog>
      <Dialog
        open={!!cycleAction}
        onOpenChange={(open) => {
          if (!open) setCycleAction(null);
        }}
        title={cycleAction?.kind === "extend" ? "Extend assessment deadline" : "Cancel review cycle"}
      >
        {cycleAction && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              guard(() => {
                if (!hr) throw new Error("HR access is required.");
                const cycle = cycles.find((c) => c.id === cycleAction.cycleId);
                if (!cycle) throw new Error("Cycle unavailable.");
                const next =
                  cycleAction.kind === "cancel"
                    ? cancelCycle(cycle, String(values.get("reason") || ""), employeeId || "HR")
                    : extendStageDeadline(
                        cycle,
                        StageSchema.shape.type.parse(values.get("type")),
                        String(values.get("deadline")),
                        String(values.get("reason") || ""),
                        employeeId || "HR",
                      );
                saveCycles(cycles.map((c) => (c.id === next.id ? next : c)));
                setCycleAction(null);
                setNotice(
                  cycleAction.kind === "cancel"
                    ? "Cycle cancelled. Historical assessments remain recorded."
                    : "Deadline extended. Later stage dates move equally to preserve the sequence.",
                );
              });
            }}
          >
            {cycleAction.kind === "extend" && (
              <>
                <Field label="Assessment stage">
                  <select name="type">
                    {cycles
                      .find((c) => c.id === cycleAction.cycleId)
                      ?.stages.map((s) => (
                        <option key={s.type}>{s.type}</option>
                      ))}
                  </select>
                </Field>
                <Field label="New deadline">
                  <input name="deadline" type="date" required min={today()} />
                </Field>
              </>
            )}
            <Field label="Reason">
              <textarea name="reason" required />
            </Field>
            <Button type="submit">{cycleAction.kind === "extend" ? "Save extension" : "Confirm cancellation"}</Button>
            {error && <p role="alert">{error}</p>}
          </form>
        )}
      </Dialog>
      <Dialog open={personalGoalOpen} onOpenChange={setPersonalGoalOpen} title="Create personal goal">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const values = new FormData(event.currentTarget);
            guard(() => {
              if (role !== "Employee" || !identity) throw new Error("Select your employee identity first.");
              const goal = createPersonalGoal(
                {
                  name: values.get("name"),
                  description: values.get("description"),
                  category: values.get("category"),
                  start: values.get("start"),
                  deadline: values.get("deadline"),
                  target: Number(values.get("target")),
                  unit: values.get("unit"),
                  direction: values.get("direction"),
                  trackingMode: values.get("trackingMode"),
                  requestApproval: values.get("approval") === "on",
                },
                identity,
              );
              saveGoals([...goals, goal]);
              setPersonalGoalOpen(false);
              setNotice(
                goal.approvalStatus === "Pending"
                  ? "Personal goal submitted for manager approval."
                  : "Personal goal created.",
              );
            });
          }}
        >
          <Field label="Goal name">
            <input name="name" required maxLength={140} />
          </Field>
          <Field label="Goal description">
            <textarea name="description" required maxLength={10000} />
          </Field>
          <Field label="Goal category">
            <select name="category">
              {["Growth", "Quality", "Delivery", "Collaboration"].map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </Field>
          <Field label="Personal goal start">
            <input name="start" type="date" required />
          </Field>
          <Field label="Personal goal deadline">
            <input name="deadline" type="date" required />
          </Field>
          <Field label="Goal target">
            <input name="target" type="number" min="0" step="any" required />
          </Field>
          <Field label="Goal unit">
            <input name="unit" required />
          </Field>
          <Field label="Goal direction">
            <select name="direction">
              <option>Higher</option>
              <option>Lower</option>
            </select>
          </Field>
          <Field label="Progress tracking">
            <select name="trackingMode">
              <option>Manual</option>
              <option>Milestones</option>
            </select>
          </Field>
          <Field label="Request manager approval">
            <input type="checkbox" name="approval" />
          </Field>
          <Button type="submit">Save personal goal</Button>
          {error && <p role="alert">{error}</p>}
        </form>
      </Dialog>
    </section>
  );
}
