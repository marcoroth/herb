import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../src"

import dedent from "dedent"

let formatter: Formatter

describe("Spacing", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("spaces out elements on the top-level", () => {
    const source = dedent`
      <div>One</div>
      <div>Two</div>
      <div>Three</div>
      <div>Four</div>
      <div>Five</div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>One</div>
      <div>Two</div>
      <div>Three</div>
      <div>Four</div>
      <div>Five</div>
    `)
  })

  test("shouldn't space out elements if they are short/related (ul/li)", () => {
    const source = dedent`
      <ul>
        <li>One</li>
        <li>Two</li>
        <li>Three</li>
        <li>Four</li>
        <li>Five</li>
      </ul>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <ul>
        <li>One</li>
        <li>Two</li>
        <li>Three</li>
        <li>Four</li>
        <li>Five</li>
      </ul>
    `)
  })

  test("shouldn't space out elements if they are short/related (nav/link_to)", () => {
    const source = dedent`
      <nav>
        <a href="/one">One</a>
        <a href="/two">Two</a>
        <a href="/three">Three</a>
        <a href="/four">Four</a>
        <a href="/five">Five</a>
      </nav>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <nav>
        <a href="/one">One</a>
        <a href="/two">Two</a>
        <a href="/three">Three</a>
        <a href="/four">Four</a>
        <a href="/five">Five</a>
      </nav>
    `)
  })

  test("spaces out elements one level 1", () => {
    const source = dedent`
      <div>
        <div>One</div>
        <div>Two</div>
        <div>Three</div>
        <div>Four</div>
        <div>Five</div>
      </div>
      <div>Next</div>
      <div>One</div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>
        <div>One</div>
        <div>Two</div>
        <div>Three</div>
        <div>Four</div>
        <div>Five</div>
      </div>

      <div>Next</div>
      <div>One</div>
    `)
  })

  test("spaces out elements very deep", () => {
    const source = dedent`
      <div>
        <div>
          <div>
            <div>One</div>
            <div>Two</div>
            <div>Three</div>
            <div>Four</div>
            <div>Five</div>
          </div>
        </div>
      </div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>
        <div>
          <div>
            <div>One</div>
            <div>Two</div>
            <div>Three</div>
            <div>Four</div>
            <div>Five</div>
          </div>
        </div>
      </div>
    `)
  })

  test("spaces out elements very deep", () => {
    const source = dedent`
      <%= turbo_frame_tag "speakers_without_github" do %>
        <h2 class="mb-4">Speakers without GitHub handles (<%= @speakers_without_github_count %>)</h2>

        <article class="prose mb-6">These speakers are currently missing a GitHub handle. By adding a GitHub handle to their profile, we can enhance their speaker profiles with an avatar and automatically retrieve additional information.</article>

        <div id="speakers" class="grid gap-4 min-w-full mb-6">
          <% @speakers_without_github.each do |speaker| %>
            <%= content_tag :div, id: dom_id(speaker), class: "flex justify-between p-4 rounded-lg border bg-white" do %>
              <span><%= link_to speaker.name, edit_speaker_path(speaker), class: "underline link", data: {turbo_frame: "modal"} %></span>
              <span>
                <%= link_to "https://github.com/search?q=#{speaker.name}&type=users", target: "_blank", class: "underline link" do %>
                  <%= fa("magnifying-glass", style: :regular) %>
                <% end %>
              </span>
            <% end %>
          <% end %>

          <% remaining_speakers_count = (@speakers_without_github_count - @speakers_without_github.count) %>

          <% if remaining_speakers_count.positive? %>
            <div class="flex items-center p-4 rounded-lg border bg-white">
              <span>and <%= remaining_speakers_count %> more</span>
            </div>
          <% end %>
        </div>
      <% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <%= turbo_frame_tag "speakers_without_github" do %>
        <h2 class="mb-4">
          Speakers without GitHub handles (<%= @speakers_without_github_count %>)
        </h2>

        <article class="prose mb-6">
          These speakers are currently missing a GitHub handle. By adding a GitHub
          handle to their profile, we can enhance their speaker profiles with an
          avatar and automatically retrieve additional information.
        </article>

        <div id="speakers" class="grid gap-4 min-w-full mb-6">
          <% @speakers_without_github.each do |speaker| %>
            <%= content_tag :div, id: dom_id(speaker), class: "flex justify-between p-4 rounded-lg border bg-white" do %>
              <span>
                <%= link_to speaker.name, edit_speaker_path(speaker), class: "underline link", data: {turbo_frame: "modal"} %>
              </span>

              <span>
                <%= link_to "https://github.com/search?q=#{speaker.name}&type=users", target: "_blank", class: "underline link" do %>
                  <%= fa("magnifying-glass", style: :regular) %>
                <% end %>
              </span>
            <% end %>
          <% end %>

          <% remaining_speakers_count = (@speakers_without_github_count - @speakers_without_github.count) %>

          <% if remaining_speakers_count.positive? %>
            <div class="flex items-center p-4 rounded-lg border bg-white">
              <span>and <%= remaining_speakers_count %> more</span>
            </div>
          <% end %>
        </div>
      <% end %>
    `)
  })

  describe("Tight Group Tests", () => {
    test("ul/li elements remain tight even with many items", () => {
      const source = dedent`
        <ul>
          <li>First item</li>
          <li>Second item</li>
          <li>Third item</li>
          <li>Fourth item</li>
          <li>Fifth item</li>
          <li>Sixth item</li>
        </ul>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <ul>
          <li>First item</li>
          <li>Second item</li>
          <li>Third item</li>
          <li>Fourth item</li>
          <li>Fifth item</li>
          <li>Sixth item</li>
        </ul>
      `)
    })

    test("ol/li elements remain tight", () => {
      const source = dedent`
        <ol>
          <li>First step</li>
          <li>Second step</li>
          <li>Third step</li>
          <li>Fourth step</li>
        </ol>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <ol>
          <li>First step</li>
          <li>Second step</li>
          <li>Third step</li>
          <li>Fourth step</li>
        </ol>
      `)
    })

    test("select/option elements remain tight", () => {
      const source = dedent`
        <select>
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
          <option value="3">Option 3</option>
          <option value="4">Option 4</option>
          <option value="5">Option 5</option>
        </select>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <select>
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
          <option value="3">Option 3</option>
          <option value="4">Option 4</option>
          <option value="5">Option 5</option>
        </select>
      `)
    })

    test("table elements (tr/td) remain tight", () => {
      const source = dedent`
        <table>
          <tr>
            <td>Cell 1</td>
            <td>Cell 2</td>
            <td>Cell 3</td>
            <td>Cell 4</td>
          </tr>
          <tr>
            <td>Cell 5</td>
            <td>Cell 6</td>
            <td>Cell 7</td>
            <td>Cell 8</td>
          </tr>
        </table>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <table>
          <tr>
            <td>Cell 1</td>
            <td>Cell 2</td>
            <td>Cell 3</td>
            <td>Cell 4</td>
          </tr>

          <tr>
            <td>Cell 5</td>
            <td>Cell 6</td>
            <td>Cell 7</td>
            <td>Cell 8</td>
          </tr>
        </table>
      `)
    })

    test("definition lists (dt/dd) remain tight", () => {
      const source = dedent`
        <dl>
          <dt>Term 1</dt>
          <dd>Definition 1</dd>
          <dt>Term 2</dt>
          <dd>Definition 2</dd>
          <dt>Term 3</dt>
          <dd>Definition 3</dd>
        </dl>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <dl>
          <dt>Term 1</dt>
          <dd>Definition 1</dd>
          <dt>Term 2</dt>
          <dd>Definition 2</dd>
          <dt>Term 3</dt>
          <dd>Definition 3</dd>
        </dl>
      `)
    })
  })

  describe("Spaceable Container Tests", () => {
    test("section elements get spaced", () => {
      const source = dedent`
        <main>
          <section>Section 1</section>
          <section>Section 2</section>
          <section>Section 3</section>
          <section>Section 4</section>
        </main>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <main>
          <section>Section 1</section>
          <section>Section 2</section>
          <section>Section 3</section>
          <section>Section 4</section>
        </main>
      `)
    })

    test("article elements get spaced", () => {
      const source = dedent`
        <div>
          <article>Article 1</article>
          <article>Article 2</article>
          <article>Article 3</article>
        </div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div>
          <article>Article 1</article>
          <article>Article 2</article>
          <article>Article 3</article>
        </div>
      `)
    })

    test("figure elements get spaced", () => {
      const source = dedent`
        <div>
          <figure>Figure 1</figure>
          <figure>Figure 2</figure>
          <figure>Figure 3</figure>
        </div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div>
          <figure>Figure 1</figure>
          <figure>Figure 2</figure>
          <figure>Figure 3</figure>
        </div>
      `)
    })
  })

  describe("Inline Element Tests", () => {
    test("inline elements (span, em, strong) don't get spaced", () => {
      const source = dedent`
        <p>
          <span>Span 1</span>
          <span>Span 2</span>
          <span>Span 3</span>
          <em>Emphasis</em>
          <strong>Strong</strong>
        </p>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <p>
          <span>Span 1</span>
          <span>Span 2</span>
          <span>Span 3</span>
          <em>Emphasis</em>
          <strong>Strong</strong>
        </p>
      `)
    })

    test("anchor tags in paragraphs don't get spaced", () => {
      const source = dedent`
        <p>
          <a href="/1">Link 1</a>
          <a href="/2">Link 2</a>
          <a href="/3">Link 3</a>
          <a href="/4">Link 4</a>
        </p>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <p>
          <a href="/1">Link 1</a>
          <a href="/2">Link 2</a>
          <a href="/3">Link 3</a>
          <a href="/4">Link 4</a>
        </p>
      `)
    })
  })

  describe("Rule of Three Tests", () => {
    test("two elements don't get spaced (below threshold)", () => {
      const source = dedent`
        <div>
          <div>First</div>
          <div>Second</div>
        </div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div>
          <div>First</div>
          <div>Second</div>
        </div>
      `)
    })

    test("three elements get spaced (at threshold)", () => {
      const source = dedent`
        <div>
          <div>First</div>
          <div>Second</div>
          <div>Third</div>
        </div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div>
          <div>First</div>
          <div>Second</div>
          <div>Third</div>
        </div>
      `)
    })
  })

  describe("Mixed Content Tests", () => {
    test("mixed tight and spaceable elements", () => {
      const source = dedent`
        <div>
          <section>Section 1</section>
          <section>Section 2</section>
          <nav>
            <a href="/1">Link 1</a>
            <a href="/2">Link 2</a>
            <a href="/3">Link 3</a>
          </nav>
          <section>Section 3</section>
        </div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div>
          <section>Section 1</section>
          <section>Section 2</section>

          <nav>
            <a href="/1">Link 1</a>
            <a href="/2">Link 2</a>
            <a href="/3">Link 3</a>
          </nav>

          <section>Section 3</section>
        </div>
      `)
    })

    test("deeply nested mixed elements", () => {
      const source = dedent`
        <main>
          <article>
            <header>Header</header>
            <section>
              <div>Content 1</div>
              <div>Content 2</div>
              <div>Content 3</div>
            </section>
            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
              <li>Item 3</li>
            </ul>
            <footer>Footer</footer>
          </article>
        </main>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <main>
          <article>
            <header>Header</header>

            <section>
              <div>Content 1</div>
              <div>Content 2</div>
              <div>Content 3</div>
            </section>

            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
              <li>Item 3</li>
            </ul>

            <footer>Footer</footer>
          </article>
        </main>
      `)
    })
  })

  describe("ERB and Dynamic Content Tests", () => {
    test("ERB blocks get spaced when appropriate", () => {
      const source = dedent`
        <div>
          <% if user.present? %>
            <span>Welcome <%= user.name %></span>
          <% end %>
          <% items.each do |item| %>
            <div><%= item %></div>
          <% end %>
          <% unless admin? %>
            <p>Regular user content</p>
          <% end %>
        </div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div>
          <% if user.present? %>
            <span>Welcome <%= user.name %></span>
          <% end %>

          <% items.each do |item| %>
            <div><%= item %></div>
          <% end %>

          <% unless admin? %>
            <p>Regular user content</p>
          <% end %>
        </div>
      `)
    })
  })

  describe("HTML Comment Grouping Tests", () => {
    test("comments followed by elements stay grouped (no spacing)", () => {
      const source = dedent`
        <div>
          <!-- Header comment -->
          <h1>Title</h1>
          <!-- Body comment -->
          <p>Content</p>
          <!-- Footer comment -->
        </div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div>
          <!-- Header comment -->
          <h1>Title</h1>

          <!-- Body comment -->
          <p>Content</p>

          <!-- Footer comment -->
        </div>
      `)
    })

    test("standalone comments get spaced", () => {
      const source = dedent`
        <div>
          <h1>First Section</h1>
          <!-- Standalone comment -->
          <h2>Second Section</h2>
          <!-- Another comment -->
          <h3>Third Section</h3>
        </div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div>
          <h1>First Section</h1>

          <!-- Standalone comment -->
          <h2>Second Section</h2>

          <!-- Another comment -->
          <h3>Third Section</h3>
        </div>
      `)
    })

    test("ERB comments with elements stay grouped", () => {
      const source = dedent`
        <div>
          <%# Debug information %>
          <h1>Page Title</h1>
          <%# User content %>
          <p>Content here</p>
        </div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div>
          <%# Debug information %>
          <h1>Page Title</h1>

          <%# User content %>
          <p>Content here</p>
        </div>
      `)
    })

    test("multiple comments before element stay grouped", () => {
      const source = dedent`
        <div>
          <!-- Component docs -->
          <!-- Author: Jane Doe -->
          <header>Header content</header>
          <main>Main content</main>
        </div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div>
          <!-- Component docs -->
          <!-- Author: Jane Doe -->
          <header>Header content</header>

          <main>Main content</main>
        </div>
      `)
    })
  })
})
