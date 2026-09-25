import { axe } from "jest-axe";
import type { AxeResults } from "axe-core";

// Runs axe-core (via jest-axe) over an element and fails with violation
// details when any are found.
//
// `color-contrast` is disabled: jsdom has no layout engine, so axe cannot
// compute real contrast ratios. Contrast is covered by the WCAG AA manual
// spot-check in docs/lab-03/tests.md §4.
export async function expectNoAxeViolations(
  element: Element
): Promise<void> {
  const results = (await axe(element, {
    rules: { "color-contrast": { enabled: false } },
  })) as AxeResults;
  if (results.violations.length > 0) {
    const summary = results.violations
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)
      .join("; ");
    throw new Error(`axe violations found: ${summary}`);
  }
}
