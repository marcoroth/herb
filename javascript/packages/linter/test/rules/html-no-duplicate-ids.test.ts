import dedent from "dedent"
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
    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  })

  test("fails for duplicate IDs", () => {
    const html = '<div id="duplicate"></div><span id="duplicate"></span>';
    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(1);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(1);

    expect(lintResult.offenses[0].rule).toBe("html-no-duplicate-ids");
    expect(lintResult.offenses[0].message).toBe('Duplicate ID `duplicate` found. IDs must be unique within a document.');
    expect(lintResult.offenses[0].severity).toBe("error");
  })

  test("passes for missing IDs", () => {
    const html = '<div></div><span></span>';
    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  })

  test("passes for IDs without value", () => {
    const html = '<div id=""></div><span id="  "></span>';
    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  })

  test("passes for other attributes with equal value", () => {
    const html = '<div class="value"></div><div class="value"></div>';
    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  })

  test("passes when using ERB in ID", () => {
    const html = '<div id="<%= user.id %>"></div>';
    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  })

  // TODO: see next test, in the future this should also warn if it's in the same "context"
  test("passes when using ERB for two IDs", () => {
    const html = '<div id="<%= user.id %>"></div><div id="<%= user.id %>"></div>';
    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  })

  test.todo("fails for multiple duplicate IDs in ERB in the same context", () => {
    const html = '<div id="<%= user.id %>"></div><span id="<%= user.id %>"></span>';
    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(1);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(1);

    expect(lintResult.offenses[0].rule).toBe("html-no-duplicate-ids");
    expect(lintResult.offenses[0].message).toBe('Duplicate ID `<%= user.id %>` found. IDs must be unique within a document.');
    expect(lintResult.offenses[0].severity).toBe("error");
  })

  test.skip("passes for dynamic attribute in a loop context", () => {
    const html = dedent`
      <% @users.each do |user| %>
        <div id="<%= user.id %>"></div>
      <% end %>

      <% @users.each do |user| %>
        <div id="<%= user.id %>"></div>
      <% end %>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(1);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(1);

    expect(lintResult.offenses[0].rule).toBe("html-no-duplicate-ids");
    expect(lintResult.offenses[0].message).toBe('Duplicate ID `<%= user.id %>` found. IDs must be unique within a document.');
    expect(lintResult.offenses[0].severity).toBe("error");
  })
})
