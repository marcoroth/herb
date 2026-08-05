import dedent from "dedent"
import { describe, test } from "vitest"

import { ERBNoSleepRule } from "../../src/rules/erb-no-sleep.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoSleepRule)

describe("ERBNoSleepRule", () => {
  describe("valid cases", () => {
    test("passes for templates without Ruby", () => {
      expectNoOffenses(dedent`
        <div class="card">
          <h1>Hello</h1>
        </div>
      `)
    })

    test("passes for regular method calls", () => {
      expectNoOffenses(dedent`
        <% render partial: "header" %>
        <%= link_to "Home", root_path %>
      `)
    })

    test("passes for sleep called on another receiver", () => {
      expectNoOffenses(dedent`
        <% client.sleep %>
        <% @job.sleep(1) %>
      `)
    })

    test("passes for a local variable named sleep", () => {
      expectNoOffenses(dedent`
        <% sleep = @settings.sleep_duration %>
        <%= sleep %>
      `)
    })

    test("passes for a method named sleep_for", () => {
      expectNoOffenses(dedent`
        <% sleep_for(2) %>
      `)
    })

    test("passes for sleep inside an ERB comment", () => {
      expectNoOffenses(dedent`
        <%# sleep 1 %>
      `)
    })

    test("passes for sleep inside a string", () => {
      expectNoOffenses(dedent`
        <%= tag.span("sleep 1") %>
      `)
    })
  })

  describe("invalid cases", () => {
    test("fails for sleep with an argument", () => {
      expectError("Avoid using `sleep 2` in ERB templates. It blocks the thread rendering the response and delays the page for every request. Remove it, or move the delay outside of the template.")

      assertOffenses(dedent`
        <% sleep 2 %>
      `)
    })

    test("fails for sleep with parentheses", () => {
      expectError("Avoid using `sleep(0.5)` in ERB templates. It blocks the thread rendering the response and delays the page for every request. Remove it, or move the delay outside of the template.")

      assertOffenses(dedent`
        <% sleep(0.5) %>
      `)
    })

    test("fails for sleep without arguments", () => {
      expectError("Avoid using `sleep` in ERB templates. It blocks the thread rendering the response and delays the page for every request. Remove it, or move the delay outside of the template.")

      assertOffenses(dedent`
        <% sleep %>
      `)
    })

    test("fails for sleep in an output tag", () => {
      expectError("Avoid using `sleep 1` in ERB templates. It blocks the thread rendering the response and delays the page for every request. Remove it, or move the delay outside of the template.")

      assertOffenses(dedent`
        <%= sleep 1 %>
      `)
    })

    test("fails for Kernel.sleep", () => {
      expectError("Avoid using `Kernel.sleep(0.5)` in ERB templates. It blocks the thread rendering the response and delays the page for every request. Remove it, or move the delay outside of the template.")

      assertOffenses(dedent`
        <% Kernel.sleep(0.5) %>
      `)
    })

    test("fails for Kernel::sleep", () => {
      expectError("Avoid using `Kernel::sleep(0.5)` in ERB templates. It blocks the thread rendering the response and delays the page for every request. Remove it, or move the delay outside of the template.")

      assertOffenses(dedent`
        <% Kernel::sleep(0.5) %>
      `)
    })

    test("fails for sleep inside a conditional", () => {
      expectError("Avoid using `sleep 3` in ERB templates. It blocks the thread rendering the response and delays the page for every request. Remove it, or move the delay outside of the template.")

      assertOffenses(dedent`
        <% if Rails.env.development? %>
          <% sleep 3 %>
        <% end %>
      `)
    })

    test("fails for sleep inside a block", () => {
      expectError("Avoid using `sleep 0.1` in ERB templates. It blocks the thread rendering the response and delays the page for every request. Remove it, or move the delay outside of the template.")

      assertOffenses(dedent`
        <% @products.each do |product| %>
          <% sleep 0.1 %>
          <%= product.name %>
        <% end %>
      `)
    })

    test("fails for sleep used as a modifier statement", () => {
      expectError("Avoid using `sleep 1` in ERB templates. It blocks the thread rendering the response and delays the page for every request. Remove it, or move the delay outside of the template.")

      assertOffenses(dedent`
        <% sleep 1 if @slow %>
      `)
    })

    test("fails for sleep inside an attribute value", () => {
      expectError("Avoid using `sleep 1` in ERB templates. It blocks the thread rendering the response and delays the page for every request. Remove it, or move the delay outside of the template.")

      assertOffenses(dedent`
        <div class="<%= sleep 1 %>"></div>
      `)
    })

    test("fails for multiple sleep calls", () => {
      expectError("Avoid using `sleep 1` in ERB templates. It blocks the thread rendering the response and delays the page for every request. Remove it, or move the delay outside of the template.")
      expectError("Avoid using `sleep 2` in ERB templates. It blocks the thread rendering the response and delays the page for every request. Remove it, or move the delay outside of the template.")

      assertOffenses(dedent`
        <% sleep 1 %>
        <% sleep 2 %>
      `)
    })

    test("reports the correct message and location when preceded by a multi-byte character", () => {
      expectError(
        "Avoid using `sleep 1` in ERB templates. It blocks the thread rendering the response and delays the page for every request. Remove it, or move the delay outside of the template.",
        [2, 3],
      )

      assertOffenses(dedent`
        <%# é %>
        <% sleep 1 %>
      `)
    })
  })
})
