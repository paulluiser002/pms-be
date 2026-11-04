import { useEffect, useState } from "react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { z } from "zod";
import { Button } from "./components/ui/button";
import { Dialog } from "./components/ui/dialog";
import type { Employee } from "./employee-directory";

const preferenceKey = "pms-react-preferences-v1";
const preferenceSchema = z.object({ notificationsEnabled: z.boolean() });
const roleSchema = z.enum(["Employee", "Manager", "HR Administrator"]);
type ProfileEmployee = Employee & { email?: string };
export type ProfileMenuProps = {
  role: string;
  onRoleChange: (role: string) => void;
  identity: string;
  onIdentityChange: (identity: string) => void;
  employees: ProfileEmployee[];
  onThemeChange: () => void;
  theme?: string;
  onNotificationsChange?: (enabled: boolean) => void;
};
function loadPreferences() {
  try {
    const stored = localStorage.getItem(preferenceKey);
    if (stored !== null) return { ...preferenceSchema.parse(JSON.parse(stored)), error: "" };
  } catch {
    return {
      notificationsEnabled: true,
      error: "Unable to read saved settings. Existing preferences remain unchanged.",
    };
  }
  try {
    const source = localStorage.getItem("people-mvp-v1");
    if (source !== null) {
      const legacy = z.object({ pmsNotificationsEnabled: z.boolean().optional() }).safeParse(JSON.parse(source));
      if (legacy.success) return { notificationsEnabled: legacy.data.pmsNotificationsEnabled ?? true, error: "" };
    }
  } catch {
    // An unreadable legacy workspace does not prevent independent account settings.
  }
  return { notificationsEnabled: true, error: "" };
}
const contentClass =
  "z-50 min-w-56 max-w-[calc(100vw-32px)] rounded-lg border border-slate-200 bg-white p-1 text-sm text-slate-800";
const itemClass =
  "relative flex cursor-default select-none items-center rounded px-3 py-2.5 outline-none data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-950 data-[state=checked]:font-semibold";

