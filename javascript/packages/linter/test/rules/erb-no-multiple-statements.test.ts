import dedent from "dedent"
import { describe, test } from "vitest"
import { ERBNoMultipleStatementsRule } from "../../src/rules/erb-no-multiple-statements.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(ERBNoMultipleStatementsRule)

describe("erb-no-multiple-statements", () => {
  test("passes for a single statement in a silent ERB tag", () => {
    expectNoOffenses('<% user = User.find(1) %>')
  })

  test("passes for a single expression in an output ERB tag", () => {
    expectNoOffenses('<%= user.name %>')
  })

  test("passes for an empty ERB tag", () => {
    expectNoOffenses('<%  %>')
  })

  test("passes for an ERB comment", () => {
    expectNoOffenses('<%# this is a comment %>')
  })

  test("passes for an ERB comment with a semicolon", () => {
    expectNoOffenses('<%# this; is a; comment %>')
  })

  test("passes for multiple statements on multiple lines", () => {
    expectNoOffenses(dedent`
      <%
        user = User.find(1)
        post = user.posts.first
      %>
    `)
  })

  test("passes for a single method call", () => {
    expectNoOffenses('<%= render partial: "header" %>')
  })

  test("passes for a single assignment", () => {
    expectNoOffenses('<% @user = current_user %>')
  })

  test("passes for a single method chain", () => {
    expectNoOffenses('<%= user.posts.where(published: true).count %>')
  })

  test("passes for a ternary operator", () => {
    expectNoOffenses('<%= user.admin? ? "Admin" : "User" %>')
  })

  test("passes for single-line ERB tags with single statements next to each other", () => {
    expectNoOffenses(dedent`
      <% user = User.find(1) %>
      <% post = user.posts.first %>
    `)
  })

  test("passes for ERB control flow on a single line", () => {
    expectNoOffenses(dedent`
      <% if user.admin? %>
        <span>Admin</span>
      <% end %>
    `)
  })

  test("fails for two statements separated by a semicolon", () => {
    expectWarning(
      "Avoid multiple Ruby statements in a single-line ERB tag. Split each statement into its own ERB tag for better readability.",
      [1],
    )

    assertOffenses('<% user = User.find(1); post = user.posts.first %>')
  })

  test("fails for two statements in an output ERB tag", () => {
    expectWarning(
      "Avoid multiple Ruby statements in a single-line ERB tag. Split each statement into its own ERB tag for better readability.",
      [1],
    )

    assertOffenses('<%= user = User.find(1); user.name %>')
  })

  test("fails for three statements separated by semicolons", () => {
    expectWarning(
      "Avoid multiple Ruby statements in a single-line ERB tag. Split each statement into its own ERB tag for better readability.",
      [1],
    )

    assertOffenses('<% a = 1; b = 2; c = 3 %>')
  })

  test("fails for multiple statements in a template context", () => {
    expectWarning(
      "Avoid multiple Ruby statements in a single-line ERB tag. Split each statement into its own ERB tag for better readability.",
      [2],
    )

    assertOffenses(dedent`
      <div>
        <% user = User.find(1); post = user.posts.first %>
      </div>
    `)
  })

  test("reports multiple offenses for multiple single-line ERB tags with multiple statements", () => {
    expectWarning(
      "Avoid multiple Ruby statements in a single-line ERB tag. Split each statement into its own ERB tag for better readability.",
      [1],
    )

    expectWarning(
      "Avoid multiple Ruby statements in a single-line ERB tag. Split each statement into its own ERB tag for better readability.",
      [2],
    )

    assertOffenses(dedent`
      <% a = 1; b = 2 %>
      <% c = 3; d = 4 %>
    `)
  })
})
