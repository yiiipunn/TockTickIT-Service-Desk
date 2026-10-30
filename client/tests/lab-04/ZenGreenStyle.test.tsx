// @ts-expect-error Vitest executes this test in Node; production client types intentionally exclude Node.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

declare const process: { cwd(): string };

const css = readFileSync(`${process.cwd()}/src/index.css`, "utf8");

describe("Lab 4 Zen Green style and accessibility contract", () => {
  it("[UI-STYLE-01 / AC-23, AC-24] preserves the approved color tokens and visible keyboard focus", () => {
    expect(css).toContain("--toktickit-primary: #006b3c");
    expect(css).toContain("--toktickit-secondary: #0b7a46");
    expect(css).toContain("--toktickit-pale: #eaf6ef");
    expect(css).toContain("--toktickit-page: #f5f7f6");
    expect(css).toMatch(/:focus-visible\s*{[^}]*outline:\s*3px solid #0b7a46;[^}]*outline-offset:\s*2px;/s);
    expect(css).toMatch(/\.dashboard-count-row strong\s*{[^}]*color:\s*#006b3c;/s);
  });

  it("[UI-A11Y-01 / AC-23, AC-24] retains narrow-screen reflow and practical touch targets", () => {
    expect(css).toMatch(/@media \(max-width: 991px\)/);
    expect(css).toMatch(/@media \(max-width: 575\.98px\)/);
    expect(css).toMatch(/\.dashboard-metric-grid,[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\);/);
    expect(css).toMatch(/\.requester-quick-actions \.btn\s*{[^}]*min-height:\s*44px;[^}]*width:\s*100%;/s);
    expect(css).toMatch(/\.actions-taken \.btn,[\s\S]*min-height:\s*44px;/);
    expect(css).toMatch(/\.action-dialog\s*{[^}]*width:\s*100%;[^}]*max-height:\s*92vh;/s);
  });
});
