import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../src"
import { createExpectFormattedToMatch } from "./helpers"

import dedent from "dedent"

let formatter: Formatter
let expectFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>

describe("Document-level formatting", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
    expectFormattedToMatch = createExpectFormattedToMatch(formatter)
  })

  test("preserves newline between ERB assignment and HTML element", () => {
    const source = dedent`
      <% array = ["One", "Two", "Three"] %>

      <ul>
        <% array.each do |item| %>
          <li><%= item %></li>
        <% end %>
      </ul>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% array = ["One", "Two", "Three"] %>

      <ul>
        <% array.each do |item| %>
          <li><%= item %></li>
        <% end %>
      </ul>
    `)
  })

  test("preserves newline between multiple ERB blocks", () => {
    const source = dedent`
      <% title = "Hello World" %>

      <% content = "Some content" %>

      <div><%= title %></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% title = "Hello World" %>

      <% content = "Some content" %>

      <div><%= title %></div>
    `)
  })

  test("preserves newline between HTML elements", () => {
    const source = dedent`
      <div>First section</div>

      <div>Second section</div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>First section</div>

      <div>Second section</div>
    `)
  })

  test("preserves newline between ERB block and HTML", () => {
    const source = dedent`
      <% if user.present? %>
        <span>Welcome <%= user.name %></span>
      <% end %>

      <main>
        <p>Main content</p>
      </main>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% if user.present? %>
        <span>Welcome <%= user.name %></span>
      <% end %>

      <main>
        <p>Main content</p>
      </main>
    `)
  })

  test("preserves multiple blank lines as single blank line", () => {
    const source = dedent`
      <% variable = "test" %>



      <div>Content</div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% variable = "test" %>

      <div>Content</div>
    `)
  })

  test("adds newlines between top-level elements when none exist", () => {
    const source = dedent`
      <% title = "Test" %>
      <div><%= title %></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% title = "Test" %>

      <div><%= title %></div>
    `)
  })

  test("handles complex document with mixed ERB and HTML", () => {
    const source = dedent`
      <% page_title = "User Profile" %>
      <% user_data = { name: "John", age: 30 } %>

      <!DOCTYPE html>
      <html>
        <head>
          <title><%= page_title %></title>
        </head>

        <body>
          <% if user_data %>
            <h1>Welcome <%= user_data[:name] %></h1>
            <p>Age: <%= user_data[:age] %></p>
          <% end %>

          <footer>
            <p>&copy; 2024</p>
          </footer>
        </body>
      </html>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% page_title = "User Profile" %>
      <% user_data = { name: "John", age: 30 } %>

      <!DOCTYPE html>

      <html>
        <head>
          <title><%= page_title %></title>
        </head>

        <body>
          <% if user_data %>
            <h1>Welcome <%= user_data[:name] %></h1>
            <p>Age: <%= user_data[:age] %></p>
          <% end %>

          <footer>
            <p>&copy; 2024</p>
          </footer>
        </body>
      </html>
    `)
  })

  test("preserves newlines around comments", () => {
    const source = dedent`
      <% # This is a comment %>

      <div>Content</div>

      <%# Another comment %>

      <p>More content</p>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% # This is a comment %>

      <div>Content</div>

      <%# Another comment %>

      <p>More content</p>
    `)
  })

  test("handles ERB loops with proper spacing", () => {
    const source = dedent`
      <% items = [1, 2, 3] %>

      <% items.each do |item| %>
        <div class="item">
          <span><%= item %></span>
        </div>
      <% end %>

      <div class="footer">Done</div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% items = [1, 2, 3] %>

      <% items.each do |item| %>
        <div class="item"><span><%= item %></span></div>
      <% end %>

      <div class="footer">Done</div>
    `)
  })

  test("adds newlines between adjacent ERB and HTML with no spacing", () => {
    const source = `<% user = current_user %><div>Hello</div><% if user %><span>Welcome</span><% end %>`
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% user = current_user %>

      <div>Hello</div>

      <% if user %>
        <span>Welcome</span>
      <% end %>
    `)
  })

  test("handles single line with multiple elements", () => {
    const source = `<h1>Title</h1><p>Content</p><footer>Footer</footer>`
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <h1>Title</h1>
      <p>Content</p>
      <footer>Footer</footer>
    `)
  })

  test("splits mixed content with nested block elements properly", () => {
    const source = dedent`
      <div>hello <div>complex <span>nested</span> content</div> world</div>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>
        hello
        <div>complex <span>nested</span> content</div>
        world
      </div>
    `)
  })

  test("handles mixed content in paragraph with block elements", () => {
    const source = dedent`
      <p>hello <div>complex <span>nested</span> content</div> world</p>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>
        hello
        <div>complex <span>nested</span> content</div>
        world
      </p>
    `)
  })

  test("formats nested paragraph in div with mixed content", () => {
    const source = dedent`
      <div>hello <p>complex <span>nested</span> content</p> world</div>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>
        hello
        <p>complex <span>nested</span> content</p>
        world
      </div>
    `)
  })

  test("keeps inline elements inline when content fits on one line", () => {
    const source = dedent`
      <p>hello <b>complex <span>nested</span> content</b> world</p>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>hello <b>complex <span>nested</span> content</b> world</p>
    `)
  })

  test("keeps HTML elements with ERB conditionals inline when content is short", () => {
    const source = dedent`
      <span <% if true %> class="one" <% end %> another="attribute" final="one">Content</span>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <span <% if true %> class="one" <% end %> another="attribute" final="one">Content</span>
    `)
  })

  test("splits HTML elements with ERB conditionals when there are more than three attribites", () => {
    const source = dedent`
      <span <% if true %> class="one" <% end %> another="attribute" one="more" final="one">Content</span>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <span
        <% if true %>
          class="one"
        <% end %>
        another="attribute"
        one="more"
        final="one"
      >
        Content
      </span>
    `)
  })

  test("splits HTML elements with ERB conditionals with elsewhen there are more than three attribites", () => {
    const source = dedent`
      <span <% if true %> class="one" <% else %> another="attribute" <% end %> one="more" final="one">Content</span>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <span
        <% if true %>
          class="one"
        <% else %>
          another="attribute"
        <% end %>
        one="more"
        final="one"
      >
        Content
      </span>
    `)
  })

  test("formats regular HTML elements in multiline when attributes > 3", () => {
    const source = dedent`
      <div id="element" class="bg-gray-300" another="attribute" final="one">Content</div>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div
        id="element"
        class="bg-gray-300"
        another="attribute"
        final="one"
      >
        Content
      </div>
    `)
  })

  test("formats HTML elements with ERB conditionals in multiline when total attributes > 3", () => {
    const source = dedent`
      <div <% if disabled? %> disabled <% end %> id="element" class="bg-gray-300" another="attribute" final="one">Content</div>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div
        <% if disabled? %>
          disabled
        <% end %>
        id="element"
        class="bg-gray-300"
        another="attribute"
        final="one"
      >
        Content
      </div>
    `)
  })

  test("formats self-closing tags with ERB conditionals in multiline when total attributes > 3", () => {
    const source = dedent`
      <input <% if disabled? %> disabled <% end %> id="element" class="bg-gray-300" another="attribute" final="one" />
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <input
        <% if disabled? %>
          disabled
        <% end %>
        id="element"
        class="bg-gray-300"
        another="attribute"
        final="one"
      />
    `)
  })

  test("keeps self-closing tags with ERB conditionals inline when total attributes <= 3", () => {
    const source = dedent`
      <input <% if disabled? %> disabled <% end %> id="element" />
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <input <% if disabled? %> disabled <% end %> id="element" />
    `)
  })

  test("formats void elements with ERB conditionals in multiline when total attributes > 3", () => {
    const source = dedent`
      <input <% if disabled? %> disabled <% end %> id="element" class="bg-gray-300" another="attribute" final="one">
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <input
        <% if disabled? %>
          disabled
        <% end %>
        id="element"
        class="bg-gray-300"
        another="attribute"
        final="one"
      >
    `)
  })

  test("keeps void elements with ERB conditionals inline when total attributes <= 3", () => {
    const source = dedent`
      <input <% if disabled? %> disabled <% end %> id="element">
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <input <% if disabled? %> disabled <% end %> id="element">
    `)
  })

  test("handles multiple ERB conditionals with attributes correctly", () => {
    const source = dedent`
      <div <% if disabled? %> disabled <% end %> <% if hidden? %> hidden <% end %> id="element" class="test">Content</div>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div
        <% if disabled? %>
          disabled
        <% end %>
        <% if hidden? %>
          hidden
        <% end %>
        id="element"
        class="test"
      >
        Content
      </div>
    `)
  })

  test("keeps simple ERB conditionals with few attributes inline", () => {
    const source = dedent`
      <span <% if active? %> class="active" <% end %>>Text</span>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <span <% if active? %> class="active" <% end %>>Text</span>
    `)
  })

  test("preserves inline opening tag for block elements with few attributes", () => {
    expectFormattedToMatch(dedent`
      <div class="flex flex-col">
        <h3 class="line-clamp-1">
          <pre>Content</pre>
        </h3>
      </div>
    `)
  })

  test("split ERB tag if it doesn't fit on current line", () => {
    const source = dedent`
      <div class="mt-6 block md:grid gap-8 overflow-scroll"><%= render partial: "cfp/event_list", locals: {events: @events} %></div>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div class="mt-6 block md:grid gap-8 overflow-scroll">
        <%= render partial: "cfp/event_list", locals: {events: @events} %>
      </div>
    `)
  })

  test("preserves ERB expressions in style attributes without adding extra spaces", () => {
    const source = dedent`
      <div style="background: '<%= url %>';">test</div>
      <div
        class="w-full lg:h-92 p-4 lg:p-16 border rounded-[25px] lg:rounded-[50px] text-center lg:text-left"
        style="
          color: <%= event.static_metadata.featured_color %>;
          <% if event.static_metadata.featured_background.start_with?("data:") %>
            background: url('<%= event.static_metadata.featured_background %>');
            background-repeat: no-repeat;
            background-size: cover;
          <% else %>
            background: <%= event.static_metadata.featured_background %>;
          <% end %>
        "
      >
        Content
      </div>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div style="background: '<%= url %>';">test</div>

      <div
        class="
          w-full lg:h-92 p-4 lg:p-16 border rounded-[25px] lg:rounded-[50px]
          text-center lg:text-left
        "
        style="
          color: <%= event.static_metadata.featured_color %>;
          <% if event.static_metadata.featured_background.start_with?("data:") %>
            background: url('<%= event.static_metadata.featured_background %>');
            background-repeat: no-repeat;
            background-size: cover;
          <% else %>
            background: <%= event.static_metadata.featured_background %>;
          <% end %>
        "
      >
        Content
      </div>
    `)
  })

  test("https://github.com/rubyevents/rubyevents/blob/390ffa561e5a3392ed20d061948c27824c239f28/app/views/events/_featured.html.erb", () => {
    const source = dedent`
      <div
        class="w-full lg:h-92 p-4 lg:p-16 border rounded-[25px] lg:rounded-[50px] text-center lg:text-left"
        style="
          color: <%= event.static_metadata.featured_color %>;
          <% if event.static_metadata.featured_background.start_with?("data:") %>
            background: url('<%= event.static_metadata.featured_background %>');
            background-repeat: no-repeat;
            background-size: cover;
          <% else %>
            background: <%= event.static_metadata.featured_background %>;
          <% end %>
        ">
        <a href="<%= event_path(event) %>">
          <div class="lg:grid grid-cols-[1fr_2fr]">
            <div>
              <div class="flex justify-center mb-9">
                <%= image_tag event.featured_image_path, class: "w-1/2 max-h-none lg:w-full", loading: "lazy", width: 615, height: 350, alt: event.name %>
              </div>

              <div class="flex flex-col gap-3 lg:h-48 lg:max-h-48 overflow-hidden items-center lg:items-start">
                <h1 class="text-inherit font-bold text-xl line-clamp-1 lg:line-clamp-2"><%= event.name %></h1>
                <h2 class="text-inherit opacity-60 text-sm line-clamp-1"><%= event.static_metadata.location %> • <%= event.formatted_dates %></h2>
                <h2 class="text-inherit font-medium text-sm line-clamp-3 hidden lg:block">
                  <%= event.description %>

                  <%= home_updated_text(event) %>
                </h2>
              </div>

              <%= ui_button kind: :rounded, class: "btn-sm lg:btn-md my-4" do %>
                <span>Explore Talks</span>
              <% end %>
            </div>

            <div class="hidden lg:flex flex-col justify-center items-center">
              <div>
                <div class="avatar-group -space-x-6 rtl:space-x-reverse">
                  <% shown_speakers = [] %>

                  <% all_speakers = event.speakers.to_a %>
                  <% speakers_with_avatars = all_speakers.select { |speaker| speaker.avatar_url.present? }.sort_by(&:avatar_rank) %>

                  <% event.keynote_speakers.each do |keynote_speaker| %>
                    <% shown_speakers << keynote_speaker %>

                    <div class="avatar bg-white">
                      <div class="w-12 lg:w-28 xl:w-40">
                        <img src="<%= keynote_speaker.avatar_url %>" onerror="this.parentElement.parentElement.remove()" loading="lazy" alt="<%= keynote_speaker.name %>">
                      </div>
                    </div>
                  <% end %>

                  <% if event.keynote_speakers.none? %>
                    <% speakers_with_avatars.first(4).each do |speaker| %>
                      <% shown_speakers << speaker %>

                      <div class="avatar bg-white">
                        <div class="w-12 lg:w-28 xl:w-40">
                          <img src="<%= speaker.avatar_url %>" loading="lazy" alt="<%= speaker.name %>">
                        </div>
                      </div>
                    <% end %>
                  <% end %>
                </div>
              </div>

              <div class="mt-12">
                <div class="avatar-group -space-x-6 lg:-space-x-3 rtl:space-x-reverse">
                  <% remaining_speakers = speakers_with_avatars - shown_speakers %>

                  <% if remaining_speakers.any? %>
                    <% remaining_speakers.first(10).each do |speaker| %>
                      <% shown_speakers << speaker %>

                      <div class="avatar bg-white">
                        <div class="w-8 xl:w-12">
                          <img src="<%= speaker.avatar_url %>" loading="lazy" alt="<%= speaker.name %>">
                        </div>
                      </div>
                    <% end %>
                  <% end %>

                  <% more_speakers_count = all_speakers.count - shown_speakers.count %>

                  <% if more_speakers_count.positive? %>
                    <div class="avatar placeholder">
                      <div class="bg-neutral text-neutral-content w-8 xl:w-12">
                        <span>+<%= more_speakers_count %></span>
                      </div>
                    </div>
                  <% end %>
                </div>
              </div>
            </div>

          </div>
        </a>
      </div>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div
        class="
          w-full lg:h-92 p-4 lg:p-16 border rounded-[25px] lg:rounded-[50px]
          text-center lg:text-left
        "
        style="
          color: <%= event.static_metadata.featured_color %>;
          <% if event.static_metadata.featured_background.start_with?("data:") %>
            background: url('<%= event.static_metadata.featured_background %>');
            background-repeat: no-repeat;
            background-size: cover;
          <% else %>
            background: <%= event.static_metadata.featured_background %>;
          <% end %>
        "
      >
        <a href="<%= event_path(event) %>">
          <div class="lg:grid grid-cols-[1fr_2fr]">
            <div>
              <div class="flex justify-center mb-9">
                <%= image_tag event.featured_image_path, class: "w-1/2 max-h-none lg:w-full", loading: "lazy", width: 615, height: 350, alt: event.name %>
              </div>

              <div
                class="
                  flex flex-col gap-3 lg:h-48 lg:max-h-48 overflow-hidden
                  items-center lg:items-start
                "
              >
                <h1 class="text-inherit font-bold text-xl line-clamp-1 lg:line-clamp-2">
                  <%= event.name %>
                </h1>

                <h2 class="text-inherit opacity-60 text-sm line-clamp-1">
                  <%= event.static_metadata.location %> •
                  <%= event.formatted_dates %>
                </h2>

                <h2 class="text-inherit font-medium text-sm line-clamp-3 hidden lg:block">
                  <%= event.description %>

                  <%= home_updated_text(event) %>
                </h2>
              </div>

              <%= ui_button kind: :rounded, class: "btn-sm lg:btn-md my-4" do %>
                <span>Explore Talks</span>
              <% end %>
            </div>

            <div class="hidden lg:flex flex-col justify-center items-center">
              <div>
                <div class="avatar-group -space-x-6 rtl:space-x-reverse">
                  <% shown_speakers = [] %>

                  <% all_speakers = event.speakers.to_a %>
                  <% speakers_with_avatars = all_speakers.select { |speaker| speaker.avatar_url.present? }.sort_by(&:avatar_rank) %>

                  <% event.keynote_speakers.each do |keynote_speaker| %>
                    <% shown_speakers << keynote_speaker %>

                    <div class="avatar bg-white">
                      <div class="w-12 lg:w-28 xl:w-40">
                        <img
                          src="<%= keynote_speaker.avatar_url %>"
                          onerror="this.parentElement.parentElement.remove()"
                          loading="lazy"
                          alt="<%= keynote_speaker.name %>"
                        >
                      </div>
                    </div>
                  <% end %>

                  <% if event.keynote_speakers.none? %>
                    <% speakers_with_avatars.first(4).each do |speaker| %>
                      <% shown_speakers << speaker %>

                      <div class="avatar bg-white">
                        <div class="w-12 lg:w-28 xl:w-40">
                          <img
                            src="<%= speaker.avatar_url %>"
                            loading="lazy"
                            alt="<%= speaker.name %>"
                          >
                        </div>
                      </div>
                    <% end %>
                  <% end %>
                </div>
              </div>

              <div class="mt-12">
                <div class="avatar-group -space-x-6 lg:-space-x-3 rtl:space-x-reverse">
                  <% remaining_speakers = speakers_with_avatars - shown_speakers %>

                  <% if remaining_speakers.any? %>
                    <% remaining_speakers.first(10).each do |speaker| %>
                      <% shown_speakers << speaker %>

                      <div class="avatar bg-white">
                        <div class="w-8 xl:w-12">
                          <img
                            src="<%= speaker.avatar_url %>"
                            loading="lazy"
                            alt="<%= speaker.name %>"
                          >
                        </div>
                      </div>
                    <% end %>
                  <% end %>

                  <% more_speakers_count = all_speakers.count - shown_speakers.count %>

                  <% if more_speakers_count.positive? %>
                    <div class="avatar placeholder">
                      <div class="bg-neutral text-neutral-content w-8 xl:w-12">
                        <span>+<%= more_speakers_count %></span>
                      </div>
                    </div>
                  <% end %>
                </div>
              </div>
            </div>
          </div>
        </a>
      </div>
    `)
  })

  test("preserves space between tag name and attributes (issue #477)", () => {
    const source = dedent`
      <pre><tt id="id">x</tt></pre>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <pre><tt id="id">x</tt></pre>
    `)
  })

  test("preserves space between tag name and attributes with multiple attributes", () => {
    const source = dedent`
      <span class="test" id="example">content</span>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <span class="test" id="example">content</span>
    `)
  })

  test("preserves space between tag name and attributes in pre tag with multiple attributes", () => {
    const source = dedent`
      <pre><span class="test" id="example" data-value="123">content</span></pre>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <pre><span class="test" id="example" data-value="123">content</span></pre>
    `)
  })

  test("preserves space between tag name and attributes in pre tag with mixed content", () => {
    const source = dedent`
      <pre>Some text <tt id="id">code</tt> more text</pre>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <pre>Some text <tt id="id">code</tt> more text</pre>
    `)
  })

  test("preserves space for nested HTML elements in other content-preserving tags", () => {
    const source = dedent`
      <textarea><input type="text" id="test"></textarea>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <textarea><input type="text" id="test"></textarea>
    `)
  })

  test("preserves multi-line content in pre tag with exact whitespace", () => {
    const source = dedent`
      <pre>
      function hello() {
        console.log("world");
          return true;
      }
      </pre>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <pre>
      function hello() {
        console.log("world");
          return true;
      }
      </pre>
    `)
  })

  test("preserves multi-line content with HTML elements and exact spacing", () => {
    const source = dedent`
      <pre>Line 1
      Line 2 with <tt id="code">inline code</tt>
        Indented line 3
      <span class="highlight">Line 4 highlighted</span>
      Final line</pre>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <pre>Line 1
      Line 2 with <tt id="code">inline code</tt>
        Indented line 3
      <span class="highlight">Line 4 highlighted</span>
      Final line</pre>
    `)
  })

  test("preserves leading and trailing whitespace in pre tag", () => {
    const source = dedent`
      <pre>
          Leading and trailing spaces preserved
        <code id="sample">some code</code>
         </pre>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <pre>
          Leading and trailing spaces preserved
        <code id="sample">some code</code>
         </pre>
    `)
  })

  test("preserves tabs and mixed whitespace in pre tag with HTML elements", () => {
    const source = `<pre>\tTab indented
\t\tDouble tab with <em id="emphasis">emphasis</em>
   Mixed   spaces   and\ttabs
\t<strong class="bold">Bold text</strong></pre>`
    const result = formatter.format(source)
    expect(result).toEqual(`<pre>\tTab indented
\t\tDouble tab with <em id="emphasis">emphasis</em>
   Mixed   spaces   and\ttabs
\t<strong class="bold">Bold text</strong></pre>`)
  })

  test("preserves empty lines and spacing in pre tag with HTML", () => {
    const source = dedent`
      <pre>First line

      Line after empty line
      <span id="test">HTML element</span>

      Another empty line above
      </pre>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <pre>First line

      Line after empty line
      <span id="test">HTML element</span>

      Another empty line above
      </pre>
    `)
  })

  test("preserves exact indentation in code blocks with HTML elements", () => {
    const source = dedent`
      <pre>
      function hello() {
        console.log("world");
          return true;
      }
      </pre>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <pre>
      function hello() {
        console.log("world");
          return true;
      }
      </pre>
    `)
  })

  test("preserves content structure in pre with inline HTML and varied indentation", () => {
    const source = dedent`
      <pre>Line 1
      Line 2 with <tt id="code">inline code</tt>
        Indented line 3
      <span class="highlight">Line 4 highlighted</span>
      Final line</pre>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <pre>Line 1
      Line 2 with <tt id="code">inline code</tt>
        Indented line 3
      <span class="highlight">Line 4 highlighted</span>
      Final line</pre>
    `)
  })

  test("preserves whitespace and HTML in complex pre content", () => {
    const source = dedent`
      <pre>
      Simple text content
      <span id="highlight">HTML element with proper spacing</span>
      More text with    multiple    spaces
      </pre>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <pre>
      Simple text content
      <span id="highlight">HTML element with proper spacing</span>
      More text with    multiple    spaces
      </pre>
    `)
  })
})
