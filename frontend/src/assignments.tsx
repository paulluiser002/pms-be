import { workflowToday as today } from "./workflow-clock";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import type { Employee } from "./employee-directory";
import { Button } from "./components/ui/button";
import { Dialog } from "./components/ui/dialog";

const key = "pms-react-manager-assignments-v1";
const employeeKey = "pms-react-employees-v1";
const text = z.string().trim().min(1);
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) => !Number.isNaN(Date.parse(value)) && new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value,
  );
const entrySchema = z.object({
  id: text,
  employeeId: text,
  managerId: text,
  employeeName: text,
  managerName: text,
  effective: calendarDate,
  companyId: z.string().optional(),
  status: z.enum(["Pending", "Blocked", "Applied", "Cancelled"]),
  error: z.string().optional(),
  history: z.array(z.object({ action: text, actor: text, at: text, reason: z.string().optional() })),
});
const storeSchema = z.object({ assignments: z.array(entrySchema) });
type Entry = z.infer<typeof entrySchema>;

const pending = (entry: Entry) => entry.status === "Pending" || entry.status === "Blocked";
function load() {
  const raw = localStorage.getItem(key);
  return raw ? storeSchema.parse(JSON.parse(raw)).assignments : [];
}
function record(entry: Entry, action: string, reason = "", actor = "HR Administrator"): Entry {
  return {
    ...entry,
    history: [...entry.history, { action, actor, at: new Date().toISOString(), ...(reason ? { reason } : {}) }],
  };
}
function graph(employees: Employee[]) {
  return Object.fromEntries(
    employees.map((e) => [
      e.id,
      employees.find((manager) => manager.id === e.manager)?.id ||
        employees.find((manager) => manager.name === e.manager)?.id ||
        "",
    ]),
  );
}
function cycleError(reporting: Record<string, string>) {
  for (const id of Object.keys(reporting)) {
    const seen = new Set<string>();
    let current = id;
    while (current) {
      if (seen.has(current)) return "The assignments would create a reporting cycle.";
      seen.add(current);
      current = reporting[current];
    }
  }
  return "";
}
function entryError(entry: Entry, employees: Employee[]) {
  const employee = employees.find((e) => e.id === entry.employeeId),
    manager = employees.find((e) => e.id === entry.managerId);
  if (!employee || !manager) return "The employee or manager is no longer in the directory.";
  if (entry.employeeId === entry.managerId) return "An employee cannot be their own manager.";
  if (employees.filter((e) => e.name === manager.name).length > 1)
    return "The manager name is not unique. Update the directory before assigning this manager.";
  return "";
}
function timelineError(entries: Entry[], employees: Employee[]) {
  const reporting = graph(employees);
  for (const day of [...new Set(entries.filter(pending).map((entry) => entry.effective))].sort()) {
    const group = entries.filter((e) => pending(e) && e.effective === day),
      seen = new Set<string>();
    for (const entry of group) {
      const error = entryError(entry, employees);
      if (error) return error;
      if (seen.has(entry.employeeId))
        return "Cancel the existing assignment for this employee and effective date before replacing it.";
      seen.add(entry.employeeId);
      reporting[entry.employeeId] = entry.managerId;
    }
    const error = cycleError(reporting);
    if (error) return error + " Review the projected hierarchy on " + day + ".";
  }
  return "";
}
function processDue(entries: Entry[], employees: Employee[]) {
  let next = entries.map((entry) => ({ ...entry, history: [...entry.history] })),
    directory = employees.map((e) => ({ ...e })),
    changed = false;
  const due = next.filter((entry) => pending(entry) && entry.effective <= today());
  for (const day of [...new Set(due.map((entry) => entry.effective))].sort()) {
    const group = due.filter((entry) => entry.effective === day),
      reporting = graph(directory),
      seen = new Set<string>();
    let error = "";
    for (const entry of group) {
      error = error || entryError(entry, directory);
      if (seen.has(entry.employeeId)) error = "Multiple assignments have the same employee and effective date.";
      seen.add(entry.employeeId);
      if (
        next.some(
          (other) =>
            other.employeeId === entry.employeeId && other.status === "Applied" && other.effective > entry.effective,
        )
      )
        error = "A newer reporting assignment is already effective.";
      reporting[entry.employeeId] = entry.managerId;
    }
    error = error || cycleError(reporting);
    for (const entry of group) {
      if (error) {
        if (entry.status !== "Blocked" || entry.error !== error) {
          next = next.map((e) =>
            e.id === entry.id ? record({ ...e, status: "Blocked", error }, "Blocked", error, "System") : e,
          );
          changed = true;
        }
      } else {
        next = next.map((e) =>
          e.id === entry.id ? record({ ...e, status: "Applied", error: undefined }, "Applied", "", "System") : e,
        );
        const manager = directory.find((e) => e.id === entry.managerId)!;
        directory = directory.map((e) => (e.id === entry.employeeId ? { ...e, manager: manager.name } : e));
        changed = true;
      }
    }
  }
  return { entries: next, employees: directory, changed };
}
function persist(entries: Entry[], employees?: Employee[]) {
  load();
  storeSchema.parse({ assignments: entries });
  const oldAssignments = localStorage.getItem(key),
    oldEmployees = localStorage.getItem(employeeKey);
  let written = false;
  try {
    localStorage.setItem(key, JSON.stringify({ assignments: entries }));
    written = true;
    if (employees) localStorage.setItem(employeeKey, JSON.stringify(employees));
  } catch (error) {
    if (written) {
      if (oldAssignments === null) localStorage.removeItem(key);
      else localStorage.setItem(key, oldAssignments);
      if (employees) {
        if (oldEmployees === null) localStorage.removeItem(employeeKey);
        else localStorage.setItem(employeeKey, oldEmployees);
      }
    }
    throw error;
  }
}
export function processDueManagerAssignments(employees: Employee[]): Employee[] {
  let entries = load(),
    directory = employees,
    changed = false;
  for (const company of new Set(entries.filter(pending).map((entry) => entry.companyId || "mayon"))) {
    const selected = entries.filter((entry) => (entry.companyId || "mayon") === company),
      roster = directory.filter((employee) => (employee.companyId || "mayon") === company),
      result = processDue(selected, roster);
    if (!result.changed) continue;
    changed = true;
    entries = entries.map((entry) => result.entries.find((next) => next.id === entry.id) || entry);
    directory = directory.map((employee) => result.employees.find((next) => next.id === employee.id) || employee);
  }
  if (changed) persist(entries, JSON.stringify(directory) !== JSON.stringify(employees) ? directory : undefined);
  return directory;
}