export function ProfileMenu({
  role,
  onRoleChange,
  identity,
  onIdentityChange,
  employees,
  onThemeChange,
  theme,
  onNotificationsChange,
}: ProfileMenuProps) {
  const [settings, setSettings] = useState(loadPreferences);
  const [dialog, setDialog] = useState<"profile" | "settings" | null>(null);
  const [pendingNotifications, setPendingNotifications] = useState(settings.notificationsEnabled);
  const [saveError, setSaveError] = useState("");
  const person = employees.find((employee) => employee.id === identity);
  useEffect(() => {
    onNotificationsChange?.(settings.notificationsEnabled);
  }, [settings.notificationsEnabled, onNotificationsChange]);
  function saveSettings() {
    if (settings.error) return;
    try {
      const next = preferenceSchema.parse({ notificationsEnabled: pendingNotifications });
      localStorage.setItem(preferenceKey, JSON.stringify(next));
      setSettings({ ...next, error: "" });
      window.dispatchEvent(new CustomEvent("pms-preferences-changed", { detail: next }));
      setSaveError("");
      setDialog(null);
    } catch {
      setSaveError("Unable to save settings. Check available browser storage and try again.");
    }
  }
  return (
    <>
      <Button variant="outline" aria-label="Settings" onClick={() => setDialog("settings")}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path
            d="m10 3-1 3-3 1-3-1-2 4 2 2 1 3-1 3 4 2 2-2 3 1 1 3 4-1 1-3 3-1 2-4-2-2-1-3 1-3-4-2-2 2z"
            transform="translate(2 1) scale(.82)"
          />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </Button>
      <Dropdown.Root>
        <Dropdown.Trigger asChild>
          <Button variant="outline" className="legacy-profile" aria-label="Open profile menu">
            {(person?.name || role)
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("")}
          </Button>
        </Dropdown.Trigger>
        <Dropdown.Portal>
          <Dropdown.Content
            className={contentClass}
            align="end"
            sideOffset={8}
            collisionPadding={16}
            onCloseAutoFocus={(event) => {
              if (dialog) event.preventDefault();
            }}
          >
            <Dropdown.Label className="px-3 py-2">
              <strong className="block">{person?.name || role}</strong>
              <span className="text-xs text-slate-600">{role}</span>
            </Dropdown.Label>
            <Dropdown.Separator className="my-1 h-px bg-slate-200" />
            <Dropdown.Item className={itemClass} onSelect={() => setDialog("profile")}>
              Profile
            </Dropdown.Item>
            <Dropdown.Item
              className={itemClass}
              onSelect={() => {
                setPendingNotifications(settings.notificationsEnabled);
                setSaveError("");
                setDialog("settings");
              }}
            >
              Account Settings
            </Dropdown.Item>
            <Dropdown.Sub>
              <Dropdown.SubTrigger className={itemClass}>Preview as User Type</Dropdown.SubTrigger>
              <Dropdown.Portal>
                <Dropdown.SubContent className={contentClass} sideOffset={4} collisionPadding={16}>
                  <Dropdown.RadioGroup
                    value={role}
                    onValueChange={(value) => {
                      const parsed = roleSchema.safeParse(value);
                      if (parsed.success) onRoleChange(parsed.data);
                    }}
                  >
                    {roleSchema.options.map((value) => (
                      <Dropdown.RadioItem key={value} value={value} className={itemClass}>
                        {value}
                      </Dropdown.RadioItem>
                    ))}
                  </Dropdown.RadioGroup>
                </Dropdown.SubContent>
              </Dropdown.Portal>
            </Dropdown.Sub>
            <Dropdown.Sub>
              <Dropdown.SubTrigger className={itemClass}>Preview identity</Dropdown.SubTrigger>
              <Dropdown.Portal>
                <Dropdown.SubContent className={contentClass} sideOffset={4} collisionPadding={16}>
                  <Dropdown.RadioGroup
                    value={identity}
                    onValueChange={(value) => {
                      if (employees.some((employee) => employee.id === value)) onIdentityChange(value);
                    }}
                  >
                    {employees.map((employee) => (
                      <Dropdown.RadioItem key={employee.id} value={employee.id} className={itemClass}>
                        {employee.name}
                      </Dropdown.RadioItem>
                    ))}
                  </Dropdown.RadioGroup>
                  {!employees.length && (
                    <Dropdown.Label className="px-3 py-2 text-slate-600">No employees in this company.</Dropdown.Label>
                  )}
                </Dropdown.SubContent>
              </Dropdown.Portal>
            </Dropdown.Sub>
            <Dropdown.Separator className="my-1 h-px bg-slate-200" />
            <Dropdown.Item className={itemClass} onSelect={onThemeChange}>
              Change theme
              {theme && (
                <span className="ml-auto pl-4 text-xs text-slate-600">
                  {theme === "workspace" ? "Workspace" : "Classic"}
                </span>
              )}
            </Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>
      <Dialog
        open={dialog === "profile"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title="Profile"
      >
        <h2>{person?.name || role}</h2>
        <p>{role}</p>
        {person ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
            <dt>Employee ID</dt>
            <dd>{person.id}</dd>
            <dt>Position</dt>
            <dd>{person.title}</dd>
            <dt>Department</dt>
            <dd>{person.department}</dd>
            <dt>Reports to</dt>
            <dd>{person.manager || "Unassigned"}</dd>
            {person.email && (
              <>
                <dt>Email</dt>
                <dd>{person.email}</dd>
              </>
            )}
          </dl>
        ) : (
          <p>No employee profile is selected.</p>
        )}
        <Button onClick={() => setDialog(null)}>Done</Button>
      </Dialog>
      <Dialog
        open={dialog === "settings"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title="Account Settings"
      >
        <p>Workspace preferences.</p>
        <label className="flex-row items-center gap-3">
          <input
            type="checkbox"
            checked={pendingNotifications}
            onChange={(event) => setPendingNotifications(event.target.checked)}
          />
          Review notifications
        </label>
        <p>Show assigned reviews in the notifications panel.</p>
        {(settings.error || saveError) && <p role="alert">{settings.error || saveError}</p>}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setDialog(null)}>
            Cancel
          </Button>
          <Button disabled={!!settings.error} onClick={saveSettings}>
            Save Settings
          </Button>
        </div>
      </Dialog>
    </>
  );
}
