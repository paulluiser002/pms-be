import { useState } from "react";
import { Button } from "./components/ui/button";

export const workflowDateKey = "pms-react-workflow-date-v1";
export const workflowClockEvent = "pms-workflow-clock-changed";
export function validWorkflowDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function workflowToday() {
  const demo = localStorage.getItem(workflowDateKey);
  return demo && validWorkflowDate(demo)
    ? demo
    : new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
}
export function WorkflowClock() {
  const [date, setDate] = useState(workflowToday);
  const [message, setMessage] = useState("");
  function apply(demo: string | null) {
    if (demo !== null && !validWorkflowDate(demo)) return;
    try {
      if (demo) localStorage.setItem(workflowDateKey, demo);
      else localStorage.removeItem(workflowDateKey);
      setDate(workflowToday());
      setMessage(demo ? "Demo date applied." : "Live date restored.");
      window.dispatchEvent(new Event(workflowClockEvent));
    } catch {
      setMessage("Unable to save the workflow date.");
    }
  }
  return (
    <section className="panel">
      <div className="panelhead">
        <h2>Workflow date</h2>
        <p>Asia/Manila</p>
      </div>
      <form
        className="toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          apply(date);
        }}
      >
        <label>
          Demo date
          <input type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <Button type="submit">Apply demo date</Button>
        <Button variant="outline" onClick={() => apply(null)}>
          Use live date
        </Button>
        {message && <p role="status">{message}</p>}
      </form>
    </section>
  );
}
