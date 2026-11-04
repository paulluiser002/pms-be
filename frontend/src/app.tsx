import { useState, useEffect } from "react";
import { DataTransfer } from "./data-transfer";
import { WorkflowClock, workflowToday, workflowDateKey } from "./workflow-clock";
import { ProfileMenu } from "./preferences";
import { Assignments, processDueManagerAssignments } from "./assignments";
import { WorkflowGuide } from "./workflow-guide";
import { Performance, getPerformanceNotifications } from "./performance";
import { Cases } from "./cases";
import { Reporting } from "./reporting";
import { z } from "zod";
import { Button } from "./components/ui/button";
import { Dialog } from "./components/ui/dialog";
import { EmployeeDirectory, type Employee } from "./employee-directory";
const EmployeeSchema = z.object({
  companyId: z.string().default("mayon"),
  id: z.string(),
  name: z.string().trim().min(1),
  title: z.string().trim().min(1),
  department: z.string().trim().min(1),
  manager: z.string(),
});
const key = "pms-react-employees-v1";
const defaults: Employee[] = [
  { id: "EMP-001", name: "Maria Cruz", title: "HR Administrator", department: "Human Resources", manager: "" },
  { id: "MGR-001", name: "Angela Reyes", title: "Manager", department: "Operations", manager: "Maria Cruz" },
  {
    id: "EMP-003",
    name: "Sofia Garcia",
    title: "Marketing Specialist",
    department: "Marketing",
    manager: "Angela Reyes",
  },
];
function load(): Employee[] {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return z.array(EmployeeSchema).parse(JSON.parse(stored));
    const old = localStorage.getItem("people-mvp-v1");
    if (old) {
      const parsed = z
        .object({
          pmsEmployeeCompanies: z.record(z.string(), z.string()).optional(),
          employees: z.array(
            z.tuple([z.string(), z.string(), z.string(), z.string(), z.string(), z.number(), z.string()]),
          ),
        })
        .safeParse(JSON.parse(old));
      if (parsed.success) {
        const imported = parsed.data.employees.map(([id, name, title, department, manager]) => ({
          id,
          name,
          title,
          department,
          manager,
          companyId: parsed.data.pmsEmployeeCompanies?.[id] || "mayon",
        }));
        localStorage.setItem(key, JSON.stringify(imported));
        return imported;
      }
    }
    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  } catch {
    return defaults;
  }
}
export default function App() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [, refreshClock] = useState(0);
  const [mobileNav, setMobileNav] = useState(false);
  const [navQuery, setNavQuery] = useState("");
  const [companyId, setCompanyId] = useState("mayon");
  const [notifications, setNotifications] = useState<
    { id: string; subject: string; employeeId: string; status: string; destination?: string }[]
  >([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  function openNotifications() {
    try {
      const store = z
        .object({
          notices: z.array(
            z.object({ id: z.string(), subject: z.string(), employeeId: z.string(), status: z.string() }),
          ),
        })
        .parse(JSON.parse(localStorage.getItem("pms-react-cases-v1") || '{"notices":[]}'));
      setNotifications([
        ...getPerformanceNotifications(role, identity, companyId).map((n) => ({ ...n, destination: "Performance" })),
        ...store.notices.filter(
          (n) =>
            n.status !== "Draft" &&
            companyEmployees.some((e) => e.id === n.employeeId) &&
            (role === "HR Administrator" ||
              (role === "Employee" && n.employeeId === identity) ||
              (role === "Manager" &&
                employees.some(
                  (e) => e.id === n.employeeId && e.manager === employees.find((m) => m.id === identity)?.name,
                ))),
        ),
      ]);
      setNotificationsOpen(true);
    } catch {
      setError("Unable to read notifications. Existing data remains unchanged.");
    }
  }
  const [editing, setEditing] = useState<Employee | null>(null);
  const [page, setPage] = useState("Dashboard"),
    [identity, setIdentity] = useState("EMP-001"),
    [guide, setGuide] = useState(false);
  const [employees, setEmployees] = useState(() => {
      const roster = load();
      try {
        return processDueManagerAssignments(roster);
      } catch {
        return roster;
      }
    }),
    [role, setRole] = useState("HR Administrator"),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [theme, setTheme] = useState(() => localStorage.getItem("hrdotnet-performance-theme") || "classic");
  const companyEmployees = employees.filter((e) => (e.companyId || "mayon") === companyId);
  useEffect(() => {
    const sync = () => {
      try {
        const next = processDueManagerAssignments(employees);
        if (next !== employees) setEmployees(next);
      } catch {
        setError("Unable to process reporting assignments. Existing records remain unchanged.");
      }
    };
    window.addEventListener("focus", sync);
    const clockChanged = () => {
      sync();
      refreshClock((value) => value + 1);
    };
    window.addEventListener("pms-workflow-clock-changed", clockChanged);
    const timer = setInterval(sync, 60000);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("pms-workflow-clock-changed", clockChanged);
      clearInterval(timer);
    };
  }, [employees]);
  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (role !== "HR Administrator") return;
    const form = new FormData(event.currentTarget);
    const result = EmployeeSchema.safeParse({
      companyId,
      id:
        editing?.id ||
        "EMP-" +
          String(Math.max(0, ...employees.map((e) => Number(e.id.match(/^EMP-(\d+)$/)?.[1]) || 0)) + 1).padStart(
            3,
            "0",
          ),
      ...Object.fromEntries(form),
    });
    if (!result.success) {
      setError("Complete all required fields.");
      return;
    }
    const next = editing ? employees.map((e) => (e.id === editing.id ? result.data : e)) : [...employees, result.data];
    const roster = next.filter((e) => (e.companyId || "mayon") === companyId);
    for (const employee of roster) {
      const visited = new Set<string>();
      let current: Employee | undefined = employee;
      while (current) {
        if (visited.has(current.id)) {
          setError("The reporting relationship creates a cycle.");
          return;
        }
        visited.add(current.id);
        if (!current.manager) break;
        const matches = roster.filter((e) => e.id === current!.manager || e.name === current!.manager);
        if (matches.length !== 1) {
          setError("Select a valid reporting manager in this company.");
          return;
        }
        current = matches[0];
      }
    }
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setEmployees(next);
      setOpen(false);
      setError("");
    } catch {
      setError("Unable to save. Check available browser storage.");
    }
  }
  function changeRole(next: string) {
    setRole(next);
    setIdentity(next === "Employee" ? "EMP-003" : next === "Manager" ? "MGR-001" : "EMP-001");
  }
  function switchTheme() {
    const next = theme === "classic" ? "workspace" : "classic";
    localStorage.setItem("hrdotnet-performance-theme", next);
    setTheme(next);
  }
  return (
    <div className={`app ${theme}`}>
      {mobileNav && (
        <button className="mobile-nav-scrim" aria-label="Dismiss navigation" onClick={() => setMobileNav(false)} />
      )}
      <aside
        className={`legacy-sidebar ${mobileNav ? "mobile-open" : ""}`}
        onKeyDown={(event) => {
          if (event.key === "Escape") setMobileNav(false);
        }}
      >
        <div className="legacy-brand">
          <img src="/hrdotnet-performance-logo.png" alt="HRDotNet Performance" />
          <Button
            className="mobile-nav-toggle"
            variant="outline"
            aria-label={mobileNav ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileNav}
            aria-controls="pms-navigation"
            onClick={() => setMobileNav((open) => !open)}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M3 5h18M3 12h18M3 19h18" />
            </svg>
          </Button>
        </div>
        <div className="legacy-company">
          <b>{companyId === "mayon" ? "MC" : companyId.slice(0, 2).toUpperCase()}</b>
          <label>
            <select
              aria-label="Company"
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value);
                setPage("Employees");
              }}
            >
              {[...new Set(["mayon", ...employees.map((e) => e.companyId || "mayon")])].map((id) => (
                <option key={id} value={id}>
                  {id === "mayon" ? "Mayon Consolidated Inc." : id}
                </option>
              ))}
            </select>
            <small>{companyId === "mayon" ? "Main Company" : "Company"}</small>
          </label>
        </div>
        <input
          className="legacy-search"
          type="search"
          aria-label="Search navigation"
          placeholder="Search..."
          value={navQuery}
          onChange={(e) => setNavQuery(e.target.value)}
        />
        <p className="legacy-navlabel">WORKSPACE</p>
        <nav id="pms-navigation" aria-label="Main navigation">
          {[
            ["Dashboard", "Dashboard", "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z"],
            [
              "Employees",
              role === "Manager" ? "My Team" : role === "Employee" ? "My Profile" : "Employees",
              "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M17 11l2 2 3-4",
            ],
            ["Goals", "Goals", "M19 12a7 7 0 1 1-7-7 M16 12a4 4 0 1 1-4-4 M12 12l9-9 M16 3h5v5"],
            ["Performance", "Reviews", "M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17l-7-4z M9 10l2 2 4-4"],
            ["202 Files & PIP", "202 Files", "M3 5h7l2 2h9v13H3z M8 12h8 M8 16h5"],
            ["PIP", "PIP", "M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17l-7-4z M9 10l2 2 4-4"],
            ["Reports", "Reports", "M3 21h18 M6 17v-6 M12 17V4 M18 17V9"],
          ]
            .filter(([, label]) => label.toLowerCase().includes(navQuery.toLowerCase()))
            .map(([item, label, icon]) => (
              <Button
                key={item}
                variant="outline"
                aria-current={page === item ? "page" : undefined}
                onClick={() => {
                  setPage(item);
                  setMobileNav(false);
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d={icon} />
                </svg>
                {label}
              </Button>
            ))}
        </nav>
        <div className="legacy-sidefoot">
          <span className="legacy-avatar">
            {companyEmployees
              .find((e) => e.id === identity)
              ?.name.split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("") || "HR"}
          </span>
          <div>
            <b>{companyEmployees.find((e) => e.id === identity)?.name || role}</b>
            <small>{role}</small>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="legacy-topbar">
          <span className="legacy-date">
            {localStorage.getItem(workflowDateKey) ? "Demo date" : "Live date"}: {workflowToday()} · Asia/Manila
          </span>
          <span className="legacy-crumb">
            Workspace　›　{page === "Performance" ? "Reviews" : page === "202 Files & PIP" ? "202 Files" : page}
          </span>
          <div>
            {theme === "workspace" && (
              <div className="workspace-top-controls">
                <input
                  type="search"
                  aria-label="Search workspace navigation"
                  placeholder="Search..."
                  value={navQuery}
                  onChange={(event) => setNavQuery(event.target.value)}
                />
                <label>
                  Role{" "}
                  <select aria-label="Preview role" value={role} onChange={(event) => changeRole(event.target.value)}>
                    <option>HR Administrator</option>
                    <option>Manager</option>
                    <option>Employee</option>
                  </select>
                </label>
              </div>
            )}
            <Button variant="outline" aria-label="Workflow guide" title="Workflow guide" onClick={() => setGuide(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <rect x="8" y="2" width="8" height="5" rx="1" />
                <rect x="2" y="17" width="7" height="5" rx="1" />
                <rect x="15" y="17" width="7" height="5" rx="1" />
                <path d="M12 7v5M5.5 17v-5h13v5" />
              </svg>
            </Button>
            <Button
              variant="outline"
              aria-label="Notifications"
              onClick={openNotifications}
              disabled={!notificationsEnabled}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
              </svg>
            </Button>
            <ProfileMenu
              role={role}
              onRoleChange={changeRole}
              identity={identity}
              onIdentityChange={setIdentity}
              employees={companyEmployees}
              onThemeChange={switchTheme}
              theme={theme}
              onNotificationsChange={setNotificationsEnabled}
            />
          </div>
        </header>
        <main>
          {page === "Employees" ? (
            <>
              <div className="heading">
                <div>
                  <h1>Employees</h1>
                  <p>Employee profiles and reporting lines</p>
                </div>
                {role === "HR Administrator" && (
                  <Button
                    onClick={() => {
                      setEditing(null);
                      setOpen(true);
                    }}
                  >
                    Add employee
                  </Button>
                )}
              </div>
              <EmployeeDirectory
                onEdit={
                  role === "HR Administrator"
                    ? (employee) => {
                        setEditing(employee);
                        setOpen(true);
                      }
                    : undefined
                }
                employees={
                  role === "Employee"
                    ? companyEmployees.filter((e) => e.id === identity)
                    : role === "Manager"
                      ? companyEmployees.filter((e) => e.manager === employees.find((p) => p.id === identity)?.name)
                      : companyEmployees
                }
              />
              {role === "HR Administrator" && (
                <Assignments
                  companyId={companyId}
                  employees={companyEmployees}
                  onChange={(next) => {
                    const merged = [...employees.filter((e) => (e.companyId || "mayon") !== companyId), ...next];
                    localStorage.setItem(key, JSON.stringify(merged));
                    setEmployees(merged);
                  }}
                />
              )}
              {role === "HR Administrator" && (
                <>
                  <WorkflowClock />
                  <DataTransfer />
                </>
              )}
              {error && <p role="alert">{error}</p>}
            </>
          ) : page === "Performance" || page === "Goals" ? (
            <Performance
              key={page}
              initialTab={page === "Goals" ? "Goals & milestones" : undefined}
              companyId={companyId}
              role={role}
              employeeId={identity}
            />
          ) : page === "202 Files & PIP" || page === "PIP" ? (
            <Cases
              key={page}
              initialTab={page === "PIP" ? "PIP" : undefined}
              companyId={companyId}
              role={role}
              employeeId={identity}
              managerId={identity}
            />
          ) : (
            <Reporting
              role={role}
              employeeId={identity}
              onOpenGoals={() => setPage("Goals")}
              onOpenReviews={() => setPage("Performance")}
              report={page === "Reports"}
              employees={
                role === "Employee"
                  ? companyEmployees.filter((e) => e.id === identity)
                  : role === "Manager"
                    ? companyEmployees.filter((e) => e.manager === employees.find((p) => p.id === identity)?.name)
                    : companyEmployees
              }
            />
          )}
        </main>
        {theme === "workspace" && (
          <footer className="legacy-footer">
            <span>
              © {workflowToday().slice(0, 4)} {companyId === "mayon" ? "Mayon Consolidated Inc." : companyId} · HRDotNet
              Performance
            </span>
            <span>
              {localStorage.getItem(workflowDateKey) ? "Demo date" : "Live date"}: {workflowToday()} · Asia/Manila
            </span>
          </footer>
        )}
      </div>
      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen} title="Notifications">
        {notifications.length ? (
          notifications.map((n) => (
            <article key={n.id}>
              <strong>{n.subject}</strong>
              <p>{n.status}</p>
              <Button
                onClick={() => {
                  setPage(n.destination || "202 Files & PIP");
                  setNotificationsOpen(false);
                }}
              >
                {n.destination === "Performance" ? "Open reviews" : "Open employee files"}
              </Button>
            </article>
          ))
        ) : (
          <p>No notices in your scope.</p>
        )}
      </Dialog>
      <Dialog open={guide} onOpenChange={setGuide} title="Workflow guide">
        <WorkflowGuide />
      </Dialog>
      <Dialog open={open} onOpenChange={setOpen} title={editing ? "Edit employee" : "Add employee"}>
        <form onSubmit={save}>
          {error && <p role="alert">{error}</p>}
          {[
            ["name", "Full name"],
            ["title", "Job title"],
            ["department", "Department"],
            ["manager", "Manager"],
          ].map(([name, label]) => (
            <label key={name}>
              {label}
              <input
                defaultValue={editing?.[name as keyof Employee] || ""}
                name={name}
                required={name !== "manager"}
                maxLength={120}
              />
            </label>
          ))}
          <Button type="submit">Save employee</Button>
        </form>
      </Dialog>
    </div>
  );
}
