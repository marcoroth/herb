import dedent from "dedent"

import { describe, test } from "vitest"

import { ActionViewNoSilentHelperRule } from "../../src/rules/actionview-no-silent-helper.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ActionViewNoSilentHelperRule)

describe("ActionViewNoSilentHelperRule", () => {
  test("output tag with link_to is allowed", () => {
    expectNoOffenses(dedent`
      <%= link_to "Home", root_path %>
    `)
  })

  test("output tag with form_with is allowed", () => {
    expectNoOffenses(dedent`
      <%= form_with model: @user do |f| %>
        <%= f.text_field :name %>
      <% end %>
    `)
  })

  test("output tag with button_to is allowed", () => {
    expectNoOffenses(dedent`
      <%= button_to "Delete", user_path(@user), method: :delete %>
    `)
  })

  test("output tag with content_tag is allowed", () => {
    expectNoOffenses(dedent`
      <%= content_tag :div, "Hello", class: "greeting" %>
    `)
  })

  test("regular HTML elements are allowed", () => {
    expectNoOffenses(dedent`
      <div class="container">
        <p>Hello</p>
      </div>
    `)
  })

  test("silent ERB statements are allowed", () => {
    expectNoOffenses(dedent`
      <% if true %>
        <p>Hello</p>
      <% end %>
    `)
  })

  test("silent tag with link_to is not allowed", () => {
    expectError("Avoid using `<% %>` with `link_to`. Use `<%= %>` to ensure the helper's output is rendered.")

    assertOffenses(dedent`
      <% link_to "Home", root_path %>
    `)
  })

  test("silent tag with content_tag is not allowed", () => {
    expectError("Avoid using `<% %>` with `content_tag`. Use `<%= %>` to ensure the helper's output is rendered.")

    assertOffenses(dedent`
      <% content_tag :div, "Hello", class: "greeting" %>
    `)
  })

  test("silent tag with turbo_frame_tag is not allowed", () => {
    expectError("Avoid using `<% %>` with `turbo_frame_tag`. Use `<%= %>` to ensure the helper's output is rendered.")

    assertOffenses(dedent`
      <% turbo_frame_tag "test" %>
    `)
  })

  test("trimmed silent tag with link_to is not allowed", () => {
    expectError("Avoid using `<%- %>` with `link_to`. Use `<%= %>` to ensure the helper's output is rendered.")

    assertOffenses(dedent`
      <%- link_to "Home", root_path %>
    `)
  })

  test("escaped ERB output tag with tag.div is allowed", () => {
    expectNoOffenses(dedent`
      <%%= tag.div(content) %>
    `)
  })

  test("escaped ERB tag with link_to is allowed", () => {
    expectNoOffenses(dedent`
      <%%= link_to "Home", root_path %>
    `)
  })

  test("escaped ERB output tag with tag.div and content is allowed", () => {
    expectNoOffenses(dedent`
      <%%= tag.div("Hello", class: "greeting") %>
    `)
  })

  test.fails("escaped ERB output tag with tag.div block is allowed", () => {
    expectNoOffenses(dedent`
      <%%= tag.div do %>
        <p>Hello</p>
      <% end %>
    `)
  })

  test("silent tag with tag.div is not allowed", () => {
    expectError("Avoid using `<% %>` with `tag`. Use `<%= %>` to ensure the helper's output is rendered.")

    assertOffenses(dedent`
      <% tag.div "Hello" %>
    `)
  })

  test("silent tag with tag.div inside conditional is not allowed", () => {
    expectError("Avoid using `<% %>` with `tag`. Use `<%= %>` to ensure the helper's output is rendered.")

    assertOffenses(dedent`
      <% if true %>
        <% tag.div "Hello" %>
      <% end %>
    `)
  })

  test("silent tag with postfix conditional is not allowed", () => {
    expectError("Avoid using `<% %>` with `link_to`. Use `<%= %>` to ensure the helper's output is rendered.")

    assertOffenses(dedent`
      <% link_to "Home", root_path if show_link %>
    `)
  })

  test("output tag with postfix conditional is allowed", () => {
    expectNoOffenses(dedent`
      <%= link_to "Home", root_path if show_link %>
    `)
  })

  test("output tag with link_to inside conditional is allowed", () => {
    expectNoOffenses(dedent`
      <% if true %>
        <%= link_to "Foo", foo_path %>
      <% end %>
    `)
  })

  test("output tag with link_to inside loop is allowed", () => {
    expectNoOffenses(dedent`
      <% ["Home", "About"].each do |label| %>
        <%= link_to label, root_path %>
      <% end %>
    `)
  })

  test("output tag with hidden_field_tag inside each loop is allowed", () => {
    expectNoOffenses(dedent`
      <% data.each do |key, value| %>
        <%= hidden_field_tag "form[#{key}]" %>
      <% end %>
    `)
  })

  test("output tag with helpers inside content_for block is allowed", () => {
    expectNoOffenses(dedent`
      <% content_for :mobile_header do %>
        <%= link_to :back, { class: "size-12 block mt-6" } do %>
          <%= image_tag "icons/back.svg", alt: "Back icon", class: "size-6" %>
        <% end %>
        <h1 class="block font-bold text-lg">
          Editing a <%= model.class.name %>
        </h1>
        <span class="block size-12">&nbsp;</span>
      <% end %>
    `)
  })

  test("output tag with helpers inside nested each loop with conditional is allowed", () => {
    expectNoOffenses(dedent`
      <tbody>
        <% projects.each do |project| %>
          <tr>
            <td><a href="<%= project.github_url %>"><%= project.label %></a></td>

            <td>
              <a href="<%= project.version_badge_url %>">
                <%= image_tag project.version_badge_image_url, alt: "#{project.label} on rubygems" %>
              </a>
            </td>

            <td>
              <% if project.ci? %>
                <a href="<%= project.ci_badge_url %>">
                  <%= image_tag project.ci_badge_image_url, alt: "#{project.label} CI status" %>
                </a>
              <% end %>
            </td>
          </tr>
        <% end %>
      </tbody>
    `)
  })

  test("output tag with helpers inside nested conditional with block is allowed", () => {
    expectNoOffenses(dedent`
      <% if @topic.talks_count.to_i > 8 %>
        <%= link_to talks_gem_path(gem_name: @gem.gem_name), class: "link text-primary flex items-center gap-1" do %>
          View all <%= @topic.talks_count %> talks
          <%= fa("arrow-right", size: :xs) %>
        <% end %>
      <% end %>
    `)
  })
})
