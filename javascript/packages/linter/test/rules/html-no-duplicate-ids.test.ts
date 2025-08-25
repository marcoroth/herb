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

  test("fails for two IDs without value", () => {
    const html = '<div id=""></div><span id=""></span>';
    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(1);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(1);

    expect(lintResult.offenses[0].message).toBe('Duplicate ID `` found. IDs must be unique within a document.');
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

  // TODO: this should also warn if it's in the same "context"
  test.todo("fails for multiple duplicate IDs in ERB in the same context", () => {
    const html = '<div id="<%= user.id %>"></div><span id="<%= user.id %>"></span>';
    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(1);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(1);

    expect(lintResult.offenses[0].message).toBe('Duplicate ID `<%= user.id %>` found. IDs must be unique within a document.');
  })

  test("passes for IDs in mutually exclusive if/else branches", () => {
    const html = dedent`
      <% if some_condition? %>
        <span id="my-id">content1</span>
      <% else %>
        <span id="my-id">content2</span>
      <% end %>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  })

  test("passes for IDs in mutually exclusive unless/else branches", () => {
    const html = dedent`
      <% unless some_condition? %>
        <span id="my-id">content1</span>
      <% else %>
        <span id="my-id">content2</span>
      <% end %>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  })

  test("fails for IDs in mutually exclusive unless/else branches and global", () => {
    const html = dedent`
      <span id="my-id">content</span>

      <% unless some_condition? %>
        <span id="my-id">content1</span>
      <% else %>
        <span id="my-id">content2</span>
      <% end %>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(2);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(2);

    expect(lintResult.offenses[0].message).toBe('Duplicate ID `my-id` found. IDs must be unique within a document.');
    expect(lintResult.offenses[1].message).toBe('Duplicate ID `my-id` found. IDs must be unique within a document.');
  })

  test("passes for IDs in mutually exclusive case/when branches", () => {
    const html = dedent`
      <% case status %>
      <% when 'active' %>
        <div id="status-indicator">Active</div>
      <% when 'inactive' %>
        <div id="status-indicator">Inactive</div>
      <% else %>
        <div id="status-indicator">Unknown</div>
      <% end %>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  })

  test("fails for IDs in mutually exclusive case/when branches and global", () => {
    const html = dedent`
      <div id="status-indicator">Active</div>

      <% case status %>
      <% when 'active' %>
        <div id="status-indicator">Active</div>
      <% when 'inactive' %>
        <div id="status-indicator">Inactive</div>
      <% else %>
        <div id="status-indicator">Unknown</div>
      <% end %>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(3);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(3);

    expect(lintResult.offenses[0].message).toBe('Duplicate ID `status-indicator` found. IDs must be unique within a document.');
    expect(lintResult.offenses[1].message).toBe('Duplicate ID `status-indicator` found. IDs must be unique within a document.');
    expect(lintResult.offenses[2].message).toBe('Duplicate ID `status-indicator` found. IDs must be unique within a document.');
  })

  test("fails for duplicate IDs within same control flow branch", () => {
    const html = dedent`
      <% if some_condition? %>
        <span id="duplicate-in-branch">content1</span>
        <span id="duplicate-in-branch">content2</span>
      <% end %>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(1);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(1);

    expect(lintResult.offenses[0].message).toBe('Duplicate ID `duplicate-in-branch` found within the same control flow branch. IDs must be unique within the same control flow branch.');
  })

  test("fails for IDs duplicated outside of control flow", () => {
    const html = dedent`
      <div id="global-duplicate">outside</div>

      <% if some_condition? %>
        <span id="different-id">inside branch</span>
      <% end %>

      <div id="global-duplicate">outside again</div>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(1);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(1);

    expect(lintResult.offenses[0].message).toBe('Duplicate ID `global-duplicate` found. IDs must be unique within a document.');
  })

  test("fails for IDs duplicated outside before control flow", () => {
    const html = dedent`
      <div id="global-duplicate">outside</div>

      <% if some_condition? %>
        <span id="global-duplicate">inside branch</span>
      <% end %>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(1);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(1);

    expect(lintResult.offenses[0].message).toBe('Duplicate ID `global-duplicate` found. IDs must be unique within a document.');
  })

  test("fails for IDs duplicated outside after control flow", () => {
    const html = dedent`
      <% if some_condition? %>
        <span id="global-duplicate">inside branch</span>
      <% end %>

      <div id="global-duplicate">outside</div>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(1);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(1);

    expect(lintResult.offenses[0].message).toBe('Duplicate ID `global-duplicate` found. IDs must be unique within a document.');
  })

  test("fails for IDs duplicated outside after control flow", () => {
    const html = dedent`
      <% if some_condition? %>
        <!-- empty -->
      <% elsif another_condition? %>
        <!-- empty -->
      <% else %>
        <span id="global-duplicate">inside branch</span>
      <% end %>

      <div id="global-duplicate">outside</div>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(1);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(1);

    expect(lintResult.offenses[0].message).toBe('Duplicate ID `global-duplicate` found. IDs must be unique within a document.');
  })

  test("fails for IDs duplicated outside after control flow", () => {
    const html = dedent`
      <% if some_condition? %>
        <!-- empty -->
      <% elsif other_condition? %>
        <span id="global-duplicate">inside branch</span>
      <% end %>

      <div id="global-duplicate">outside</div>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(1);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(1);

    expect(lintResult.offenses[0].message).toBe('Duplicate ID `global-duplicate` found. IDs must be unique within a document.');
  })

  test("passes for IDs duplicated in elsif and else", () => {
    const html = dedent`
      <% if some_condition? %>
        <!-- empty -->
      <% elsif other_condition? %>
        <span id="global-duplicate">inside branch</span>
      <% else other_condition? %>
        <span id="global-duplicate">inside branch</span>
      <% end %>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  })

  test("handles nested control flow properly", () => {
    const html = dedent`
      <% if outer_condition? %>
        <% if inner_condition? %>
          <div id="nested-id">inner true</div>
        <% else %>
          <div id="nested-id">inner false</div>
        <% end %>
      <% else %>
        <div id="nested-id">outer false</div>
      <% end %>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  })

  test("passes for ID tag.div (ERBBlockNode)", () => {
    const html = dedent`
      <% tag.div do %>
        <div id="user">User</div>
      <% end %>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  })

  test("passes for output ERB IDs in loops (unique per iteration)", () => {
    const html = dedent`
      <% users.each do |user| %>
        <div id="user-<%= user.id %>">User</div>
      <% end %>

      <% users.each do |user| %>
        <div id="user-<%= user.id %>">User again</div>
      <% end %>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(1);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(1);

    expect(lintResult.offenses[0].message).toBe('Duplicate ID `user-<%= user.id %>` found. IDs must be unique within a document.');
  })

  test("fails for non-output ERB IDs in loops (same value repeated)", () => {
    const html = dedent`
      <% users.each do |user| %>
        <div id="user-<% 'static' %>">User</div>
        <div id="user-<% 'static' %>">Duplicate</div>
      <% end %>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(1);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(1);

    expect(lintResult.offenses[0].message).toBe('Duplicate ID `user-` found within the same control flow branch. IDs must be unique within the same control flow branch.');
  })

  test("passes for output ERB IDs in while loops", () => {
    const html = dedent`
      <% counter = 0 %>
      <% count = 0 %>

      <% while condition %>
        <div id="item-<%= counter %>">Item</div>
        <div id="item-<%= count %>">Item</div>
        <div id="post-<%= counter %>">Post</div>
        <% counter += 1 %>
      <% end %>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  })

  test("fails for static ID in while loops", () => {
    const html = dedent`
      <% while condition %>
        <div id="static-id">Item</div>
      <% end %>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(1);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(1);

    expect(lintResult.offenses[0].message).toBe('Duplicate ID `static-id` found. IDs must be unique within a document.');
  })

  test("fails for non-dynamic ID in until loops", () => {
    const html = dedent`
      <% until condition %>
        <div id="static-id">Item</div>
      <% end %>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(1);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(1);

    expect(lintResult.offenses[0].message).toBe('Duplicate ID `static-id` found. IDs must be unique within a document.');
  })

  test("handles output ERB IDs in conditional flow normally", () => {
    const html = dedent`
      <% if condition %>
        <div id="user-<%= user.id %>">User A</div>
      <% else %>
        <div id="user-<%= user.id %>">User B</div>
      <% end %>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  })

  test("fails for duplicate output ERB IDs within same conditional branch", () => {
    const html = dedent`
      <% if condition %>
        <div id="user-<%= user.id %>">User A</div>
        <div id="user-<%= user.id %>">User A duplicate</div>
      <% end %>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(1);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(1);

    expect(lintResult.offenses[0].message).toBe('Duplicate ID `user-<%= user.id %>` found within the same control flow branch. IDs must be unique within the same control flow branch.');
  })

  test("passes for static ID conflicting with dynamic ID prefix", () => {
    const html = dedent`
      <div id="hello">Static</div>
      <div id="hello<%= suffix %>">Dynamic</div>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  })

  test("passes for dynamic ID conflicting with existing static ID", () => {
    const html = dedent`
      <div id="hello<%= suffix %>">Dynamic</div>
      <div id="hello">Static</div>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  })

  test("passes for non-conflicting static and dynamic IDs", () => {
    const html = dedent`
      <div id="hello">Static</div>
      <div id="goodbye<%= suffix %>">Dynamic</div>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  })

  test.todo("fails for static attribute in a loop context", () => {
    const html = dedent`
      <% @users.each do |user| %>
        <div id="user"></div>
      <% end %>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(1);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(1);

    expect(lintResult.offenses[0].message).toBe('Duplicate ID `user` found. IDs must be unique within a document.');
  })

  test("passes for dynamic attribute in a ERBBlockNode each context", () => {
    const html = dedent`
      <% @users.each do |user| %>
        <div id="<%= user.id %>"></div>
      <% end %>
    `

    const linter = new Linter(Herb, [HTMLNoDuplicateIdsRule]);
    const lintResult = linter.lint(html);

    expect(lintResult.errors).toBe(0);
    expect(lintResult.warnings).toBe(0);
    expect(lintResult.offenses).toHaveLength(0);
  })
})
