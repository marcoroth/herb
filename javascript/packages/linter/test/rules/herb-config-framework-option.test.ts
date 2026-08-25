import dedent from "dedent"
import { describe, test } from "vitest"

import { HerbConfigFrameworkOptionRule } from "../../src/rules/herb-config-framework-option.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectInfo, assertOffenses } = createLinterTest(HerbConfigFrameworkOptionRule)

describe("HerbConfigFrameworkOptionRule", () => {
  describe("valid cases", () => {
    test("passes when the project configures a framework", () => {
      expectNoOffenses('<%= image_tag "logo.png" %>', { framework: "actionview" })
    })

    test("passes when the project configures `ruby` deliberately", () => {
      expectNoOffenses('<%= image_tag "logo.png" %>', { framework: "ruby" })
    })

    test("passes for a template with no Ruby at all once a framework is configured", () => {
      expectNoOffenses("<div>Hello</div>", { framework: "ruby" })
    })
  })

  describe("without any framework signal", () => {
    test("reports a template with no Ruby", () => {
      expectInfo("No `framework` is set in `.herb.yml`, so Herb assumes plain `ruby` templates. Set `framework` to one of `ruby`, `actionview`, `hanami`, or `sinatra` so Herb can tailor its assumptions, rules, and optimizations to your framework.")

      assertOffenses(dedent`
        <div class="card">
          <h1>Hello</h1>
        </div>
      `)
    })

    test("reports a template whose Ruby says nothing about the framework", () => {
      expectInfo("No `framework` is set in `.herb.yml`, so Herb assumes plain `ruby` templates. Set `framework` to one of `ruby`, `actionview`, `hanami`, or `sinatra` so Herb can tailor its assumptions, rules, and optimizations to your framework.")

      assertOffenses(dedent`
        <% user = User.new %>
        <%= user.name %>
      `)
    })

    test("reports helper names that any project could define, without suggesting Action View", () => {
      expectInfo("No `framework` is set in `.herb.yml`, so Herb assumes plain `ruby` templates. Set `framework` to one of `ruby`, `actionview`, `hanami`, or `sinatra` so Herb can tailor its assumptions, rules, and optimizations to your framework.")

      assertOffenses(dedent`
        <%= render "header" %>
        <%= t("hello") %>
        <%= params[:query] %>
        <%= truncate(post.body) %>
      `)
    })

    test("reports a helper name called on a receiver without suggesting Action View", () => {
      expectInfo("No `framework` is set in `.herb.yml`, so Herb assumes plain `ruby` templates. Set `framework` to one of `ruby`, `actionview`, `hanami`, or `sinatra` so Herb can tailor its assumptions, rules, and optimizations to your framework.")

      assertOffenses('<%= view.image_tag("logo.png") %>')
    })

    test("reports a local variable that shares a helper name without suggesting Action View", () => {
      expectInfo("No `framework` is set in `.herb.yml`, so Herb assumes plain `ruby` templates. Set `framework` to one of `ruby`, `actionview`, `hanami`, or `sinatra` so Herb can tailor its assumptions, rules, and optimizations to your framework.")

      assertOffenses(dedent`
        <% image_tag = "logo.png" %>
        <%= image_tag %>
      `)
    })

    test("reports a helper name inside a string or a comment without suggesting Action View", () => {
      expectInfo("No `framework` is set in `.herb.yml`, so Herb assumes plain `ruby` templates. Set `framework` to one of `ruby`, `actionview`, `hanami`, or `sinatra` so Herb can tailor its assumptions, rules, and optimizations to your framework.")

      assertOffenses(dedent`
        <%# image_tag "logo.png" %>
        <%= "image_tag" %>
      `)
    })

    test("reports a method that merely starts with a helper name without suggesting Action View", () => {
      expectInfo("No `framework` is set in `.herb.yml`, so Herb assumes plain `ruby` templates. Set `framework` to one of `ruby`, `actionview`, `hanami`, or `sinatra` so Herb can tailor its assumptions, rules, and optimizations to your framework.")

      assertOffenses('<%= image_tag_for(post) %>')
    })
  })

  describe("with an Action View signal", () => {
    test("suggests Action View for a helper call", () => {
      expectInfo("No `framework` is set in `.herb.yml`, so Herb assumes plain `ruby` templates. `image_tag` is an Action View helper, so this project looks like `actionview`. Set `framework: actionview` to get the rules, assumptions, and optimizations that come with it.")

      assertOffenses('<%= image_tag "logo.png" %>')
    })

    test("suggests Action View for a helper in a silent tag", () => {
      expectInfo("No `framework` is set in `.herb.yml`, so Herb assumes plain `ruby` templates. `content_for` is an Action View helper, so this project looks like `actionview`. Set `framework: actionview` to get the rules, assumptions, and optimizations that come with it.")

      assertOffenses('<% content_for :title, "Home" %>')
    })

    test("suggests Action View for a helper inside a block", () => {
      expectInfo("No `framework` is set in `.herb.yml`, so Herb assumes plain `ruby` templates. `link_to` is an Action View helper, so this project looks like `actionview`. Set `framework: actionview` to get the rules, assumptions, and optimizations that come with it.")

      assertOffenses(dedent`
        <% posts.each do |post| %>
          <%= link_to post.title, post %>
        <% end %>
      `)
    })

    test("suggests Action View for a helper spanning a block", () => {
      expectInfo("No `framework` is set in `.herb.yml`, so Herb assumes plain `ruby` templates. `form_with` is an Action View helper, so this project looks like `actionview`. Set `framework: actionview` to get the rules, assumptions, and optimizations that come with it.")

      assertOffenses(dedent`
        <%= form_with model: @user do |form| %>
          <%= form.text_field :name %>
        <% end %>
      `)
    })

    test("reports once per file, on the first helper", () => {
      expectInfo("No `framework` is set in `.herb.yml`, so Herb assumes plain `ruby` templates. `stylesheet_link_tag` is an Action View helper, so this project looks like `actionview`. Set `framework: actionview` to get the rules, assumptions, and optimizations that come with it.")

      assertOffenses(dedent`
        <%= stylesheet_link_tag "application" %>
        <%= javascript_include_tag "application" %>
        <%= image_tag "logo.png" %>
      `)
    })

    test("suggests Action View for a strict locals declaration", () => {
      expectInfo("No `framework` is set in `.herb.yml`, so Herb assumes plain `ruby` templates. This template declares strict locals, which only Action View reads, so this project looks like `actionview`. Set `framework: actionview` to get the rules, assumptions, and optimizations that come with it.")

      assertOffenses(dedent`
        <%# locals: (title:, subtitle: nil) %>
        <h1><%= title %></h1>
      `, { fileName: "_header.html.erb" })
    })

    test("prefers the strict locals declaration over a local that shares a helper name", () => {
      expectInfo("No `framework` is set in `.herb.yml`, so Herb assumes plain `ruby` templates. This template declares strict locals, which only Action View reads, so this project looks like `actionview`. Set `framework: actionview` to get the rules, assumptions, and optimizations that come with it.")

      assertOffenses(dedent`
        <%# locals: (image_tag:) %>
        <%= image_tag %>
      `, { fileName: "_logo.html.erb" })
    })
  })
})
