import { Herb } from "@herb-tools/node-wasm";
import { beforeAll, describe, expect, test } from "vitest";
import { Linter } from "../../src/linter.js";
import { HTMLNoDuplicateIdsRule } from "../../src/rules/html-no-duplicate-ids.js";

describe("html-no-duplicate-ids", () => {
  beforeAll(async () => {
    await Herb.load();
  })

  test("passes for unique IDs", () => {
    const html = '<div id="unique1"></div><span id="unique2"></span>';
    const result = Herb.parse(html);
    const linter = new Linter([HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(result.value);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  })

  test("fails for duplicate IDs", () => {
    const html = '<div id="duplicate"></div><span id="duplicate"></span>';
    const result = Herb.parse(html);
    const linter = new Linter([HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(result.value);

    expect(lintResult.errors).toBe(1);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(1);

    expect(lintResult.offenses[0].rule).toBe("html-no-duplicate-ids");
    expect(lintResult.offenses[0].message).toBe('Duplicate ID `duplicate` found. IDs must be unique within a document.');
    expect(lintResult.offenses[0].severity).toBe("error");
  })

  test("passes for missing IDs", () => {
    const html = '<div></div><span></span>';
    const result = Herb.parse(html);
    const linter = new Linter([HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(result.value);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  })

  test("passes for IDs without value", () => {
    const html = '<div id=""></div><span id="  "></span>';
    const result = Herb.parse(html);
    const linter = new Linter([HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(result.value);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  })

  test("passes when using ERB in ID", () => {
    const html = '<div id="<%= user.id %>"></div>';
    const result = Herb.parse(html);
    const linter = new Linter([HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(result.value);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  })

  test("fails for multiple duplicate IDs in ERB", () => {
    const html = '<div id="<%= user.id %>"></div><span id="<%= user.id %>"></span>';
    const result = Herb.parse(html);
    const linter = new Linter([HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(result.value);

    expect(lintResult.errors).toBe(1);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(1);

    expect(lintResult.offenses[0].rule).toBe("html-no-duplicate-ids");
    expect(lintResult.offenses[0].message).toBe('Duplicate ID `<%= user.id %>` found. IDs must be unique within a document.');
    expect(lintResult.offenses[0].severity).toBe("error");
  })
})
