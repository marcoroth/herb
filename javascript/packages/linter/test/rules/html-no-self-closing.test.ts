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
      <svg />
    `;
    const linter = new Linter(Herb, [HTMLNoSelfClosingRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(5);
    expect(lintResult.offenses).toHaveLength(5);

    expect(lintResult.offenses[0].rule).toBe("html-no-self-closing");
    expect(lintResult.offenses[0].severity).toBe("error");

    expect(lintResult.offenses[0].message).toBe('Use `<div></div>` instead of self-closing `<div />` for HTML compatibility.')
    expect(lintResult.offenses[1].message).toBe('Use `<span></span>` instead of self-closing `<span />` for HTML compatibility.')
    expect(lintResult.offenses[2].message).toBe('Use `<section></section>` instead of self-closing `<section />` for HTML compatibility.')
    expect(lintResult.offenses[3].message).toBe('Use `<custom-element></custom-element>` instead of self-closing `<custom-element />` for HTML compatibility.')
    expect(lintResult.offenses[4].message).toBe('Use `<svg></svg>` instead of self-closing `<svg />` for HTML compatibility.')
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

    expect(lintResult.offenses[0].message).toBe('Use `<img>` instead of self-closing `<img />` for HTML compatibility.')
    expect(lintResult.offenses[1].message).toBe('Use `<input>` instead of self-closing `<input />` for HTML compatibility.')
    expect(lintResult.offenses[2].message).toBe('Use `<br>` instead of self-closing `<br />` for HTML compatibility.')
    expect(lintResult.offenses[3].message).toBe('Use `<hr>` instead of self-closing `<hr />` for HTML compatibility.')
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

    expect(lintResult.offenses[0].message).toBe('Use `<span></span>` instead of self-closing `<span />` for HTML compatibility.')
    expect(lintResult.offenses[1].message).toBe('Use `<input>` instead of self-closing `<input />` for HTML compatibility.')
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

    expect(lintResult.offenses[0].message).toBe('Use `<span></span>` instead of self-closing `<span />` for HTML compatibility.')
    expect(lintResult.offenses[1].message).toBe('Use `<section></section>` instead of self-closing `<section />` for HTML compatibility.')
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

    expect(lintResult.offenses[0].message).toBe('Use `<custom-element></custom-element>` instead of self-closing `<custom-element />` for HTML compatibility.')
    expect(lintResult.offenses[1].message).toBe('Use `<another-custom></another-custom>` instead of self-closing `<another-custom />` for HTML compatibility.')
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

  test("passes for self-closing elements inside SVG", () => {
    const html = `
      <div class="flex items-center text-xs text-gray-500 mt-1">
        <svg class="w-3 h-3 mr-1 fill-gray-400" viewBox="0 0 24 24">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          <circle cx="12" cy="12" r="10" />
          <rect x="0" y="0" width="24" height="24" />
        </svg>
      </div>
    `;
    const linter = new Linter(Herb, [HTMLNoSelfClosingRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  });

  test("fails for self-closing elements outside SVG but passes inside SVG", () => {
    const html = `
      <div />
      <svg class="w-3 h-3" viewBox="0 0 24 24">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
        <circle cx="12" cy="12" r="10" />
      </svg>
      <span />
    `;
    const linter = new Linter(Herb, [HTMLNoSelfClosingRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(2);
    expect(lintResult.offenses).toHaveLength(2);

    expect(lintResult.offenses[0].message).toBe('Use `<div></div>` instead of self-closing `<div />` for HTML compatibility.');
    expect(lintResult.offenses[1].message).toBe('Use `<span></span>` instead of self-closing `<span />` for HTML compatibility.');
  });
});