export function Assignments({
  employees,
  onChange,
  companyId = "mayon",
}: {
  employees: Employee[];
  onChange: (employees: Employee[]) => void;
  companyId?: string;
}) {
  const [initial] = useState(() => {
    try {
      return { entries: load(), error: "" };
    } catch {
      return { entries: [], error: "Saved assignment records are invalid. Original browser data is preserved." };
    }
  });
  const [entries, setEntries] = useState(initial.entries),
    [error, setError] = useState(initial.error),
    [open, setOpen] = useState(false);
  const roster = employees.filter((e) => (e.companyId || "mayon") === companyId);
  const selectedEntries = entries.filter((e) => (e.companyId || "mayon") === companyId);
  function commit(next: Entry[], directory?: Employee[]) {
    let oldAssignments: string | null = null,
      oldEmployees: string | null = null,
      written = false;
    try {
      load();
      storeSchema.parse({ assignments: next });
      oldAssignments = localStorage.getItem(key);
      oldEmployees = localStorage.getItem(employeeKey);
      localStorage.setItem(key, JSON.stringify({ assignments: next }));
      written = true;
      if (directory) localStorage.setItem(employeeKey, JSON.stringify(directory));
      if (directory) onChange(directory);
      setEntries(next);
      setError("");
      return true;
    } catch {
      if (written) {
        try {
          if (oldAssignments === null) localStorage.removeItem(key);
          else localStorage.setItem(key, oldAssignments);
          if (directory) {
            if (oldEmployees === null) localStorage.removeItem(employeeKey);
            else localStorage.setItem(employeeKey, oldEmployees);
          }
        } catch {
          setError("Unable to restore browser storage. Reload before changing assignments.");
          return false;
        }
      }
      setError("Unable to save assignments. Existing records are preserved. Check browser storage.");
      return false;
    }
  }
  useEffect(() => {
    function applyDue() {
      const result = processDue(selectedEntries, roster);
      if (result.changed) {
        const combined = entries.map((entry) => result.entries.find((e) => e.id === entry.id) || entry),
          directory = employees.map((e) => result.employees.find((person) => person.id === e.id) || e);
        commit(combined, JSON.stringify(directory) !== JSON.stringify(employees) ? directory : undefined);
      }
    }
    applyDue();
    const interval = window.setInterval(applyDue, 60000);
    window.addEventListener("focus", applyDue);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", applyDue);
    };
  }, [entries, employees, companyId]);
  useEffect(() => setOpen(false), [companyId]);
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Object.fromEntries(new FormData(event.currentTarget)),
      parsed = z.object({ employeeId: text, managerId: text, effective: calendarDate }).safeParse(value);
    if (!parsed.success || parsed.data.effective < today()) {
      setError("Choose an employee, manager and valid effective date on or after today.");
      return;
    }
    const employee = roster.find((e) => e.id === parsed.data.employeeId),
      manager = roster.find((e) => e.id === parsed.data.managerId);
    if (!employee || !manager) {
      setError("Choose an existing employee and manager.");
      return;
    }
    const proposal = record(
      {
        ...parsed.data,
        companyId,
        id: crypto.randomUUID(),
        employeeName: employee.name,
        managerName: manager.name,
        status: "Pending",
        history: [],
      },
      parsed.data.effective > today() ? "Scheduled" : "Requested",
    );
    const next = [...selectedEntries, proposal],
      validation = timelineError(next, roster);
    if (validation) {
      setError(validation);
      return;
    }
    const processed = processDue(next, roster);
    const combined = [...entries.filter((entry) => (entry.companyId || "mayon") !== companyId), ...processed.entries],
      directory = employees.map((e) => processed.employees.find((person) => person.id === e.id) || e);
    if (commit(combined, processed.changed ? directory : undefined)) setOpen(false);
  }
  function cancel(entry: Entry) {
    const next = entries.map((e) =>
      e.id === entry.id && pending(e) ? record({ ...e, status: "Cancelled", error: undefined }, "Cancelled") : e,
    );
    const validation = timelineError(
      next.filter((e) => (e.companyId || "mayon") === companyId),
      roster,
    );
    if (validation) {
      setError("Cancelling this assignment would invalidate another scheduled hierarchy. " + validation);
      return;
    }
    commit(next);
  }
  return (
    <section className="panel">
      <div className="panelhead">
        <div>
          <h2>Reporting assignments</h2>
          <p>Schedule manager changes and review reporting history. Dates follow Asia/Manila.</p>
        </div>
        <Button
          onClick={() => {
            setError(initial.error);
            setOpen(true);
          }}
        >
          Assign manager
        </Button>
      </div>
      {error && !open && <p role="alert">{error}</p>}
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Manager</th>
              <th>Effective date</th>
              <th>Status</th>
              <th>History</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {selectedEntries
              .slice()
              .reverse()
              .map((entry) => (
                <tr key={entry.id}>
                  <td>{employees.find((e) => e.id === entry.employeeId)?.name || entry.employeeName}</td>
                  <td>{employees.find((e) => e.id === entry.managerId)?.name || entry.managerName}</td>
                  <td>{entry.effective}</td>
                  <td>
                    {entry.status}
                    {entry.error && <small>{entry.error}</small>}
                  </td>
                  <td>
                    <details>
                      <summary>Assignment history</summary>
                      <ol>
                        {entry.history.map((item, index) => (
                          <li key={index}>
                            {item.action} · {item.actor} · {item.at}
                            {item.reason && <p>{item.reason}</p>}
                          </li>
                        ))}
                      </ol>
                    </details>
                  </td>
                  <td>
                    {pending(entry) && (
                      <Button variant="outline" onClick={() => cancel(entry)}>
                        Cancel assignment
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {selectedEntries.length === 0 && <p>No manager assignments recorded.</p>}
      </div>
      <Dialog open={open} onOpenChange={setOpen} title="Assign manager">
        <form onSubmit={save}>
          <label>
            Employee
            <select name="employeeId" required defaultValue="">
              <option value="" disabled>
                Select employee
              </option>
              {roster.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.id})
                </option>
              ))}
            </select>
          </label>
          <label>
            Manager
            <select name="managerId" required defaultValue="">
              <option value="" disabled>
                Select manager
              </option>
              {roster.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.id})
                </option>
              ))}
            </select>
          </label>
          <label>
            Effective date
            <input name="effective" type="date" min={today()} defaultValue={today()} required />
          </label>
          <p>
            Future changes remain pending until their effective date. Current access follows the current reporting
            assignment.
          </p>
          {error && <p role="alert">{error}</p>}
          <Button type="submit">Save assignment</Button>
        </form>
      </Dialog>
    </section>
  );
}
