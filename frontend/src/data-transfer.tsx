import { useState } from "react";
import { z } from "zod";
import { Button } from "./components/ui/button";
import { validWorkflowDate, workflowDateKey } from "./workflow-clock";

const legacyKey = "people-mvp-v1";
const themeKey = "hrdotnet-performance-theme";
const keys = [
  legacyKey,
  themeKey,
  workflowDateKey,
  ...[
    "behavior-templates",
    "cases",
    "cycles",
    "employees",
    "goals",
    "kpi-templates",
    "manager-assignments",
    "performance-legacy-archive",
    "performance-legacy-import",
    "pip-referrals",
    "preferences",
  ].map((name) => `pms-react-${name}-v1`),
];
const format = "pms-workspace-v1";
const importMarker = "pms-react-performance-legacy-import-v1";
const legacy = z.object({
  employees: z.array(z.tuple([z.string(), z.string(), z.string(), z.string(), z.string(), z.number(), z.string()])),
});
const backup = z.object({ format: z.literal(format), entries: z.record(z.string(), z.string()) });
function currentEntries(storage: Storage) {
  return Object.fromEntries(
    keys.flatMap((key) => {
      const value = storage.getItem(key);
      return value === null ? [] : [[key, value]];
    }),
  );
}
export function restoreWorkspace(text: string, storage: Storage) {
  const raw: unknown = JSON.parse(text);
  const result = backup.safeParse(raw);
  const entries = result.success
    ? result.data.entries
    : { [legacyKey]: JSON.stringify(legacy.passthrough().parse(raw)) };
  if (!Object.keys(entries).length) throw new Error("The backup is empty.");
  for (const [key, value] of Object.entries(entries)) {
    if (!keys.includes(key)) throw new Error("The file contains an unknown workspace key.");
    if (key === themeKey) z.enum(["classic", "workspace"]).parse(value);
    else if (key === importMarker) z.iso.datetime().parse(value);
    else if (key === workflowDateKey) {
      if (!validWorkflowDate(value)) throw new Error("The backup contains an invalid workflow date.");
    } else {
      const decoded: unknown = JSON.parse(value);
      if (key === legacyKey) legacy.parse(decoded);
    }
  }
  const previous = currentEntries(storage);
  storage.setItem("pms-workspace-before-import-v1", JSON.stringify({ format, entries: previous }));
  const apply = (values: Record<string, string>) => {
    for (const key of keys) storage.removeItem(key);
    for (const [key, value] of Object.entries(values)) storage.setItem(key, value);
  };
  try {
    apply(entries);
  } catch (cause) {
    apply(previous);
    throw cause;
  }
}
export function DataTransfer() {
  const [file, setFile] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ format, entries: currentEntries(localStorage) }, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "pms-workspace.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="panel">
      <div className="panelhead">
        <h2>Workspace backup</h2>
        <p>Export a copy or restore it in this browser.</p>
      </div>
      <form
        className="toolbar"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!file || !confirmed) return;
          try {
            if (file.size > 10_000_000) throw new Error("The backup exceeds 10 MB.");
            restoreWorkspace(await file.text(), localStorage);
            window.location.reload();
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to restore the workspace.");
          }
        }}
      >
        <Button variant="outline" onClick={download}>
          Export backup
        </Button>
        <label>
          Backup file
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setConfirmed(false);
            }}
          />
        </label>
        <label>
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> Replace
          this browser's workspace
        </label>
        <Button type="submit" disabled={!file || !confirmed}>
          Restore backup
        </Button>
        {error && <p role="alert">{error}</p>}
      </form>
    </section>
  );
}
