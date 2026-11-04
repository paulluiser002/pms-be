import { workflowToday as today } from "./workflow-clock";
import { useEffect, useState, type FormEvent } from "react";
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
const employeeSchema = z.object({
  id: text,
  name: text,
  title: z.string(),
  department: z.string(),
  manager: z.string(),
  companyId: z.string().optional(),
});
const historySchema = z.object({ action: text, actor: text, at: text, detail: z.unknown().optional() });
const auditFields = {
  history: z.array(historySchema).optional(),
  legacy: z.record(z.string(), z.unknown()).optional(),
};
const entryTypes = [
  "Achievement",
  "Performance Observation",
  "Area for Improvement",
  "Coaching / Feedback",
  "Performance Incident",
  "Other",
];
const optionalDate = z.preprocess((value) => (value === "" ? undefined : value), date.optional());
const journalSchema = z.object({
  id: text,
  employeeId: text,
  title: text,
  body: text,
  createdAt: text,
  author: text,
  date: optionalDate,
  type: z.string().optional(),
  cycle: z.string().optional(),
  ...auditFields,
});
const noticeSchema = z.object({
  id: text,
  employeeId: text,
  subject: text.max(200),
  body: text.max(20000),
  category: z.enum(["Attendance", "Conduct", "Performance", "Policy Compliance", "Other"]),
  deadline: date,
  status: z.enum(["Draft", "Issued", "Responded", "Closed", "Cancelled"]),
  explanation: z.string().optional(),
  closure: z.string().optional(),
  earlyReason: z.string().optional(),
  incidentDate: optionalDate,
  reference: z.string().max(200).optional(),
  createdAt: z.string().optional(),
  issuedAt: z.string().optional(),
  readAt: z.string().optional(),
  respondedAt: z.string().optional(),
  closedAt: z.string().optional(),
  cancelledAt: z.string().optional(),
  cancelReason: z.string().optional(),
  ...auditFields,
});
const weekSchema = z.object({
  id: text,
  goal: text,
  actions: text,
  support: text,
  target: z.number().finite().nonnegative(),
  unit: text,
  direction: z.enum(["Higher", "Lower"]),
  start: date,
  end: date,
  state: z.enum(["Pending", "Submitted", "Assessed"]),
  indicatorId: z.string().optional(),
  actual: z.number().finite().nonnegative().optional(),
  update: z.string().optional(),
  evidence: z.string().optional(),
  assessment: z.string().optional(),
  met: z.boolean().optional(),
  followUpFor: z.string().optional(),
  extensionReason: z.string().optional(),
  returnReason: z.string().optional(),
  missedReason: z.string().optional(),
  submissions: z
    .array(z.object({ actual: z.number(), update: z.string(), evidence: z.string().optional(), at: text }))
    .optional(),
});
const indicatorSchema = z.object({
  id: text,
  name: text,
  target: z.number().finite().nonnegative(),
  actual: z.number().finite().nonnegative(),
  direction: z.enum(["Higher", "Lower"]),
});
const referralSchema = z.object({
  id: text,
  cycleId: text,
  cycleName: text,
  employeeId: text,
  employeeName: z.string(),
  indicators: z.array(indicatorSchema),
  createdAt: text,
});
const planSchema = z.object({
  id: text,
  employeeId: text,
  title: text,
  reason: text,
  origin: z.enum(["Manual", "Automatic"]),
  state: z.enum([
    "Draft",
    "Awaiting Planning",
    "Active",
    "Completed",
    "Completed with Exclusions",
    "Not Met",
    "Cancelled",
  ]),
  referrals: z.array(referralSchema),
  weeks: z.array(weekSchema),
  closure: z.string().optional(),
  exclusions: z.array(z.object({ indicatorId: text, reason: text })).optional(),
  acknowledgedAt: z.string().optional(),
  needsReview: z.boolean().optional(),
  reviewNote: z.string().optional(),
  activatedAt: z.string().optional(),
  closedAt: z.string().optional(),
  cancelReason: z.string().optional(),
  ...auditFields,
});
const storeSchema = z.object({
  journals: z.array(journalSchema),
  notices: z.array(noticeSchema),
  plans: z.array(planSchema),
});
type Store = z.infer<typeof storeSchema>;
type Plan = z.infer<typeof planSchema>;
type Week = z.infer<typeof weekSchema>;
const key = "pms-react-cases-v1";

