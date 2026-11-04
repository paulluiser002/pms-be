// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ProfileMenu } from "./preferences";
const employee = { id: "one", name: "Ana Cruz", title: "Engineer", department: "Engineering", manager: "Lead" };
const props = () => ({
  role: "HR Administrator",
  identity: "one",
  employees: [employee],
  onRoleChange: vi.fn(),
  onIdentityChange: vi.fn(),
  onThemeChange: vi.fn(),
  onNotificationsChange: vi.fn(),
});
function open() {
  fireEvent.keyDown(screen.getByRole("button", { name: "Open profile menu" }), { key: "Enter" });
}
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
it("keeps profile, settings, preview and theme actions in legacy order", () => {
  render(<ProfileMenu {...props()} />);
  open();
  const menu = screen.getByRole("menu");
  expect(
    within(menu)
      .getAllByRole("menuitem")
      .map((item) => item.textContent),
  ).toEqual(["Profile", "Account Settings", "Preview as User Type", "Preview identity", "Change theme"]);
});
it("shows actual profile fields without inventing contact details", () => {
  render(<ProfileMenu {...props()} />);
  open();
  fireEvent.click(screen.getByRole("menuitem", { name: "Profile" }));
  const profile = screen.getByRole("dialog", { name: "Profile" });
  expect(within(profile).getByText("Ana Cruz")).toBeTruthy();
  expect(within(profile).getByText("Engineering")).toBeTruthy();
  expect(within(profile).getByText("one")).toBeTruthy();
  expect(within(profile).queryByText("Email")).toBeNull();
});
it("shows existing email and closes the keyboard menu with Escape", () => {
  render(<ProfileMenu {...props()} employees={[{ ...employee, email: "ana@example.test" }]} />);
  open();
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  expect(screen.queryByRole("menu")).toBeNull();
  open();
  fireEvent.click(screen.getByRole("menuitem", { name: "Profile" }));
  expect(screen.getByText("ana@example.test")).toBeTruthy();
});
it("persists review notification preference and restores it on remount", () => {
  const values = props();
  let view = render(<ProfileMenu {...values} />);
  open();
  fireEvent.click(screen.getByRole("menuitem", { name: "Account Settings" }));
  const setting = screen.getByRole("checkbox", { name: "Review notifications" });
  expect((setting as HTMLInputElement).checked).toBe(true);
  fireEvent.click(setting);
  fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));
  expect(values.onNotificationsChange).toHaveBeenLastCalledWith(false);
  expect(JSON.parse(localStorage.getItem("pms-react-preferences-v1")!).notificationsEnabled).toBe(false);
  view.unmount();
  view = render(<ProfileMenu {...values} />);
  open();
  fireEvent.click(screen.getByRole("menuitem", { name: "Account Settings" }));
  expect((screen.getByRole("checkbox", { name: "Review notifications" }) as HTMLInputElement).checked).toBe(false);
});
it("restores the legacy setting without replacing original browser data", () => {
  const original = JSON.stringify({ pmsNotificationsEnabled: false, employees: [] });
  localStorage.setItem("people-mvp-v1", original);
  const values = props();
  render(<ProfileMenu {...values} />);
  expect(values.onNotificationsChange).toHaveBeenCalledWith(false);
  open();
  fireEvent.click(screen.getByRole("menuitem", { name: "Account Settings" }));
  expect((screen.getByRole("checkbox", { name: "Review notifications" }) as HTMLInputElement).checked).toBe(false);
  expect(localStorage.getItem("people-mvp-v1")).toBe(original);
});
it("invokes theme and validated preview callbacks", () => {
  const values = props();
  render(<ProfileMenu {...values} />);
  open();
  fireEvent.click(screen.getByRole("menuitem", { name: "Change theme" }));
  expect(values.onThemeChange).toHaveBeenCalledOnce();
  open();
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "Preview as User Type" }), { key: "ArrowRight" });
  fireEvent.click(screen.getByRole("menuitemradio", { name: "Employee" }));
  expect(values.onRoleChange).toHaveBeenCalledWith("Employee");
});
it("preserves malformed preference storage and reports save errors", () => {
  localStorage.setItem("pms-react-preferences-v1", "malformed original");
  render(<ProfileMenu {...props()} />);
  open();
  fireEvent.click(screen.getByRole("menuitem", { name: "Account Settings" }));
  expect(screen.getByRole("alert").textContent).toMatch(/Unable to read/);
  fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));
  expect(localStorage.getItem("pms-react-preferences-v1")).toBe("malformed original");
});
