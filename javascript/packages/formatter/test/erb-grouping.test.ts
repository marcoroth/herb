import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../src"
import dedent from "dedent"

let formatter: Formatter

describe("ERB Tag Grouping", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("groups consecutive erb-output tags together", () => {
    const source = dedent`
      <div>
        <%= link_to "Home", root_path %>
        <%= link_to "About", about_path %>
        <%= link_to "Contact", contact_path %>
        <%= link_to "Blog", blog_path %>
      </div>
    `

    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      <div>
        <%= link_to "Home", root_path %>
        <%= link_to "About", about_path %>
        <%= link_to "Contact", contact_path %>
        <%= link_to "Blog", blog_path %>
      </div>
    `)
  })

  test("groups consecutive erb-code tags together", () => {
    const source = dedent`
      <div>
        <% user = current_user %>
        <% time = Time.now %>
        <% count = items.count %>
        <% status = check_status %>
      </div>
    `

    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      <div>
        <% user = current_user %>
        <% time = Time.now %>
        <% count = items.count %>
        <% status = check_status %>
      </div>
    `)
  })

  test("separates erb-output from erb-code with spacing", () => {
    const source = dedent`
      <div>
        <% user = current_user %>
        <% time = Time.now %>
        <%= user.name %>
        <%= time.strftime("%Y") %>
      </div>
    `

    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      <div>
        <% user = current_user %>
        <% time = Time.now %>

        <%= user.name %>
        <%= time.strftime("%Y") %>
      </div>
    `)
  })

  test("ERB comment should stay attached to following element (no spacing)", () => {
    const source = dedent`
      <%# add to project show page %>
      <%= turbo_stream.append "project-todo-lists", partial: "todo_list_card", locals: {todo_list: @todo_list} %>
    `

    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      <%# add to project show page %>
      <%= turbo_stream.append "project-todo-lists", partial: "todo_list_card", locals: {todo_list: @todo_list} %>
    `)
  })
})