function read<T>(keyName: string, schema: z.ZodType<T>, fallback: T): T {
  const raw = localStorage.getItem(keyName);
  return raw === null ? fallback : schema.parse(JSON.parse(raw));
}
function endDate(start: string) {
  return new Date(Date.parse(start + "T12:00:00Z") + 6 * 86400000).toISOString().slice(0, 10);
}
function covered(plan: Plan, id: string) {
  return plan.weeks.some((w) => w.indicatorId === id) || (plan.exclusions || []).some((x) => x.indicatorId === id);
}
function planMet(plan: Plan) {
  return plan.weeks
    .filter((week) => !plan.weeks.some((next) => next.followUpFor === week.id))
    .every((week) => week.met);
}
function auditValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(auditValue).join("; ");
  if (typeof value === "object")
    return Object.entries(value)
      .filter(([field]) => !["id", "history", "legacy"].includes(field))
      .map(([field, item]) => field.replace(/([A-Z])/g, " $1") + ": " + auditValue(item))
      .join(", ");
  return String(value);
}
function history(entries: z.infer<typeof historySchema>[] | undefined) {
  return entries?.length ? (
    <details>
      <summary>Record history</summary>
      <ol>
        {entries.map((entry, index) => (
          <li key={index}>
            {entry.action} · {entry.actor} · {entry.at}
            {entry.detail !== undefined && <p>{auditValue(entry.detail)}</p>}
          </li>
        ))}
      </ol>
    </details>
  ) : null;
}
function fields(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
}
function audit<T extends { id: string; history?: z.infer<typeof historySchema>[] }>(
  record: T,
  previous: T[],
  action: string,
  actor: string,
): T {
  const old = previous.find((item) => item.id === record.id);
  if (old && JSON.stringify(old) === JSON.stringify(record)) return record;
  const detail = Object.fromEntries(
    Object.entries(record).filter(
      ([field, value]) =>
        !["history", "legacy"].includes(field) &&
        JSON.stringify(value) !== JSON.stringify(old && Object.entries(old).find(([key]) => key === field)?.[1]),
    ),
  );
  return {
    ...record,
    history: [
      ...(old?.history || record.history || []),
      {
        action: action === "Record updated" && "status" in record ? "NTE " + String(record.status) : action,
        actor,
        at: new Date().toISOString(),
        detail,
      },
    ],
  };
}
const legacyHistorySchema = z.array(z.object({ action: text, by: text, at: text, detail: z.unknown().optional() }));
function migrateLegacy(current: Store, employeeIds: string[]) {
  const source = localStorage.getItem("people-mvp-v1");
  if (!source) return { changed: false, skipped: 0 };
  let decoded: unknown;
  try {
    decoded = JSON.parse(source);
  } catch {
    return { changed: false, skipped: 1 };
  }
  const parsedEnvelope = z
    .object({
      pmsActiveCompanyId: z.string().optional(),
      unifiedReviews: z
        .object({
          journal: z.array(z.unknown()).optional(),
          nteFiles: z.array(z.unknown()).optional(),
          pipPlans: z.array(z.unknown()).optional(),
        })
        .optional(),
    })
    .safeParse(decoded);
  if (!parsedEnvelope.success) return { changed: false, skipped: 1 };
  const envelope = parsedEnvelope.data;
  const legacy = envelope.unifiedReviews;
  if (!legacy) return { changed: false, skipped: 0 };
  let changed = false,
    skipped = 0;
  function auditHistory(value: unknown) {
    const parsed = legacyHistorySchema.safeParse(value);
    return parsed.success
      ? parsed.data.map((entry) => ({ action: entry.action, actor: entry.by, at: entry.at, detail: entry.detail }))
      : [];
  }
  const object = z.record(z.string(), z.unknown());
  function belongs(raw: Record<string, unknown>) {
    return (
      typeof raw.employee === "string" &&
      employeeIds.includes(raw.employee) &&
      (!raw.companyId || raw.companyId === (envelope.pmsActiveCompanyId || "mayon"))
    );
  }
  for (const value of legacy.journal || []) {
    const result = object.safeParse(value);
    if (!result.success) {
      skipped++;
      continue;
    }
    const raw = result.data;
    if (!belongs(raw) || current.journals.some((j) => j.id === raw.id)) continue;
    const parsed = journalSchema.safeParse({
      id: raw.id,
      employeeId: raw.employee,
      title: raw.title,
      body: raw.description,
      author: raw.author,
      createdAt: raw.created,
      date: raw.date,
      type: raw.type,
      cycle: raw.cycle,
      history: auditHistory(raw.history),
      legacy: raw,
    });
    if (parsed.success) {
      current.journals.push(parsed.data);
      changed = true;
    } else skipped++;
  }
  for (const value of legacy.nteFiles || []) {
    const result = object.safeParse(value);
    if (!result.success) {
      skipped++;
      continue;
    }
    const raw = result.data;
    if (!belongs(raw) || current.notices.some((n) => n.id === raw.id)) continue;
    const parsed = noticeSchema.safeParse({
      ...raw,
      employeeId: raw.employee,
      closure: raw.closureNote || raw.cancelReason,
      earlyReason: raw.earlyClosureReason,
      history: auditHistory(raw.history),
      legacy: raw,
    });
    if (parsed.success) {
      current.notices.push(parsed.data);
      changed = true;
    } else skipped++;
  }
  const legacySource = z.object({
    cycleId: text,
    cycleName: text,
    indicators: z.array(
      z.object({
        id: z.string().optional(),
        indicatorId: z.string().optional(),
        name: text,
        target: z.preprocess(
          (value) => (typeof value === "string" && value.trim() ? Number(value) : value),
          z.number().finite().nonnegative(),
        ),
        actual: z.preprocess(
          (value) => (typeof value === "string" && value.trim() ? Number(value) : value),
          z.number().finite().nonnegative(),
        ),
        direction: z.enum(["Higher", "Lower"]),
      }),
    ),
  });
  for (const value of legacy.pipPlans || []) {
    const result = object.safeParse(value);
    if (!result.success) {
      skipped++;
      continue;
    }
    const raw = result.data;
    if (!belongs(raw) || current.plans.some((p) => p.id === raw.id)) continue;
    const sources = z.array(legacySource).safeParse(raw.sources || []),
      weeks = z.array(object).safeParse(raw.weeks || []),
      exclusions = z
        .array(z.object({ sourceCycleId: text, indicatorId: text, reason: text }))
        .safeParse(raw.exclusions || []);
    if (!sources.success || !weeks.success || !exclusions.success) {
      skipped++;
      continue;
    }
    const referrals = sources.data.map((s) => ({
      id: String(raw.id) + ":" + s.cycleId,
      cycleId: s.cycleId,
      cycleName: s.cycleName,
      employeeId: raw.employee,
      employeeName: "",
      createdAt: raw.createdAt,
      indicators: s.indicators
        .filter(
          (i) => raw.origin !== "Automatic" || (i.direction === "Lower" ? i.actual > i.target : i.actual < i.target),
        )
        .map((i) => ({ ...i, id: i.indicatorId || i.id })),
    }));
    function sourceKey(indicator: unknown, cycle: unknown) {
      if (indicator === "custom") return "custom";
      const matches = referrals.filter(
        (r) => (!cycle || r.cycleId === cycle) && r.indicators.some((i) => i.id === indicator),
      );
      return matches.length === 1 ? matches[0].id + ":" + indicator : undefined;
    }
    const mappedWeeks = weeks.data.map((w) => {
      const assessment = object.safeParse(w.assessment);
      return {
        ...w,
        indicatorId: sourceKey(w.indicatorId, w.sourceCycleId),
        actual: assessment.success ? assessment.data.actual : w.actual === null ? undefined : w.actual,
        assessment: assessment.success ? assessment.data.remarks : undefined,
        met: assessment.success ? assessment.data.result === "Met" : undefined,
        missedReason: assessment.success ? assessment.data.missedUpdateReason : undefined,
        returnReason: w.returnReason,
      };
    });
    const parsed = planSchema.safeParse({
      ...raw,
      employeeId: raw.employee,
      referrals,
      weeks: mappedWeeks,
      exclusions: exclusions.data.map((x) => ({
        indicatorId: sourceKey(x.indicatorId, x.sourceCycleId),
        reason: x.reason,
      })),
      closure: raw.closureNote || raw.cancellationReason,
      history: auditHistory(raw.history),
      legacy: raw,
    });
    if (parsed.success) {
      current.plans.push(parsed.data);
      changed = true;
    } else skipped++;
  }
  return { changed, skipped };
}

