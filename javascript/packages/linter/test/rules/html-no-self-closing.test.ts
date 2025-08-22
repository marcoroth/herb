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

    expect(lintResult.offenses[0].rule).toBe("html-no-self-closing");
    expect(lintResult.offenses[0].severity).toBe("error");

    expect(lintResult.offenses[0].message).toBe('Self-closing syntax `<div />` is not allowed in HTML. Use `<div></div>` instead.')
    expect(lintResult.offenses[1].message).toBe('Self-closing syntax `<span />` is not allowed in HTML. Use `<span></span>` instead.')
    expect(lintResult.offenses[2].message).toBe('Self-closing syntax `<section />` is not allowed in HTML. Use `<section></section>` instead.')
    expect(lintResult.offenses[3].message).toBe('Self-closing syntax `<custom-element />` is not allowed in HTML. Use `<custom-element></custom-element>` instead.')
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

    expect(lintResult.offenses[0].rule).toBe("html-no-self-closing");
    expect(lintResult.offenses[0].severity).toBe("error");

    expect(lintResult.offenses[0].message).toBe('Self-closing syntax `<img />` is not allowed in HTML. Use `<img>` instead.')
    expect(lintResult.offenses[1].message).toBe('Self-closing syntax `<input />` is not allowed in HTML. Use `<input>` instead.')
    expect(lintResult.offenses[2].message).toBe('Self-closing syntax `<br />` is not allowed in HTML. Use `<br>` instead.')
    expect(lintResult.offenses[3].message).toBe('Self-closing syntax `<hr />` is not allowed in HTML. Use `<hr>` instead.')
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

    expect(lintResult.offenses[0].message).toBe('Self-closing syntax `<span />` is not allowed in HTML. Use `<span></span>` instead.')
    expect(lintResult.offenses[1].message).toBe('Self-closing syntax `<input />` is not allowed in HTML. Use `<input>` instead.')
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

    expect(lintResult.offenses[0].message).toBe('Self-closing syntax `<span />` is not allowed in HTML. Use `<span></span>` instead.')
    expect(lintResult.offenses[1].message).toBe('Self-closing syntax `<section />` is not allowed in HTML. Use `<section></section>` instead.')
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

    expect(lintResult.offenses[0].message).toBe('Self-closing syntax `<custom-element />` is not allowed in HTML. Use `<custom-element></custom-element>` instead.')
    expect(lintResult.offenses[1].message).toBe('Self-closing syntax `<another-custom />` is not allowed in HTML. Use `<another-custom></another-custom>` instead.')
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
