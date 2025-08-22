import { Herb } from "@herb-tools/node-wasm";
import { beforeAll, describe, expect, test } from "vitest";
import { Linter } from "../../src/linter.js";
import { HTMLNoSelfClosingRule } from "../../src/rules/html-no-self-closing.js";

describe("html-no-self-closing", () => {
  beforeAll(async () => {
    await Herb.load();
  });

  test("passes for standard HTML tags", () => {
    const html = `
      <div></div>
      <span></span>
      <section></section>
      <custom-element></custom-element>
      <img src="/logo.png" alt="Logo">
      <input type="text">
      <br>
      <hr>
    `;
    const linter = new Linter(Herb, [HTMLNoSelfClosingRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  });

  test("fails for self-closing non-void elements", () => {
    const html = `
      <div />
      <span />
      <section />
      <custom-element />
    `;
    const linter = new Linter(Herb, [HTMLNoSelfClosingRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(4);
    expect(lintResult.offenses).toHaveLength(4);
    lintResult.offenses.forEach((offense) => {
      expect(offense.rule).toBe("html-no-self-closing");
      expect(offense.message).toMatch(/Self-closing syntax/);
      expect(offense.severity).toBe("error");
    });
  });

  test("fails for self-closing void elements", () => {
    const html = `
      <img src="/logo.png" alt="Logo" />
      <input type="text" />
      <br />
      <hr />
    `;
    const linter = new Linter(Herb, [HTMLNoSelfClosingRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(4);
    expect(lintResult.offenses).toHaveLength(4);
    lintResult.offenses.forEach((offense) => {
      expect(offense.rule).toBe("html-no-self-closing");
      expect(offense.message).toMatch(/Self-closing syntax/);
      expect(offense.severity).toBe("error");
    });
  });

  test("passes for mixed correct and incorrect tags", () => {
    const html = `
      <div></div>
      <span />
      <input type="text">
      <input type="text" />
    `;
    const linter = new Linter(Herb, [HTMLNoSelfClosingRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(2);
    expect(lintResult.offenses).toHaveLength(2);
  });

  test("passes for nested non-self-closing tags", () => {
    const html = `
      <div>
        <span></span>
        <section></section>
      </div>
    `;
    const linter = new Linter(Herb, [HTMLNoSelfClosingRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  });

  test("fails for nested self-closing tags", () => {
    const html = `
      <div>
        <span />
        <section />
      </div>
    `;
    const linter = new Linter(Herb, [HTMLNoSelfClosingRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(2);
    expect(lintResult.offenses).toHaveLength(2);
    lintResult.offenses.forEach((offense) => {
      expect(offense.rule).toBe("html-no-self-closing");
      expect(offense.message).toMatch(/Self-closing syntax/);
      expect(offense.severity).toBe("error");
    });
  });

  test("passes for custom elements without self-closing", () => {
    const html = `
      <custom-element></custom-element>
      <another-custom></another-custom>
    `;
    const linter = new Linter(Herb, [HTMLNoSelfClosingRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  });

  test("fails for custom elements with self-closing", () => {
    const html = `
      <custom-element />
      <another-custom />
    `;
    const linter = new Linter(Herb, [HTMLNoSelfClosingRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(2);
    expect(lintResult.offenses).toHaveLength(2);
    lintResult.offenses.forEach((offense) => {
      expect(offense.rule).toBe("html-no-self-closing");
      expect(offense.message).toMatch(/Self-closing syntax/);
      expect(offense.severity).toBe("error");
    });
  });

  test("passes for void elements without self-closing", () => {
    const html = `
      <img src="/logo.png" alt="Logo">
      <input type="text">
      <br>
      <hr>
    `;
    const linter = new Linter(Herb, [HTMLNoSelfClosingRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  });
});
