// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { restoreWorkspace } from "./data-transfer";
afterEach(() => localStorage.clear());
it("restores a workspace with a legacy migration marker without touching unrelated keys", () => {
  localStorage.setItem("unrelated", "keep");
  localStorage.setItem("pms-react-employees-v1", "[]");
  restoreWorkspace(
    JSON.stringify({
      format: "pms-workspace-v1",
      entries: {
        "pms-react-performance-legacy-import-v1": "2026-11-04T00:00:00.000Z",
        "hrdotnet-performance-theme": "workspace",
      },
    }),
    localStorage,
  );
  expect(localStorage.getItem("hrdotnet-performance-theme")).toBe("workspace");
  expect(localStorage.getItem("unrelated")).toBe("keep");
  expect(localStorage.getItem("pms-workspace-before-import-v1")).toContain("pms-react-employees-v1");
});
it("rejects unknown keys before replacing current data", () => {
  localStorage.setItem("pms-react-employees-v1", "[]");
  expect(() =>
    restoreWorkspace(
      JSON.stringify({
        format: "pms-workspace-v1",
        entries: { unrelated: "overwrite" },
      }),
      localStorage,
    ),
  ).toThrow("unknown workspace key");
  expect(localStorage.getItem("pms-react-employees-v1")).toBe("[]");
});