export function Cases({
  role,
  employeeId = "",
  managerId = "",
  companyId = "mayon",
  initialTab,
}: {
  role: string;
  employeeId?: string;
  managerId?: string;
  companyId?: string;
  initialTab?: string;
}) {
  const [error, setError] = useState("");
  const [data, setData] = useState<Store>(() => {
    try {
      return read(key, storeSchema, { journals: [], notices: [], plans: [] });
    } catch {
      return { journals: [], notices: [], plans: [] };
    }
  });
  const [employees] = useState(() => {
    try {
      return read("pms-react-employees-v1", z.array(employeeSchema), []);
    } catch {
      return [];
    }
  });
  const [tab, setTab] = useState(initialTab ?? "Journal Entries"),
    [modal, setModal] = useState(""),
    [selectedPlan, setSelectedPlan] = useState(""),
    [query, setQuery] = useState(""),
    [editingNotice, setEditingNotice] = useState(""),
    [journalType, setJournalType] = useState("All types"),
    [fromDate, setFromDate] = useState(""),
    [toDate, setToDate] = useState(""),
    [nteEmployee, setNteEmployee] = useState(""),
    [noticeStatus, setNoticeStatus] = useState("All records");
  const hr = role === "HR Administrator",
    staff = hr || role === "Manager";
  const manager = employees.find((e) => e.id === (managerId || employeeId));
  const scoped = employees.filter(
    (e) =>
      (e.companyId || "mayon") === companyId &&
      (hr ||
        (role === "Employee" && e.id === employeeId) ||
        (role === "Manager" && !!manager && (e.manager === manager.id || e.manager === manager.name))),
  );
  useEffect(() => {
    if (!staff) {
      setModal("");
      setTab((current) => (current === "Journal Entries" ? "NTE Files" : current));
    }
  }, [staff]);
  useEffect(() => {
    setModal("");
    setEditingNotice("");
    setNoticeStatus("All records");
    setQuery("");
  }, [companyId, role, employeeId, managerId]);
  const allowed = (id: string) => scoped.some((e) => e.id === id);
  const selectedNteEmployee = allowed(nteEmployee) ? nteEmployee : "";
  const name = (id: string) => employees.find((e) => e.id === id)?.name || id;
  function save(next: Store, action = "Record updated") {
    try {
      read(key, storeSchema, { journals: [], notices: [], plans: [] });
      const actor = role + (employeeId || managerId ? " (" + (managerId || employeeId) + ")" : "");
      next = {
        journals: next.journals.map((record) => audit(record, data.journals, action, actor)),
        notices: next.notices.map((record) => audit(record, data.notices, action, actor)),
        plans: next.plans.map((record) => audit(record, data.plans, action, actor)),
      };
      storeSchema.parse(next);
      localStorage.setItem(key, JSON.stringify(next));
      setData(next);
      setError("");
      return true;
    } catch {
      setError("Unable to save records. Check browser storage and record values.");
      return false;
    }
  }
  function updatePlan(plan: Plan, action = "Plan updated") {
    return save({ ...data, plans: data.plans.map((p) => (p.id === plan.id ? plan : p)) }, action);
  }
  useEffect(() => {
    function sync(event?: Event) {
      try {
        const current = read(key, storeSchema, { journals: [], notices: [], plans: [] });
        const migration = migrateLegacy(
          current,
          employees.map((e) => e.id),
        );
        const referrals = read("pms-react-pip-referrals-v1", z.array(referralSchema), []);
        const incoming = event instanceof CustomEvent ? referralSchema.safeParse(event.detail) : null;
        if (incoming?.success && !referrals.some((r) => r.id === incoming.data.id)) referrals.push(incoming.data);
        let changed = migration.changed;
        if (migration.skipped)
          setError(migration.skipped + " legacy records could not be imported. Original browser data is preserved.");
        for (const referral of referrals) {
          if (
            !employees.some((e) => e.id === referral.employeeId) ||
            current.plans.some((p) => p.referrals.some((r) => r.id === referral.id))
          )
            continue;
          const open = current.plans.find(
            (p) =>
              p.employeeId === referral.employeeId &&
              !["Completed", "Completed with Exclusions", "Not Met", "Cancelled"].includes(p.state),
          );
          if (open) {
            open.referrals.push(referral);
            open.needsReview = true;
            open.history = [
              ...(open.history || []),
              { action: "Evaluation referral added", actor: "System", at: new Date().toISOString() },
            ];
          } else
            current.plans.push({
              id: crypto.randomUUID(),
              employeeId: referral.employeeId,
              title: "Performance Improvement Plan",
              reason: "Verified evaluation indicators require improvement: " + referral.cycleName,
              origin: "Automatic",
              state: "Awaiting Planning",
              needsReview: true,
              referrals: [referral],
              weeks: [],
              history: [{ action: "Automatically enrolled", actor: "System", at: new Date().toISOString() }],
            });
          changed = true;
        }
        if (changed) {
          localStorage.setItem(key, JSON.stringify(current));
          setData(current);
        }
      } catch {
        setError("Some saved case or referral records are invalid. Existing browser records are preserved.");
      }
    }
    sync();
    window.addEventListener("pms-pip-referral", sync);
    return () => window.removeEventListener("pms-pip-referral", sync);
  }, [employees]);
  function create(event: FormEvent<HTMLFormElement>) {
    const values = fields(event);
    if (!staff || !allowed(values.employeeId)) {
      setError("Choose an employee in your access scope.");
      return;
    }
    const id = modal === "notice" && editingNotice ? editingNotice : crypto.randomUUID();
    let next = data;
    if (modal === "journal") {
      if (values.date && values.date > today()) {
        setError("The journal entry date cannot be in the future.");
        return;
      }
      const parsed = journalSchema.safeParse({ ...values, id, createdAt: new Date().toISOString(), author: role });
      if (!parsed.success) {
        setError("Complete the journal title and entry.");
        return;
      }
      next = { ...data, journals: [parsed.data, ...data.journals] };
    }
    if (modal === "notice") {
      if (!hr) return;
      const parsed = noticeSchema.safeParse({
        ...values,
        id,
        status: "Draft",
        createdAt: data.notices.find((n) => n.id === id)?.createdAt || new Date().toISOString(),
      });
      if (!parsed.success || values.deadline < today() || (values.incidentDate && values.incidentDate > today())) {
        setError(
          "Complete all notice fields, choose a deadline on or after today and an incident date on or before today.",
        );
        return;
      }
      next = {
        ...data,
        notices: editingNotice
          ? data.notices.map((n) => (n.id === editingNotice ? parsed.data : n))
          : [parsed.data, ...data.notices],
      };
    }
    if (modal === "plan") {
      if (
        data.plans.some(
          (p) =>
            p.employeeId === values.employeeId &&
            !["Completed", "Completed with Exclusions", "Not Met", "Cancelled"].includes(p.state),
        )
      ) {
        setError("This employee already has an open plan.");
        return;
      }
      const parsed = planSchema.safeParse({
        ...values,
        id,
        origin: "Manual",
        state: "Draft",
        referrals: [],
        weeks: [],
      });
      if (!parsed.success) {
        setError("Enter a plan title and enrollment reason.");
        return;
      }
      next = { ...data, plans: [parsed.data, ...data.plans] };
    }
    if (
      save(
        next,
        modal === "journal"
          ? "Journal entry created"
          : modal === "notice"
            ? editingNotice
              ? "NTE draft updated"
              : "NTE draft created"
            : "Manually enrolled",
      )
    ) {
      if (modal === "notice") setNteEmployee(values.employeeId);
      setModal("");
    }
  }
  function addWeek(event: FormEvent<HTMLFormElement>) {
    const v = fields(event),
      plan = data.plans.find((p) => p.id === selectedPlan);
    if (!staff || !plan || !allowed(plan.employeeId) || !["Draft", "Awaiting Planning", "Active"].includes(plan.state))
      return;
    const parsed = weekSchema.safeParse({
      ...v,
      id: crypto.randomUUID(),
      end: date.safeParse(v.start).success ? endDate(v.start) : "",
      state: "Pending",
      target: v.target?.trim() ? Number(v.target) : NaN,
    });
    if (
      !parsed.success ||
      v.start < today() ||
      plan.weeks.some((w) => v.start <= w.end && parsed.data!.end >= w.start)
    ) {
      setError("Complete the weekly goal, actions, support, measurable target and a nonoverlapping future start date.");
      return;
    }
    const prior = plan.weeks.find((w) => w.id === v.followUpFor);
    if (v.followUpFor && (!prior || (prior.indicatorId || "custom") !== v.indicatorId || prior.end >= v.start)) {
      setError("A follow-up must link an earlier week with the same source indicator and evaluation.");
      return;
    }
    if (plan.state === "Active" && (!v.extensionReason?.trim() || plan.weeks.some((w) => w.end >= v.start))) {
      setError("Record an extension reason and start the new week after all existing weeks.");
      return;
    }
    if ((plan.exclusions || []).some((x) => x.indicatorId === v.indicatorId)) {
      setError("Restore an excluded indicator before adding its week.");
      return;
    }
    if (updatePlan({ ...plan, weeks: [...plan.weeks, parsed.data] }, "Weekly section added")) setModal("");
  }
  function activate(plan: Plan) {
    const required = plan.referrals.flatMap((r) => r.indicators.map((i) => r.id + ":" + i.id));
    if (!staff || !allowed(plan.employeeId) || !plan.weeks.length || required.some((id) => !covered(plan, id))) {
      setError("Add at least one week and cover every referred indicator before activation.");
      return;
    }
    if (plan.weeks.some((w) => w.start < today())) {
      setError("Weekly periods must start on or after today.");
      return;
    }
    updatePlan(
      { ...plan, state: "Active", needsReview: false, activatedAt: new Date().toISOString() },
      "Plan activated",
    );
  }
  function progress(event: FormEvent<HTMLFormElement>, plan: Plan, week: Week) {
    const v = fields(event);
    if (
      role !== "Employee" ||
      plan.employeeId !== employeeId ||
      plan.state !== "Active" ||
      week.state !== "Pending" ||
      week.start > today()
    )
      return;
    const actual = Number(v.actual),
      submit = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "submit";
    if (!v.actual.trim() || !Number.isFinite(actual) || actual < 0 || !v.update.trim()) {
      setError("Enter a nonnegative actual result and progress update.");
      return;
    }
    if (submit && today() < week.end) {
      setError("Final submission opens on " + week.end + ". Save a draft during the week.");
      return;
    }
    updatePlan(
      {
        ...plan,
        weeks: plan.weeks.map((w) =>
          w.id === week.id
            ? {
                ...w,
                actual,
                update: v.update.trim(),
                evidence: v.evidence,
                state: submit ? "Submitted" : "Pending",
                submissions: submit
                  ? [
                      ...(w.submissions || []),
                      { actual, update: v.update.trim(), evidence: v.evidence, at: new Date().toISOString() },
                    ]
                  : w.submissions,
              }
            : w,
        ),
      },
      submit ? "Weekly update submitted" : "Weekly draft saved",
    );
  }
  function assess(event: FormEvent<HTMLFormElement>, plan: Plan, week: Week) {
    const v = fields(event),
      missed = week.state === "Pending" && week.end < today();
    if (
      !staff ||
      !allowed(plan.employeeId) ||
      plan.state !== "Active" ||
      (week.state !== "Submitted" && !missed) ||
      week.end > today()
    )
      return;
    const actual = Number(v.actual);
    if (
      !v.actual.trim() ||
      !Number.isFinite(actual) ||
      actual < 0 ||
      !v.remarks.trim() ||
      (missed && !v.missedReason?.trim())
    ) {
      setError("Enter a verified actual result, assessment remarks and a reason for a missing submission.");
      return;
    }
    updatePlan(
      {
        ...plan,
        weeks: plan.weeks.map((w) =>
          w.id === week.id
            ? {
                ...w,
                state: "Assessed",
                actual,
                assessment: v.remarks.trim(),
                missedReason: missed ? v.missedReason.trim() : undefined,
                met: w.direction === "Lower" ? actual <= w.target : actual >= w.target,
              }
            : w,
        ),
      },
      missed ? "Missed submission assessed" : "Week assessed",
    );
  }
  function returnWeek(event: FormEvent<HTMLFormElement>, plan: Plan, week: Week) {
    const v = fields(event);
    if (
      !staff ||
      !allowed(plan.employeeId) ||
      plan.state !== "Active" ||
      week.state !== "Submitted" ||
      !v.reason.trim()
    )
      return;
    const submissions = week.submissions?.length
      ? week.submissions
      : week.actual !== undefined
        ? [{ actual: week.actual, update: week.update || "", evidence: week.evidence, at: new Date().toISOString() }]
        : [];
    updatePlan(
      {
        ...plan,
        weeks: plan.weeks.map((w) =>
          w.id === week.id ? { ...w, state: "Pending", returnReason: v.reason.trim(), submissions } : w,
        ),
      },
      "Week returned for correction",
    );
  }
  function exclude(event: FormEvent<HTMLFormElement>, plan: Plan, indicatorId: string) {
    const v = fields(event);
    if (
      !staff ||
      !allowed(plan.employeeId) ||
      ["Completed", "Completed with Exclusions", "Not Met", "Cancelled"].includes(plan.state) ||
      !v.reason.trim() ||
      plan.weeks.some((w) => w.indicatorId === indicatorId)
    )
      return;
    updatePlan(
      {
        ...plan,
        exclusions: [
          ...(plan.exclusions || []).filter((x) => x.indicatorId !== indicatorId),
          { indicatorId, reason: v.reason.trim() },
        ],
      },
      "Indicator excluded",
    );
  }

  const draftNotice = data.notices.find((n) => n.id === editingNotice);
  const selectEmployee = (
    <label>
      Employee
      <select
        name="employeeId"
        required
        defaultValue={modal === "notice" ? draftNotice?.employeeId || selectedNteEmployee || "" : ""}
      >
        <option value="" disabled>
          Select employee
        </option>
        {scoped.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
    </label>
  );
  const visible = (id: string, content: string) =>
    allowed(id) && (name(id) + " " + content).toLowerCase().includes(query.toLowerCase());
  const journals = staff
    ? data.journals.filter(
        (j) =>
          visible(j.employeeId, j.title + " " + j.body) &&
          (journalType === "All types" || (j.type || "Performance Observation") === journalType) &&
          (!fromDate || (j.date || j.createdAt.slice(0, 10)) >= fromDate) &&
          (!toDate || (j.date || j.createdAt.slice(0, 10)) <= toDate),
      )
    : [];
  const notices = data.notices.filter(
    (n) =>
      visible(n.employeeId, n.subject) &&
      (hr || n.status !== "Draft") &&
      (!staff || n.employeeId === selectedNteEmployee) &&
      (noticeStatus === "All records" ||
        (noticeStatus === "Active" && ["Issued", "Responded"].includes(n.status)) ||
        (noticeStatus === "Past" && ["Closed", "Cancelled"].includes(n.status)) ||
        (noticeStatus === "Draft" && n.status === "Draft")),
  );
  const plans = data.plans.filter((p) => visible(p.employeeId, p.title));
  useEffect(() => {
    if (role === "Employee" && tab === "NTE Files" && notices.some((n) => !n.readAt)) {
      const ids = new Set(notices.filter((n) => !n.readAt).map((n) => n.id));
      save(
        { ...data, notices: data.notices.map((n) => (ids.has(n.id) ? { ...n, readAt: new Date().toISOString() } : n)) },
        "Read by employee",
      );
    }
  }, [role, employeeId, companyId, tab, data]);
  return (
    <section>
      <div className="heading">
        <div>
          <h1>{tab === "PIP" ? "Performance Improvement Plans" : "202 Files"}</h1>
          <p>Employee journals, notices and improvement planning</p>
        </div>
      </div>
      <div className="toolbar" role="tablist" aria-label="Employee records">
        {(staff ? ["Journal Entries", "NTE Files", "PIP"] : ["NTE Files", "PIP"]).map((t) => (
          <Button
            key={t}
            role="tab"
            aria-selected={t === tab}
            variant={t === tab ? "default" : "outline"}
            onClick={() => {
              setTab(t);
              setError("");
            }}
          >
            {t}
          </Button>
        ))}
      </div>
      <div className="toolbar">
        <input
          type="search"
          aria-label="Search records"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search employee or record"
        />
        {staff && tab === "Journal Entries" && <Button onClick={() => setModal("journal")}>Add journal entry</Button>}
        {hr && tab === "NTE Files" && (
          <Button
            onClick={() => {
              setEditingNotice("");
              setModal("notice");
            }}
          >
            Create NTE
          </Button>
        )}
        {staff && tab === "PIP" && <Button onClick={() => setModal("plan")}>Enroll in PIP</Button>}
      </div>
      {error && <p role="alert">{error}</p>}
      {staff && tab === "Journal Entries" && (
        <div>
          <div className="toolbar">
            <label>
              Filter entry type
              <select value={journalType} onChange={(event) => setJournalType(event.target.value)}>
                <option>All types</option>
                {[
                  ...new Set([
                    ...entryTypes,
                    ...data.journals.map((j) => j.type).filter((value): value is string => !!value),
                  ]),
                ].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              Journal from date
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </label>
            <label>
              Journal to date
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </label>
          </div>
          {journals.length === 0 && <p>No journal entries in your scope.</p>}
          {journals.map((j) => (
            <article className="panel panelhead" key={j.id}>
              <h2>{j.title}</h2>
              <p>
                {name(j.employeeId)} · {j.date || j.createdAt.slice(0, 10)} · {j.author} ·{" "}
                {j.type || "Performance Observation"}
                {j.cycle ? " · " + j.cycle : ""}
              </p>
              <p style={{ whiteSpace: "pre-wrap" }}>{j.body}</p>
              {history(j.history)}
            </article>
          ))}
        </div>
      )}
      {tab === "NTE Files" && (
        <div>
          {staff && !selectedNteEmployee ? (
            <div className="panel tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Active NTEs</th>
                    <th>Past NTEs</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {scoped
                    .filter((employee) =>
                      (employee.id + " " + employee.name + " " + employee.department)
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map((employee) => {
                      const records = data.notices.filter(
                        (n) => n.employeeId === employee.id && (hr || n.status !== "Draft"),
                      );
                      return (
                        <tr key={employee.id}>
                          <td>
                            {employee.name}
                            <small>{employee.id}</small>
                          </td>
                          <td>{employee.department}</td>
                          <td>{records.filter((n) => ["Issued", "Responded"].includes(n.status)).length}</td>
                          <td>{records.filter((n) => ["Closed", "Cancelled"].includes(n.status)).length}</td>
                          <td>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setNteEmployee(employee.id);
                                setQuery("");
                                setNoticeStatus("All records");
                              }}
                            >
                              View NTEs for {employee.name}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {scoped.length === 0 && <p>No employees in your access scope.</p>}
            </div>
          ) : (
            <div className="toolbar">
              {staff && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setNteEmployee("");
                      setQuery("");
                    }}
                  >
                    Employee masterlist
                  </Button>
                  <h2>{name(selectedNteEmployee)} · NTE Files</h2>
                </>
              )}
              <label>
                Record status
                <select value={noticeStatus} onChange={(event) => setNoticeStatus(event.target.value)}>
                  {["All records", "Active", "Past", ...(hr ? ["Draft"] : [])].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {(!staff || selectedNteEmployee) && notices.length === 0 && <p>No NTE records in your scope.</p>}
          {notices.map((n) => (
            <article className="panel panelhead" key={n.id}>
              <h2>{n.subject}</h2>
              <p>
                {name(n.employeeId)} · {n.category}
              </p>
              <strong>{n.status}</strong>
              {n.incidentDate && <p>Incident date: {n.incidentDate}</p>}
              {n.reference && <p>Reference: {n.reference}</p>}
              {n.issuedAt && <p>Issued: {n.issuedAt}</p>}
              {n.readAt && <p>Read: {n.readAt}</p>}
              {n.respondedAt && <p>Responded: {n.respondedAt}</p>}
              {n.closedAt && <p>Closed: {n.closedAt}</p>}
              {n.cancelledAt && <p>Cancelled: {n.cancelledAt}</p>}
              {n.cancelReason && <p>{n.cancelReason}</p>}
              <p>
                Explanation due {n.deadline}
                {n.status === "Issued" && n.deadline < today() ? " · Overdue" : ""}
              </p>
              <p style={{ whiteSpace: "pre-wrap" }}>{n.body}</p>
              {n.explanation && (
                <div>
                  <h3>Employee explanation</h3>
                  <p>{n.explanation}</p>
                </div>
              )}
              {history(n.history)}
              {n.closure && (
                <div>
                  <h3>Outcome</h3>
                  <p>{n.closure}</p>
                  {n.earlyReason && <p>Early closure exception: {n.earlyReason}</p>}
                </div>
              )}
              {hr && n.status === "Draft" && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingNotice(n.id);
                      setModal("notice");
                    }}
                  >
                    Edit draft
                  </Button>
                  <Button
                    onClick={() => {
                      if (n.deadline < today()) {
                        setError("Update the explanation deadline before issuing this draft.");
                        return;
                      }
                      save({
                        ...data,
                        notices: data.notices.map((item) =>
                          item.id === n.id ? { ...item, status: "Issued", issuedAt: new Date().toISOString() } : item,
                        ),
                      });
                    }}
                  >
                    Issue NTE
                  </Button>
                </>
              )}
              {role === "Employee" && n.employeeId === employeeId && n.status === "Issued" && (
                <form
                  onSubmit={(event) => {
                    const v = fields(event);
                    if (!v.explanation.trim()) {
                      setError("Enter your explanation.");
                      return;
                    }
                    save({
                      ...data,
                      notices: data.notices.map((item) =>
                        item.id === n.id
                          ? {
                              ...item,
                              status: "Responded",
                              respondedAt: new Date().toISOString(),
                              explanation: v.explanation.trim(),
                            }
                          : item,
                      ),
                    });
                  }}
                >
                  <label>
                    Your explanation
                    <textarea name="explanation" required maxLength={20000} />
                  </label>
                  <p>Submitted explanations become read-only.</p>
                  <Button type="submit">Submit explanation</Button>
                </form>
              )}
              {hr && ["Issued", "Responded"].includes(n.status) && (
                <form
                  onSubmit={(event) => {
                    const v = fields(event);
                    if (
                      !v.closure.trim() ||
                      (n.status === "Issued" && n.deadline >= today() && !v.earlyReason?.trim())
                    ) {
                      setError(
                        "Enter the closure outcome and a separate exception reason when the response window is open.",
                      );
                      return;
                    }
                    save({
                      ...data,
                      notices: data.notices.map((item) =>
                        item.id === n.id
                          ? {
                              ...item,
                              status: "Closed",
                              closedAt: new Date().toISOString(),
                              closure: v.closure.trim(),
                              earlyReason: v.earlyReason?.trim(),
                            }
                          : item,
                      ),
                    });
                  }}
                >
                  <label>
                    Closure outcome
                    <textarea name="closure" required maxLength={5000} />
                  </label>
                  {n.status === "Issued" && n.deadline >= today() && (
                    <label>
                      Early closure exception reason
                      <textarea name="earlyReason" required maxLength={5000} />
                    </label>
                  )}
                  <Button type="submit">Close NTE</Button>
                </form>
              )}
              {hr && !["Closed", "Cancelled"].includes(n.status) && (
                <form
                  onSubmit={(event) => {
                    const v = fields(event);
                    if (!v.reason.trim()) return;
                    save(
                      {
                        ...data,
                        notices: data.notices.map((item) =>
                          item.id === n.id
                            ? {
                                ...item,
                                status: "Cancelled",
                                cancelReason: v.reason.trim(),
                                cancelledAt: new Date().toISOString(),
                              }
                            : item,
                        ),
                      },
                      "NTE cancelled",
                    );
                  }}
                >
                  <label>
                    Cancellation reason
                    <textarea name="reason" required maxLength={5000} />
                  </label>
                  <Button type="submit" variant="outline">
                    Cancel NTE
                  </Button>
                </form>
              )}
            </article>
          ))}
        </div>
      )}
      {tab === "PIP" && (
        <div>
          {plans.length === 0 && <p>No improvement plans in your scope.</p>}
          {plans.map((plan) => (
            <article className="panel panelhead" key={plan.id}>
              <h2>{plan.title}</h2>
              <p>
                {name(plan.employeeId)} · {plan.origin}
              </p>
              <strong>{plan.state}</strong>
              <p>{plan.reason}</p>
              {plan.acknowledgedAt && <p>Acknowledged on {plan.acknowledgedAt}</p>}
              {role === "Employee" && plan.state === "Active" && !plan.acknowledgedAt && (
                <Button
                  onClick={() => updatePlan({ ...plan, acknowledgedAt: new Date().toISOString() }, "Plan acknowledged")}
                >
                  Acknowledge plan
                </Button>
              )}
              {plan.needsReview && <p>Evaluation referrals need staff review.</p>}
              {plan.referrals.map((r) => (
                <p key={r.id}>
                  Evaluation: {r.cycleName}.{" "}
                  {r.indicators.map((i) => `${i.name}: ${i.actual} / ${i.target} (${i.direction})`).join("; ")}
                </p>
              ))}
              {plan.referrals.flatMap((r) =>
                r.indicators.map((i) => {
                  const sourceId = r.id + ":" + i.id,
                    excluded = plan.exclusions?.find((x) => x.indicatorId === sourceId);
                  return (
                    <section key={sourceId}>
                      {excluded ? (
                        <div>
                          <p>{i.name}: Excluded</p>
                          <p>{excluded.reason}</p>
                          {staff && ["Draft", "Awaiting Planning", "Active"].includes(plan.state) && (
                            <Button
                              variant="outline"
                              onClick={() =>
                                updatePlan(
                                  { ...plan, exclusions: plan.exclusions?.filter((x) => x.indicatorId !== sourceId) },
                                  "Excluded indicator restored",
                                )
                              }
                            >
                              Restore {i.name}
                            </Button>
                          )}
                        </div>
                      ) : (
                        staff &&
                        ["Draft", "Awaiting Planning", "Active"].includes(plan.state) &&
                        !plan.weeks.some((w) => w.indicatorId === sourceId) && (
                          <form onSubmit={(event) => exclude(event, plan, sourceId)}>
                            <label>
                              Exclusion reason: {i.name}
                              <textarea name="reason" required />
                            </label>
                            <Button type="submit" variant="outline">
                              Exclude {i.name}
                            </Button>
                          </form>
                        )
                      )}
                    </section>
                  );
                }),
              )}
              {staff && ["Draft", "Awaiting Planning", "Active"].includes(plan.state) && (
                <div className="toolbar">
                  <Button
                    onClick={() => {
                      setSelectedPlan(plan.id);
                      setModal("week");
                    }}
                  >
                    Add week
                  </Button>
                  {plan.state !== "Active" && <Button onClick={() => activate(plan)}>Activate plan</Button>}
                </div>
              )}
              {plan.weeks.map((week, index) => (
                <section className="panelhead" key={week.id}>
                  <h3>
                    Week {index + 1}: {week.goal}
                  </h3>
                  <p>
                    {week.start} to {week.end} · {week.direction === "Higher" ? "At least" : "At most"} {week.target}{" "}
                    {week.unit}
                  </p>
                  <p>Actions: {week.actions}</p>
                  <p>Support: {week.support}</p>
                  <p>{week.state}</p>
                  {week.update && (
                    <p>
                      Progress: {week.update} · Actual: {week.actual}
                    </p>
                  )}
                  {week.evidence && <p>Evidence: {week.evidence}</p>}
                  {week.followUpFor && (
                    <p>Follow-up to week {plan.weeks.findIndex((w) => w.id === week.followUpFor) + 1}</p>
                  )}
                  {week.returnReason && <p>Correction requested: {week.returnReason}</p>}
                  {week.missedReason && <p>Missing submission: {week.missedReason}</p>}
                  {week.assessment && (
                    <p>
                      Assessment: {week.met ? "Met" : "Needs Improvement"}. {week.assessment}
                    </p>
                  )}
                  {role === "Employee" &&
                    plan.state === "Active" &&
                    week.state === "Pending" &&
                    week.start <= today() && (
                      <form onSubmit={(event) => progress(event, plan, week)}>
                        <label>
                          Actual result
                          <input type="number" min="0" step="any" name="actual" required defaultValue={week.actual} />
                        </label>
                        <label>
                          Progress update
                          <textarea name="update" required defaultValue={week.update} />
                        </label>
                        <label>
                          Evidence
                          <textarea name="evidence" defaultValue={week.evidence} />
                        </label>
                        <Button type="submit" value="draft">
                          Save progress draft
                        </Button>
                        <Button type="submit" value="submit">
                          Submit progress
                        </Button>
                      </form>
                    )}
                  {staff &&
                    plan.state === "Active" &&
                    (week.state === "Submitted" || (week.state === "Pending" && week.end < today())) &&
                    week.end <= today() && (
                      <form onSubmit={(event) => assess(event, plan, week)}>
                        <label>
                          Verified actual
                          <input type="number" min="0" step="any" name="actual" defaultValue={week.actual} required />
                        </label>
                        <label>
                          Assessment remarks
                          <textarea name="remarks" required />
                        </label>
                        {week.state === "Pending" && (
                          <label>
                            Missed submission reason
                            <textarea name="missedReason" required />
                          </label>
                        )}
                        <Button type="submit">
                          {week.state === "Pending" ? "Assess missed submission" : "Assess week"}
                        </Button>
                      </form>
                    )}
                  {staff && plan.state === "Active" && week.state === "Submitted" && (
                    <form onSubmit={(event) => returnWeek(event, plan, week)}>
                      <label>
                        Correction reason
                        <textarea name="reason" required />
                      </label>
                      <Button type="submit" variant="outline">
                        Return for correction
                      </Button>
                    </form>
                  )}
                </section>
              ))}
              {staff && ["Draft", "Awaiting Planning", "Active"].includes(plan.state) && plan.needsReview && (
                <form
                  onSubmit={(event) => {
                    const v = fields(event);
                    if (
                      !v.note.trim() ||
                      !plan.referrals.every((r) => r.indicators.every((i) => covered(plan, r.id + ":" + i.id)))
                    ) {
                      setError("Cover or exclude every referred indicator and enter a review note.");
                      return;
                    }
                    updatePlan(
                      { ...plan, needsReview: false, reviewNote: v.note.trim() },
                      "Evaluation referrals reviewed",
                    );
                  }}
                >
                  <label>
                    Referral review note
                    <textarea name="note" required />
                  </label>
                  <Button type="submit">Review referrals</Button>
                </form>
              )}
              {staff &&
                plan.state === "Active" &&
                !plan.needsReview &&
                plan.weeks.length > 0 &&
                plan.weeks.every((w) => w.state === "Assessed" && w.end <= today()) &&
                plan.referrals.every((r) => r.indicators.every((i) => covered(plan, r.id + ":" + i.id))) && (
                  <form
                    onSubmit={(event) => {
                      const v = fields(event);
                      if (!v.closure.trim()) {
                        setError("Enter a completion note.");
                        return;
                      }
                      updatePlan(
                        {
                          ...plan,
                          state: planMet(plan)
                            ? plan.exclusions?.length
                              ? "Completed with Exclusions"
                              : "Completed"
                            : "Not Met",
                          closure: v.closure.trim(),
                          closedAt: new Date().toISOString(),
                        },
                        "Plan completed",
                      );
                    }}
                  >
                    <label>
                      Completion note
                      <textarea name="closure" required />
                    </label>
                    <Button type="submit">Complete plan</Button>
                  </form>
                )}
              {plan.closure && <p>{plan.closure}</p>}
              {plan.cancelReason && <p>{plan.cancelReason}</p>}
              {staff && ["Draft", "Awaiting Planning", "Active"].includes(plan.state) && (
                <form
                  onSubmit={(event) => {
                    const v = fields(event);
                    if (!v.reason.trim()) return;
                    updatePlan(
                      {
                        ...plan,
                        state: "Cancelled",
                        cancelReason: v.reason.trim(),
                        closedAt: new Date().toISOString(),
                      },
                      "Plan cancelled",
                    );
                  }}
                >
                  <label>
                    Cancellation reason
                    <textarea name="reason" required />
                  </label>
                  <Button type="submit" variant="outline">
                    Cancel plan
                  </Button>
                </form>
              )}
              {history(plan.history)}
            </article>
          ))}
        </div>
      )}
      <Dialog
        open={!!modal}
        onOpenChange={(open) => {
          if (!open) setModal("");
        }}
        title={
          modal === "journal"
            ? "Add journal entry"
            : modal === "notice"
              ? "Create NTE"
              : modal === "week"
                ? "Plan a week"
                : "Enroll in PIP"
        }
      >
        <form onSubmit={modal === "week" ? addWeek : create}>
          {modal !== "week" && selectEmployee}
          {modal === "journal" && (
            <>
              <label>
                Entry date
                <input name="date" type="date" required defaultValue={today()} max={today()} />
              </label>
              <label>
                Entry type
                <select name="type" defaultValue="Performance Observation">
                  {entryTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Related evaluation cycle
                <input name="cycle" maxLength={200} />
              </label>
              <label>
                Journal title
                <input name="title" required maxLength={200} />
              </label>
              <label>
                Journal entry
                <textarea name="body" required maxLength={20000} />
              </label>
            </>
          )}
          {modal === "notice" && (
            <>
              <label>
                Category
                <select name="category" defaultValue={draftNotice?.category}>
                  {["Attendance", "Conduct", "Performance", "Policy Compliance", "Other"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Incident date
                <input name="incidentDate" type="date" max={today()} defaultValue={draftNotice?.incidentDate} />
              </label>
              <label>
                Reference
                <input name="reference" maxLength={200} defaultValue={draftNotice?.reference} />
              </label>
              <label>
                Subject
                <input name="subject" required maxLength={200} defaultValue={draftNotice?.subject} />
              </label>
              <label>
                Notice body
                <textarea name="body" required maxLength={20000} defaultValue={draftNotice?.body} />
              </label>
              <label>
                Explanation deadline
                <input name="deadline" type="date" required min={today()} defaultValue={draftNotice?.deadline} />
              </label>
            </>
          )}
          {modal === "plan" && (
            <>
              <label>
                Plan title
                <input name="title" required maxLength={200} />
              </label>
              <label>
                Enrollment reason
                <textarea name="reason" required />
              </label>
            </>
          )}
          {modal === "week" && (
            <>
              <label>
                Source indicator
                <select name="indicatorId">
                  <option value="custom">Custom measurable goal</option>
                  {data.plans
                    .find((p) => p.id === selectedPlan)
                    ?.referrals.flatMap((r) =>
                      r.indicators.map((i) => (
                        <option value={r.id + ":" + i.id} key={r.id + ":" + i.id}>
                          {i.name} · {r.cycleName}
                        </option>
                      )),
                    )}
                </select>
              </label>
              <label>
                Follow-up to week
                <select name="followUpFor">
                  <option value="">No follow-up link</option>
                  {data.plans
                    .find((p) => p.id === selectedPlan)
                    ?.weeks.map((week, index) => (
                      <option key={week.id} value={week.id}>
                        Week {index + 1}: {week.goal}
                      </option>
                    ))}
                </select>
              </label>
              {data.plans.find((p) => p.id === selectedPlan)?.state === "Active" && (
                <label>
                  Extension reason
                  <textarea name="extensionReason" required />
                </label>
              )}
              <label>
                Weekly goal
                <input name="goal" required />
              </label>
              <label>
                Actions
                <textarea name="actions" required />
              </label>
              <label>
                Support
                <input name="support" required />
              </label>
              <label>
                Target
                <input name="target" type="number" min="0" step="any" required />
              </label>
              <label>
                Unit
                <input name="unit" required />
              </label>
              <label>
                Target direction
                <select name="direction">
                  <option>Higher</option>
                  <option>Lower</option>
                </select>
              </label>
              <label>
                Week start
                <input name="start" type="date" required min={today()} />
              </label>
              <p>Each week covers seven days.</p>
            </>
          )}
          {error && <p role="alert">{error}</p>}
          <Button type="submit">
            {modal === "journal"
              ? "Save entry"
              : modal === "notice"
                ? "Save draft"
                : modal === "week"
                  ? "Save week"
                  : "Create plan"}
          </Button>
        </form>
      </Dialog>
    </section>
  );
}
