import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"
import { createExpectFormattedToMatch } from "../helpers"

import dedent from "dedent"

let formatter: Formatter
let expectFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>

describe("@herb-tools/formatter", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80,
    })

    expectFormattedToMatch = createExpectFormattedToMatch(formatter)
  })

  test("formats simple HTML with ERB content", () => {
    const source = `<div><%= "Hello" %> World</div>`
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div><%= "Hello" %> World</div>
    `)
  })

  test("formats standalone ERB", () => {
    const source = `<% title %>`
    const result = formatter.format(source)
    expect(result).toEqual(`<% title %>`)
  })

  test("ERB output tags on two lines on top-level", () => {
    expectFormattedToMatch(dedent`
      <%= title %>
      <%= title %>
    `)
  })

  test("adjecent ERB output tags without space on top-level", () => {
    const source = `<%= title %><%= title %>`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= title %><%= title %>`)
  })

  test("adjecent ERB output tags with space on top-level", () => {
    const source = `<%= title %> <%= title %>`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= title %> <%= title %>`)
  })

  test("adjecent ERB output tags without space within <p>", () => {
    const source = `<p><%= title %><%= title %></p>`
    const result = formatter.format(source)
    expect(result).toEqual(`<p><%= title %><%= title %></p>`)
  })

  test("adjecent ERB output tags with space within <p>", () => {
    const source = `<p><%= title %> <%= title %></p>`
    const result = formatter.format(source)
    expect(result).toEqual(`<p><%= title %> <%= title %></p>`)
  })

  test("formats nested blocks with final example", () => {
    const source = `
      <div id="output">
        <%= tag.div class: "div" do %>
          <% if true %><span>OK</span><% else %><span>NO</span><% end %>
        <% end %>
      </div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div id="output">
        <%= tag.div class: "div" do %>
          <% if true %>
            <span>OK</span>
          <% else %>
            <span>NO</span>
          <% end %>
        <% end %>
      </div>
    `)
  })

  test("preserves ERB within HTML attributes and content", () => {
    const source = dedent`
      <div>
        <h1 class="<%= classes %>">
          <%= title %>
        </h1>
      </div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>
        <h1 class="<%= classes %>"><%= title %></h1>
      </div>
    `)
  })

  test("should not add extra % to ERB closing tags with quoted strings", () => {
    expectFormattedToMatch(dedent`
      <div>
        <%= link_to "Nederlands", url_for(locale: 'nl'), class: "px-4 py-2 hover:bg-slate-100 rounded block" %>
        <%= link_to "Français", url_for(locale: 'fr'), class: "px-4 py-2 hover:bg-slate-100 rounded block" %>
        <%= link_to "English", url_for(locale: 'en'), class: "px-4 py-2 hover:bg-slate-100 rounded block" %>
      </div>
    `)
  })

  test("should handle complex ERB in layout files", () => {
    const input = dedent`
      <div class="container flex px-5 mx-auto mt-6">
        <% if notice.present? %>
          <div class="block">
            <p class="inline-block px-5 py-2 mb-5 font-medium text-green-500 rounded bg-green-50" id="notice"><%= notice %></p>
          </div>
        <% end %>
      </div>
    `

    const result = formatter.format(input)

    expect(result).not.toContain("% %>")
    expect(result).toContain("<% if notice.present? %>")
    expect(result).toContain("<% end %>")
    expect(result).toContain("<%= notice %>")
  })

  test("handles ERB tags ending with various patterns", () => {
    const inputs = [
      '<%= link_to "test" %>',
      '<%= link_to "test", class: "btn" %>',
      '<%= render "partial" %>',
      "<% if something? %>",
      '<%= tag.div("content") %>',
    ]

    inputs.forEach((input) => {
      const result = formatter.format(input)
      expect(result).not.toContain("% %>")
      expect(result).toBe(input)
    })
  })

  test("preserves ERB content with HTML entities when line wrapping occurs", () => {
    const input = dedent`
      <h3>
        <%= link_to "Start", start_path %>&rsquo;s overview of <%= link_to "Section", section_path %>, <%= link_to "End", end_path %>.
      </h3>
    `

    const result = formatter.format(input)

    expect(result).toBe(dedent`
      <h3>
        <%= link_to "Start", start_path %>&rsquo;s overview of
        <%= link_to "Section", section_path %>, <%= link_to "End", end_path %>.
      </h3>
    `)
  })

  test("preserves complex ERB expressions when exceeding line length", () => {
    const input = dedent`
      <p class="info-text">
        For assistance, contact us at <%= config.phone_number %> or <%= mail_to(config.support_email, class: "email-link") %> if you need help with your account.
      </p>
    `

    const result = formatter.format(input)

    expect(result).toBe(dedent`
      <p class="info-text">
        For assistance, contact us at <%= config.phone_number %> or
        <%= mail_to(config.support_email, class: "email-link") %> if you need help
        with your account.
      </p>
    `)
  })

  test("issue 469: keeps punctuation attached to ERB interpolations and inline elements", () => {
    const input = `<%= @user.translated_greeting %>,<br>`

    const result = formatter.format(input)

    expect(result).toBe(`<%= @user.translated_greeting %>,<br>`)
  })

  test("issue 590: does not duplicate content with inline elements and long lines", () => {
    const input = dedent`
      <p>
        <strong>Hi</strong><br>
        0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567
      </p>
    `

    const result = formatter.format(input)

    expect(result).toBe(dedent`
      <p>
        <strong>Hi</strong><br>
        0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567
      </p>
    `)
  })

  test("issue 588: does not recursively duplicate text and br tags", () => {
    const input = dedent`
      <%= form_with model: @article do |form| %>
        <div>
          <p>
            Text 1
            <br>
            The lantern flickered softly in the wind as the old clock struck midnight
            across the quiet village, casting long shadows that danced upon the
            cobblestone streets.
          </p>
        </div>
      <% end %>
    `

    const result = formatter.format(input)

    expect(result).toBe(dedent`
      <%= form_with model: @article do |form| %>
        <div>
          <p>
            Text 1
            <br>
            The lantern flickered softly in the wind as the old clock struck midnight
            across the quiet village, casting long shadows that danced upon the
            cobblestone streets.
          </p>
        </div>
      <% end %>
    `)

    const secondFormat = formatter.format(result)
    expect(secondFormat).toBe(result)
  })

  test("issue 564: does not duplicate multiline text with br elements", () => {
    const input = dedent`
      <span>
        Par défaut, un dossier déposé peut être complété ou corrigé par le demandeur jusqu'à sa mise en instruction.
        <br>
        Dans une démarche déclarative, une fois déposé, un dossier ne peut plus être modifié. Soit il passe immédiatement en instruction
      </span>
    `

    const result = formatter.format(input)

    expect(result).toBe(dedent`
      <span>
        Par défaut, un dossier déposé peut être complété ou corrigé par le demandeur
        jusqu'à sa mise en instruction.
        <br>
        Dans une démarche déclarative, une fois déposé, un dossier ne peut plus être
        modifié. Soit il passe immédiatement en instruction
      </span>
    `)

    const secondFormat = formatter.format(result)
    expect(secondFormat).toBe(result)
  })

  test("https://github.com/hanakai-rb/site/blob/8adc128d9d464f3e37615be2aa29d57979904533/app/templates/pages/home.html.erb", () => {
    const input = dedent`
      <h1>Hanakai</h1>

      <p>This is the upcoming Hanakai website.</p>

      <p>This will be the all-in-one home for everything to do with <a href="https://hanamirb.org">Hanami</a>, <a href="https://dry-rb.org">Dry</a> and <a href="https://rom-rb.org">Rom</a>.</p>
    `

    const result = formatter.format(input)

    expect(result).toBe(dedent`
      <h1>Hanakai</h1>

      <p>This is the upcoming Hanakai website.</p>

      <p>
        This will be the all-in-one home for everything to do with
        <a href="https://hanamirb.org">Hanami</a>,
        <a href="https://dry-rb.org">Dry</a> and
        <a href="https://rom-rb.org">Rom</a>.
      </p>
    `)

    expect(formatter.format(result)).toBe(result)
  })

  test("https://github.com/marcoroth/herb/issues/436#issuecomment-3220198776", () => {
    const input = dedent`
      <p
        style="margin: 0px; color: #2f2f2b; text-align: center; font-size: 14px; line-height: 20px;"
      >
        Here is some text.
        <br />
        Tel:
        <a
          href="#"
          style="color: #2f2f2b; font-size: 16px; text-decoration: none;"
          itemprop="telephone"
        >
          08-123 456 78
        </a>
      </p>
    `

    const result = formatter.format(input)

    expect(result).toBe(dedent`
      <p
        style="margin: 0px; color: #2f2f2b; text-align: center; font-size: 14px; line-height: 20px;"
      >
        Here is some text.
        <br />
        Tel:
        <a href="#" style="color: #2f2f2b; font-size: 16px; text-decoration: none;" itemprop="telephone"> 08-123 456 78 </a>
      </p>
    `)

    expect(formatter.format(result)).toBe(result)
  })

  test("https://github.com/marcoroth/herb/issues/564#issuecomment-3371485687", () => {
    const input = dedent`
      <p>Should not be duplicated.<br />Text with a inline element<a href="mailto:something@something.com">something@something.com</a> and some more text after</p>
    `

    const result = formatter.format(input)

    expect(result).toBe(dedent`
      <p>
        Should not be duplicated.
        <br />
        Text with a inline
        element<a href="mailto:something@something.com">something@something.com</a>
        and some more text after
      </p>
    `)

    expect(formatter.format(result)).toBe(result)
  })

  test("handles inline HTML elements with long text content", () => {
    const input = dedent`
       <p>
         Visit <a href="/products">our amazing product catalog with hundreds of items</a> or <a href="/support">contact our customer support team</a> for assistance with your order.
       </p>
     `

    const result = formatter.format(input)

    expect(result).toBe(dedent`
       <p>
         Visit
         <a href="/products">our amazing product catalog with hundreds of items</a>
         or <a href="/support">contact our customer support team</a> for assistance
         with your order.
       </p>
     `)
  })

  test("handles multiple inline elements with adjacent text", () => {
    const input = dedent`
       <div>
         Call us at <strong>555-123-4567</strong>, email <a href="mailto:help@example.com">help@example.com</a>, or visit <em>our downtown office</em> during business hours.
       </div>
     `

    const result = formatter.format(input)

    expect(result).toBe(dedent`
       <div>
         Call us at <strong>555-123-4567</strong>, email
         <a href="mailto:help@example.com">help@example.com</a>, or visit
         <em>our downtown office</em> during business hours.
       </div>
     `)
  })

  test("handles inline elements with punctuation attachment", () => {
    const input = dedent`
       <p>
         Read the <a href="/terms">terms and conditions</a>, review our <a href="/privacy">privacy policy</a>, and check the <a href="/faq">frequently asked questions</a>.
       </p>
     `

    const result = formatter.format(input)

    expect(result).toBe(dedent`
       <p>
         Read the <a href="/terms">terms and conditions</a>, review our
         <a href="/privacy">privacy policy</a>, and check the
         <a href="/faq">frequently asked questions</a>.
       </p>
     `)
  })

  test("handles nested inline elements with line wrapping", () => {
    const input = dedent`
       <p>
         Please review <strong>Chapter <em>3: Advanced Techniques</em> in the <a href="/manual">user manual</a></strong> for detailed instructions on configuration.
       </p>
     `

    const result = formatter.format(input)

    expect(result).toBe(dedent`
       <p>
         Please review
         <strong>Chapter <em>3: Advanced Techniques</em> in the <a href="/manual">user manual</a></strong>
         for detailed instructions on configuration.
       </p>
     `)
  })

  test("handles inline elements immediately followed by punctuation", () => {
    const input = dedent`
       <div>
         Download the <a href="/app.zip">latest version</a>; install it quickly; then restart your <strong>computer</strong>!
       </div>
     `

    const result = formatter.format(input)

    expect(result).toBe(dedent`
       <div>
         Download the <a href="/app.zip">latest version</a>; install it quickly; then
         restart your <strong>computer</strong>!
       </div>
     `)
  })

  test("handles mixed content with inline elements and long URLs", () => {
    const input = dedent`
       <p>
         For more information, visit <a href="https://example.com/very/long/path/to/documentation/page">our comprehensive documentation</a> or contact support.
       </p>
     `

    const result = formatter.format(input)

    expect(result).toBe(dedent`
       <p>
         For more information, visit
         <a href="https://example.com/very/long/path/to/documentation/page">our comprehensive documentation</a>
         or contact support.
       </p>
     `)
  })

  test("handles anchor tags with content that forces line breaks", () => {
    const input = dedent`
       <p>
         For more information, visit <a href="https://example.com/very/long/path/to/documentation/page/so/long/that/it/should/break/the/content/of/the/tag">our comprehensive documentation</a> or contact support.
       </p>
     `

    const result = formatter.format(input)

    expect(result).toBe(dedent`
       <p>
         For more information, visit
         <a href="https://example.com/very/long/path/to/documentation/page/so/long/that/it/should/break/the/content/of/the/tag">our comprehensive documentation</a>
         or contact support.
       </p>
     `)
  })

  test("https://github.com/marcoroth/herb/issues/436#issue-3351228515", () => {
    const input = dedent`
      <!DOCTYPE html>
      <html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" data-theme="light">
        <head>
          <meta charset="utf-8">
          <meta http-equiv="x-ua-compatible" content="ie=edge">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
          <meta name="x-apple-disable-message-reformatting">
          <title><%= message.subject %> | Company</title>
          <%= stylesheet_link_tag "mailer", media: "all" %>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
          </style>
          <style>
            @media only screen and (max-width: 600px) {
              .hidden-mobile {
                display: none !important;
              }
            }
            @media only screen and (min-width: 601px) {
              .hidden-desktop {
                display: none !important;
              }
            }
          </style>
        </head>
        <body  style="font-family: 'DM Sans', Arial, sans-serif;">
          <% if content_for?(:preheader) %>
            <div class="hidden">
              <%= yield :preheader %>
            </div>
          <% end %>
          <div role="article" aria-roledescription="email" aria-label="<%= message.subject %>" lang="en">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" class="bg-background leading-normal text-base">
              <tr>
                <td height="32"></td>
              </tr>
              <tr>
                <td align="center">
                  <table border="0" cellpadding="0" cellspacing="0" class="w-full max-w-[684px] px-0 sm:w-[684px] sm-px-2" width="100%">
                    <tr>
                      <td>
                        <div class="shadow-xl border border-border-secondary rounded-lg overflow-hidden">
                          <div class="space-y-2 bg-primary-foreground p-4"><% if content_for?(:header) %>
                              <%= yield :header %>
                            <% else %>
                              <%= hosted_image_tag('mailer/header-logo.png', class: 'h-[35px] block mb-3') %>
                            <% end %>
                            <%= yield %>
                          </div>
                          <div class="p-4 bg-primary-foreground text-center border-t border-border-secondary">
                            <%= hosted_image_tag('mailer/footer-logo.png', class: 'h-[48px] mb-1') %>
                            <p class="text-muted-foreground text-sm leading-5">
                              &copy;<%= Time.current.year %> - Company Inc, All rights reserved.
                              <br />
                              Main Street, San Francisco, CAs, USA 12345
                              <br />
                              <a href="mailto:support@company.com">Contact Support</a> | <a href="https://company.com/terms">Terms of Service</a> | <a href="https://company.com/privacy">Privacy Policy</a>
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td height="32"></td>
              </tr>
            </table>
          </div>
        </body>
      </html>
    `

    const expected = dedent`
      <!DOCTYPE html>

      <html
        xmlns:v="urn:schemas-microsoft-com:vml"
        xmlns:o="urn:schemas-microsoft-com:office:office"
        data-theme="light"
      >
        <head>
          <meta charset="utf-8">
          <meta http-equiv="x-ua-compatible" content="ie=edge">
          <meta name="viewport" content="width=device-width, initial-scale=1">

          <meta
            name="format-detection"
            content="telephone=no, date=no, address=no, email=no, url=no"
          >

          <meta name="x-apple-disable-message-reformatting">

          <title><%= message.subject %> | Company</title>
          <%= stylesheet_link_tag "mailer", media: "all" %>

          <style>
            @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
          </style>

          <style>
            @media only screen and (max-width: 600px) {
              .hidden-mobile {
                display: none !important;
              }
            }
            @media only screen and (min-width: 601px) {
              .hidden-desktop {
                display: none !important;
              }
            }
          </style>
        </head>

        <body style="font-family: 'DM Sans', Arial, sans-serif;">
          <% if content_for?(:preheader) %>
            <div class="hidden"><%= yield :preheader %></div>
          <% end %>

          <div
            role="article"
            aria-roledescription="email"
            aria-label="<%= message.subject %>"
            lang="en"
          >
            <table
              border="0"
              cellpadding="0"
              cellspacing="0"
              width="100%"
              class="bg-background leading-normal text-base"
            >
              <tr>
                <td height="32"></td>
              </tr>

              <tr>
                <td align="center">
                  <table
                    border="0"
                    cellpadding="0"
                    cellspacing="0"
                    class="w-full max-w-[684px] px-0 sm:w-[684px] sm-px-2"
                    width="100%"
                  >
                    <tr>
                      <td>
                        <div
                          class="
                            shadow-xl border border-border-secondary rounded-lg
                            overflow-hidden
                          "
                        >
                          <div class="space-y-2 bg-primary-foreground p-4">
                            <% if content_for?(:header) %>
                              <%= yield :header %>
                            <% else %>
                              <%= hosted_image_tag('mailer/header-logo.png', class: 'h-[35px] block mb-3') %>
                            <% end %>

                            <%= yield %>
                          </div>

                          <div
                            class="
                              p-4 bg-primary-foreground text-center border-t
                              border-border-secondary
                            "
                          >
                            <%= hosted_image_tag('mailer/footer-logo.png', class: 'h-[48px] mb-1') %>

                            <p class="text-muted-foreground text-sm leading-5">
                              &copy;<%= Time.current.year %> - Company Inc, All
                              rights reserved.
                              <br />
                              Main Street, San Francisco, CAs, USA 12345
                              <br />
                              <a href="mailto:support@company.com">Contact Support</a>
                              |
                              <a href="https://company.com/terms">Terms of Service</a>
                              |
                              <a href="https://company.com/privacy">Privacy Policy</a>
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td height="32"></td>
              </tr>
            </table>
          </div>
        </body>
      </html>
    `

    const result = formatter.format(input)
    expect(result).toBe(expected)
  })

  test("https://github.com/marcoroth/herb/issues/436#issuecomment-3219820557 Example 1", () => {
    const input = dedent`
      <% unless skip_sidebar? || sidebar_sections_for_action.blank? %>
      <!-- <details class="d-collapse overflow-visible d-collapse-arrow border" <%= 'open' if params[:commit] == "Filter" && params[:q].present? %>> -->
        <!-- <summary class="d-collapse-title text-xl font-medium">Filters</summary> -->
        <!-- <div class="d-collapse-content"> </div> -->
      <!-- </details> -->
      <%= render "active_admin/shared/sidebar_sections" %>
      <% end %>
    `

    const expected = dedent`
      <% unless skip_sidebar? || sidebar_sections_for_action.blank? %>
        <!-- <details class="d-collapse overflow-visible d-collapse-arrow border" <%= 'open' if params[:commit] == "Filter" && params[:q].present? %>> -->
        <!-- <summary class="d-collapse-title text-xl font-medium">Filters</summary> -->
        <!-- <div class="d-collapse-content"> </div> -->
        <!-- </details> -->
        <%= render "active_admin/shared/sidebar_sections" %>
      <% end %>
    `

    const result = formatter.format(input)
    expect(result).toBe(expected)
  })

  test("https://github.com/marcoroth/herb/issues/436#issuecomment-3219820557 Example 2", () => {
    const input = dedent`
      <div class="relative">
      <button id="column-toggle-btn" class="d-btn d-btn-sm d-btn-secondary">
        <span>Show/Hide Columns</span>
      </button>
      <div id="column-dropdown" class="absolute right-0 mt-1 bg-white border rounded-md shadow-lg z-10 p-2 hidden">
        <div class="flex flex-col space-y-1 min-w-[200px]">
          <% columns.each do |column| %>
            <div class="form-control">
              <label class="cursor-pointer label justify-start gap-2">
                <input type="checkbox" class="column-toggle checkbox checkbox-sm" data-column="<%= column[:name] %>" <%= 'checked' if column[:default_visible] %>>
                <span class="label-text text-muted-foreground">
                  <%= column[:label] %>
                </span>
              </label>
            </div>
          <% end %>
        </div>
      </div>
      </div>

      <script>
      document.addEventListener('DOMContentLoaded', function() {
        // Column toggle functionality
        const columnToggleBtn = document.getElementById('column-toggle-btn');
        const columnDropdown = document.getElementById('column-dropdown');

        // Toggle dropdown visibility
        columnToggleBtn.addEventListener('click', function() {
          columnDropdown.classList.toggle('hidden');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function(event) {
          if (!columnToggleBtn.contains(event.target) && !columnDropdown.contains(event.target)) {
            columnDropdown.classList.add('hidden');
          }
        });

        // Handle column visibility toggles
        const columnToggles = document.querySelectorAll('.column-toggle');
        columnToggles.forEach(toggle => {
          toggle.addEventListener('change', function() {
            const columnName = this.dataset.column;
            const columnCells = document.querySelectorAll(\`.column-\${columnName}\`);

            columnCells.forEach(cell => {
              if (this.checked) {
                cell.style.display = '';
              } else {
                cell.style.display = 'none';
              }
            });

            // Save column visibility preferences to localStorage
            localStorage.setItem(\`column_\${columnName}\`, this.checked ? 'visible' : 'hidden');
          });

          // Apply saved preferences on load
          const columnName = toggle.dataset.column;
          const savedPreference = localStorage.getItem(\`column_\${columnName}\`);

          if (savedPreference === 'hidden') {
            toggle.checked = false;
            const columnCells = document.querySelectorAll(\`.column-\${columnName}\`);
            columnCells.forEach(cell => {
              cell.style.display = 'none';
            });
          }
        });

         columnToggles.forEach(toggle => {
          if (!toggle.checked) {
            const columnName = toggle.dataset.column;
            const columnCells = document.querySelectorAll(\`.column-\${columnName}\`);
            columnCells.forEach(cell => {
              cell.style.display = 'none';
            });
          }
        });
      });
      </script>
     `

    const expected = dedent`
      <div class="relative">
        <button id="column-toggle-btn" class="d-btn d-btn-sm d-btn-secondary">
          <span>Show/Hide Columns</span>
        </button>

        <div
          id="column-dropdown"
          class="
            absolute right-0 mt-1 bg-white border rounded-md shadow-lg z-10 p-2
            hidden
          "
        >
          <div class="flex flex-col space-y-1 min-w-[200px]">
            <% columns.each do |column| %>
              <div class="form-control">
                <label class="cursor-pointer label justify-start gap-2">
                  <input
                    type="checkbox"
                    class="column-toggle checkbox checkbox-sm"
                    data-column="<%= column[:name] %>"
                    <%= 'checked' if column[:default_visible] %>
                  >

                  <span class="label-text text-muted-foreground">
                    <%= column[:label] %>
                  </span>
                </label>
              </div>
            <% end %>
          </div>
        </div>
      </div>

      <script>
      document.addEventListener('DOMContentLoaded', function() {
        // Column toggle functionality
        const columnToggleBtn = document.getElementById('column-toggle-btn');
        const columnDropdown = document.getElementById('column-dropdown');

        // Toggle dropdown visibility
        columnToggleBtn.addEventListener('click', function() {
          columnDropdown.classList.toggle('hidden');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function(event) {
          if (!columnToggleBtn.contains(event.target) && !columnDropdown.contains(event.target)) {
            columnDropdown.classList.add('hidden');
          }
        });

        // Handle column visibility toggles
        const columnToggles = document.querySelectorAll('.column-toggle');
        columnToggles.forEach(toggle => {
          toggle.addEventListener('change', function() {
            const columnName = this.dataset.column;
            const columnCells = document.querySelectorAll(\`.column-\${columnName}\`);

            columnCells.forEach(cell => {
              if (this.checked) {
                cell.style.display = '';
              } else {
                cell.style.display = 'none';
              }
            });

            // Save column visibility preferences to localStorage
            localStorage.setItem(\`column_\${columnName}\`, this.checked ? 'visible' : 'hidden');
          });

          // Apply saved preferences on load
          const columnName = toggle.dataset.column;
          const savedPreference = localStorage.getItem(\`column_\${columnName}\`);

          if (savedPreference === 'hidden') {
            toggle.checked = false;
            const columnCells = document.querySelectorAll(\`.column-\${columnName}\`);
            columnCells.forEach(cell => {
              cell.style.display = 'none';
            });
          }
        });

         columnToggles.forEach(toggle => {
          if (!toggle.checked) {
            const columnName = toggle.dataset.column;
            const columnCells = document.querySelectorAll(\`.column-\${columnName}\`);
            columnCells.forEach(cell => {
              cell.style.display = 'none';
            });
          }
        });
      });
      </script>
    `

    const result = formatter.format(input)
    expect(result).toBe(expected)
  })

  test("https://github.com/marcoroth/herb/issues/436#issuecomment-3219820557 Example 3", () => {
    expectFormattedToMatch(dedent`
      <style>
        [data-test-page-header] {
          margin-bottom: 0px;
        }

        @media (max-width: 768px) {
          [data-test-page-header] nav {
            display: none;
          }
        }
      </style>

      <% content_for :head do %>
        <%= javascript_import_module_tag "src/chat" %>
      <% end %>

      <script>
        window.chat_id = <%= chat.id %>;
        window.chat_display_name = <%= chat.display_name.to_json.html_safe %>;
        window.messages = <%= messages.to_json.html_safe %>;
        window.settings = <%= chat.settings.to_json.html_safe %>;
      </script>

      <div class="pt-3" id="chat"></div>
     `)
  })

  test("https://github.com/marcoroth/herb/issues/436#issuecomment-3219820557 Example 4", () => {
    const input = dedent`
      <% prices = params.dig("subscription", "prices") || resource.price_list.dig("products")&.map { |key, value| {product_id: key, stripe_price_id: value} } || [{product_id: Product::PUBLIC_IDS[:overweight]}] %>
      <%= semantic_form_for [:admin, resource], url: override_prices_admin_subscription_path(resource), method: :post do |f| %>
        <div>
          <%= f.inputs do %>
            <div id="price-inputs-container">
              <% prices.each_with_index do |price, index| %>
                <% stripe_price = Rails.cache.fetch("stripe_price_#{price[:stripe_price_id]}", expires_in: 1.hour) { Stripe::Price.retrieve(price[:stripe_price_id]) } if price[:stripe_price_id].present? %>

                <div class="price-override-item">
                  <%= f.input :product_id,
                    as: :select,
                    collection: Product.all,
                    selected: price[:product_id],
                    label: "Product #{index + 1}",
                    value_field: :public_id,
                    input_html: {
                      name: "subscription[prices][#{index}][product_id]",
                    } %>

                  <%= f.input :amount,
                    as: :number,
                    label: "Price",
                    input_html: {
                      name: "subscription[prices][#{index}][amount]",
                      value: price[:amount]&.to_i || stripe_price&.unit_amount&./(100) || 0,
                      min: 0
                    } %>

                  <% if index > 0 %>
                    <a
                      href="#"
                      class="remove-price-item link text-red-500 hover:text-red-700"
                    >
                      Remove Product
                    </a>
                  <% end %>
                </div>
              <% end %>
            </div>

            <div class="add-price-section">
              <%= link_to "Add Another Product", "#", id: "add-price-btn", class: "button secondary" %>
            </div>
          <% end %>
        </div>

        <script id="price_item_template" type="text/template">
          <div class="price-override-item">
            <%= f.input :product_id,
              as: :select,
              collection: Product.all,
              label: "Product INDEX_LABEL",
              class: "select required",
              value_field: :public_id,
              input_html: {
                id: "subscription_prices_INDEX_product_id",
                name: "subscription[prices][INDEX][product_id]",
                data: {
                  searchable_field: "name",
                  display_field: "display_name",
                  search_url: "/admin/products.json?order=id_desc&q%5Bname_cont%5D={{query}}&commit=Filter"
                }
              } %>
            <%= f.input :amount,
              label: "Custom Price",
              as: :number,
              input_html: {
                id: "subscription_prices_INDEX_amount",
                name: "subscription[prices][INDEX][amount]",
                value: 0,
                min: 0,
              } %>

            <a href="#" class="remove-price-item link text-red-500 hover:text-red-700">Remove Product</a>
          </div>
        </script>

        <div>
          <%= f.actions do %>
            <%= f.action :submit, label: "Override Prices" %>
            <%= link_to "Cancel", resource_path(resource), class: "button" %>
          <% end %>
        </div>
      <% end %>

      <script>
        document.addEventListener('DOMContentLoaded', function() {
          var addPriceBtn = document.querySelector('#add-price-btn');
          var container = document.querySelector('#price-inputs-container');
          var template = document.querySelector('#price_item_template').innerHTML;
          var priceItemCounter = <%= prices.length %>;

          addPriceBtn.addEventListener('click', function(e) {
            e.preventDefault();
            var newTemplate = template
              .replace(/INDEX_LABEL/g, priceItemCounter + 1)
              .replace(/INDEX/g, priceItemCounter);
            container.insertAdjacentHTML('beforeend', newTemplate);

            var newItem = container.querySelector('.price-override-item:last-child');
            var selectElement = newItem.querySelector('select');

            if (selectElement && selectElement.dataset.searchUrl) {
              new TomSelect(selectElement, {
                allowEmptyOption: true,
                create: false,
                itemClass: "text-foreground px-1 py-0.5 rounded",
                valueField: selectElement.dataset.valueField,
                labelField: selectElement.dataset.displayField,
                searchField: [selectElement.dataset.displayField],
                plugins: ['dropdown_input'],

                render: {
                  option: function(data, escape) {
                    return '<div>' + escape(data[selectElement.dataset.displayField] || '[blank]') + '</div>';
                  },
                  item: function(data, escape) {
                    return '<div>' + escape(data[selectElement.dataset.displayField] || '[blank]') + '</div>';
                  },
                },

                load: function(query, callback) {
                  if (!query.length) return callback();
                  fetch(selectElement.dataset.searchUrl.replace('{{query}}', encodeURIComponent(query)))
                    .then(function(response) {
                      return response.json();
                    })
                    .then(function(json) {
                      const augmentedJson = json.map(item => ({ ...item, search_term: Object.values(item).join(' ') }))
                      callback(augmentedJson);
                    }).catch(function() {
                      callback();
                    });
                },
              });
            }

            priceItemCounter++;
          });

          container.addEventListener('click', function(e) {
            if (e.target && e.target.classList.contains('remove-price-item')) {
              e.preventDefault();
              var priceItem = e.target.closest('.price-override-item');
              if (priceItem) {
                var destroyInput = priceItem.querySelector('input[type="hidden"][name*="[_destroy]"]');
                if (destroyInput) {
                  destroyInput.value = '1';
                  priceItem.style.display = 'none';
                } else {
                  priceItem.remove();
                }
              }
            }
          });
        });
      </script>
     `

     const expected = dedent`
       <% prices = params.dig("subscription", "prices") || resource.price_list.dig("products")&.map { |key, value| {product_id: key, stripe_price_id: value} } || [{product_id: Product::PUBLIC_IDS[:overweight]}] %>

       <%= semantic_form_for [:admin, resource], url: override_prices_admin_subscription_path(resource), method: :post do |f| %>
         <div>
           <%= f.inputs do %>
             <div id="price-inputs-container">
               <% prices.each_with_index do |price, index| %>
                 <% stripe_price = Rails.cache.fetch("stripe_price_#{price[:stripe_price_id]}", expires_in: 1.hour) { Stripe::Price.retrieve(price[:stripe_price_id]) } if price[:stripe_price_id].present? %>

                 <div class="price-override-item">
                   <%= f.input :product_id,
                     as: :select,
                     collection: Product.all,
                     selected: price[:product_id],
                     label: "Product #{index + 1}",
                     value_field: :public_id,
                     input_html: {
                       name: "subscription[prices][#{index}][product_id]",
                     } %>

                   <%= f.input :amount,
                     as: :number,
                     label: "Price",
                     input_html: {
                       name: "subscription[prices][#{index}][amount]",
                       value: price[:amount]&.to_i || stripe_price&.unit_amount&./(100) || 0,
                       min: 0
                     } %>

                   <% if index > 0 %>
                     <a
                       href="#"
                       class="remove-price-item link text-red-500 hover:text-red-700"
                     >
                       Remove Product
                     </a>
                   <% end %>
                 </div>
               <% end %>
             </div>

             <div class="add-price-section">
               <%= link_to "Add Another Product", "#", id: "add-price-btn", class: "button secondary" %>
             </div>
           <% end %>
         </div>

         <script id="price_item_template" type="text/template">
           <div class="price-override-item">
             <%= f.input :product_id,
               as: :select,
               collection: Product.all,
               label: "Product INDEX_LABEL",
               class: "select required",
               value_field: :public_id,
               input_html: {
                 id: "subscription_prices_INDEX_product_id",
                 name: "subscription[prices][INDEX][product_id]",
                 data: {
                   searchable_field: "name",
                   display_field: "display_name",
                   search_url: "/admin/products.json?order=id_desc&q%5Bname_cont%5D={{query}}&commit=Filter"
                 }
               } %>
             <%= f.input :amount,
               label: "Custom Price",
               as: :number,
               input_html: {
                 id: "subscription_prices_INDEX_amount",
                 name: "subscription[prices][INDEX][amount]",
                 value: 0,
                 min: 0,
               } %>

             <a href="#" class="remove-price-item link text-red-500 hover:text-red-700">Remove Product</a>
           </div>
         </script>

         <div>
           <%= f.actions do %>
             <%= f.action :submit, label: "Override Prices" %>
             <%= link_to "Cancel", resource_path(resource), class: "button" %>
           <% end %>
         </div>
       <% end %>

       <script>
         document.addEventListener('DOMContentLoaded', function() {
           var addPriceBtn = document.querySelector('#add-price-btn');
           var container = document.querySelector('#price-inputs-container');
           var template = document.querySelector('#price_item_template').innerHTML;
           var priceItemCounter = <%= prices.length %>;

           addPriceBtn.addEventListener('click', function(e) {
             e.preventDefault();
             var newTemplate = template
               .replace(/INDEX_LABEL/g, priceItemCounter + 1)
               .replace(/INDEX/g, priceItemCounter);
             container.insertAdjacentHTML('beforeend', newTemplate);

             var newItem = container.querySelector('.price-override-item:last-child');
             var selectElement = newItem.querySelector('select');

             if (selectElement && selectElement.dataset.searchUrl) {
               new TomSelect(selectElement, {
                 allowEmptyOption: true,
                 create: false,
                 itemClass: "text-foreground px-1 py-0.5 rounded",
                 valueField: selectElement.dataset.valueField,
                 labelField: selectElement.dataset.displayField,
                 searchField: [selectElement.dataset.displayField],
                 plugins: ['dropdown_input'],

                 render: {
                   option: function(data, escape) {
                     return '<div>' + escape(data[selectElement.dataset.displayField] || '[blank]') + '</div>';
                   },
                   item: function(data, escape) {
                     return '<div>' + escape(data[selectElement.dataset.displayField] || '[blank]') + '</div>';
                   },
                 },

                 load: function(query, callback) {
                   if (!query.length) return callback();
                   fetch(selectElement.dataset.searchUrl.replace('{{query}}', encodeURIComponent(query)))
                     .then(function(response) {
                       return response.json();
                     })
                     .then(function(json) {
                       const augmentedJson = json.map(item => ({ ...item, search_term: Object.values(item).join(' ') }))
                       callback(augmentedJson);
                     }).catch(function() {
                       callback();
                     });
                 },
               });
             }

             priceItemCounter++;
           });

           container.addEventListener('click', function(e) {
             if (e.target && e.target.classList.contains('remove-price-item')) {
               e.preventDefault();
               var priceItem = e.target.closest('.price-override-item');
               if (priceItem) {
                 var destroyInput = priceItem.querySelector('input[type="hidden"][name*="[_destroy]"]');
                 if (destroyInput) {
                   destroyInput.value = '1';
                   priceItem.style.display = 'none';
                 } else {
                   priceItem.remove();
                 }
               }
             }
           });
         });
       </script>
     `

    const result = formatter.format(input)
    expect(result).toBe(expected)
  })

  test("https://github.com/marcoroth/herb/issues/436#issuecomment-3219820557 Example 5", () => {
    const input = dedent`
      <%# Non-link tag that stands for skipped pages...
        - available local variables
          current_page:  a page object for the currently displayed page
          total_pages:   total number of pages
          per_page:      number of items to fetch per page
          remote:        data-remote
      -%>
      <span class="flex items-center justify-center px-2.5 py-3 h-8 leading-tight text-gray-500 dark:text-gray-400">
        <%= t('views.pagination.truncate').html_safe %>
      </span>
     `
    const expected = dedent`
      <%#
        Non-link tag that stands for skipped pages...
        - available local variables
          current_page:  a page object for the currently displayed page
          total_pages:   total number of pages
          per_page:      number of items to fetch per page
          remote:        data-remote
      -%>

      <span
        class="
          flex items-center justify-center px-2.5 py-3 h-8 leading-tight
          text-gray-500 dark:text-gray-400
        "
      >
        <%= t('views.pagination.truncate').html_safe %>
      </span>
     `

    const result = formatter.format(input)
    expect(result).toBe(expected)
  })

  test("https://github.com/marcoroth/herb/issues/436#issuecomment-3219820557 Example 6", () => {
    const input = dedent`
      <%= render 'user_mailer/greeting' %>
      <p>
        Welcome back! Your subscription to the <b><%= @subscription.plan&.name || "Custom Plan" %></b> has been successfully resumed.
      </p>
      <p>
      Subscription Details:<br>
      Plan Name: <b><%= @subscription.plan&.name || "Custom Plan" %></b><br>
      Resumption Date: <b><%= render_date(Time.current, format: '%B %e, %Y') %></b><br>
      Pickups Left: <b><%= @subscription.credit_service.available_credits.values.first || 0 %><%= " (#{@subscription.loads * 20}lbs per pickup)" if @subscription.loads > 0 %></b><br>
      Next Billing Date: <b><%= render_date(@subscription.current_period_end, format: '%B %e, %Y') %></b><br>
      </p>

      <p>Why wait now? Schedule your next pickup today!</p>

      <%= render "user_mailer/schedule_now" %>
      <%= render "user_subscription_mailer/more_info" %>
      <%= render "user_mailer/questions" %>
      <p>
      Thank you for choosing Company again. We look forward to serving you!
      </p>
      <%= render "user_mailer/thanks" %>
     `

    const expected = dedent`
      <%= render 'user_mailer/greeting' %>

      <p>
        Welcome back! Your subscription to the
        <b><%= @subscription.plan&.name || "Custom Plan" %></b> has been successfully
        resumed.
      </p>

      <p>
        Subscription Details:
        <br>
        Plan Name: <b><%= @subscription.plan&.name || "Custom Plan" %></b>
        <br>
        Resumption Date: <b><%= render_date(Time.current, format: '%B %e, %Y') %></b>
        <br>
        Pickups Left:
        <b><%= @subscription.credit_service.available_credits.values.first || 0 %><%= " (#{@subscription.loads * 20}lbs per pickup)" if @subscription.loads > 0 %></b>
        <br>
        Next Billing Date:
        <b><%= render_date(@subscription.current_period_end, format: '%B %e, %Y') %></b>
        <br>
      </p>

      <p>Why wait now? Schedule your next pickup today!</p>

      <%= render "user_mailer/schedule_now" %>
      <%= render "user_subscription_mailer/more_info" %>
      <%= render "user_mailer/questions" %>

      <p>
        Thank you for choosing Company again. We look forward to serving you!
      </p>

      <%= render "user_mailer/thanks" %>
     `

    const result = formatter.format(input)
    expect(result).toBe(expected)
  })

  test("https://github.com/marcoroth/herb/issues/436#issuecomment-3356738094", () => {
    expectFormattedToMatch(dedent`
      <% if cover.present? %>
        <figure class="figure">
          <%= image_tag attachment_url(cover), size: "460x249", class: "img-fluid figure-img" %>

          <figcaption class="figure-caption text-center">
            <span>
              <strong>Cover Image</strong><br>
              Dimensions
              <strong>
                <%= "#{cover.metadata['width']}x#{cover.metadata['height']}" %>
              </strong>
              &mdash;
              <%= link_to "View original", rails_blob_path(cover), target: "_blank", rel: "noopener" %>
            </span>
          </figcaption>
        </figure>
      <% end %>
     `)
  })

  test("adjecent ERB text within elements", () => {
    const input = dedent`
      <div>
        <div>
          <div>
            <p><%= formatted %> text that needs <%= needs %> <%= to_be_formatted %> without being reset to the <b><i>start of the line</i></b>. Text<%= also_with %><%= ERB_tags_next_to_each_other %>and after.</p>
          </div>
        </div>
      </div>
    `

    const expected = dedent`
      <div>
        <div>
          <div>
            <p>
              <%= formatted %> text that needs <%= needs %> <%= to_be_formatted %>
              without being reset to the <b><i>start of the line</i></b>.
              Text<%= also_with %><%= ERB_tags_next_to_each_other %>and after.
            </p>
          </div>
        </div>
      </div>
    `

    const result = formatter.format(input)
    expect(result).toBe(expected)
  })

  test("ERB output with adjecent text within HTML element", () => {
    const input = dedent`
      <div><%= icon("icon") %>some text some text some text some text some text</div>
    `

    const expected = dedent`
      <div><%= icon("icon") %>some text some text some text some text some text</div>
    `

    const result = formatter.format(input)
    expect(result).toBe(expected)
  })

  test("ERB output after adjecent text within HTML element", () => {
    const input = dedent`
      <div>some text some text some text some text some text<%= icon("icon") %></div>
    `

    const expected = dedent`
      <div>some text some text some text some text some text<%= icon("icon") %></div>
    `

    const result = formatter.format(input)
    expect(result).toBe(expected)
  })

  test("ERB output with adjecent text within HTML element causing line-break", () => {
    const input = dedent`
      <div><%= icon("icon") %>some text some text some text some text some text some text some text</div>
    `

    const expected = dedent`
      <div>
        <%= icon("icon") %>some text some text some text some text some text some
        text some text
      </div>
    `

    const result = formatter.format(input)
    expect(result).toBe(expected)
  })

  test("ERB output after adjecent text within HTML element causing line-break", () => {
    const input = dedent`
      <div>some text some text some text some text some text some text<%= icon("icon") %></div>
    `

    const expected = dedent`
      <div>
        some text some text some text some text some text some
        text<%= icon("icon") %>
      </div>
    `

    const result = formatter.format(input)
    expect(result).toBe(expected)
  })

  test("ERB output before and after adjecent text within HTML element causing line-break", () => {
    const input = dedent`
      <div>some text some text some text some text some text some text some<%= icon("icon") %>text some text</div>
    `

    const expected = dedent`
      <div>
        some text some text some text some text some text some text
        some<%= icon("icon") %>text some text
      </div>
    `

    const result = formatter.format(input)
    expect(result).toBe(expected)
  })

  test("ERB output with adjecent text within ERB block", () => {
    const input = dedent`
      <%= link_to "/" do %><%= icon("icon") %>some text some text<% end %>
    `

    const expected = dedent`
      <%= link_to "/" do %>
        <%= icon("icon") %>some text some text
      <% end %>
    `

    const result = formatter.format(input)
    expect(result).toBe(expected)
  })

  test("ERB output after adjecent text within ERB block", () => {
    const input = dedent`
      <%= link_to "/" do %>some text some text<%= icon("icon") %><% end %>
    `

    const expected = dedent`
      <%= link_to "/" do %>
        some text some text<%= icon("icon") %>
      <% end %>
    `

    const result = formatter.format(input)
    expect(result).toBe(expected)
  })

  test("ERB output before and after adjecent text within ERB block", () => {
    const input = dedent`
      <%= link_to "/" do %>some text<%= icon("icon") %>some text<% end %>
    `

    const expected = dedent`
      <%= link_to "/" do %>
        some text<%= icon("icon") %>some text
      <% end %>
    `

    const result = formatter.format(input)
    expect(result).toBe(expected)
  })

  test("ERB output with adjecent text within ERB block causing line-break", () => {
    const input = dedent`
      <%= link_to "/" do %><%= icon("icon") %>some text some text some text some text some text some text some text<% end %>
    `

    const expected = dedent`
      <%= link_to "/" do %>
        <%= icon("icon") %>some text some text some text some text some text some
        text some text
      <% end %>
    `

    const result = formatter.format(input)
    expect(result).toBe(expected)
  })

  test("ERB output after adjecent text within ERB block causing line-break", () => {
    const input = dedent`
      <%= link_to "/" do %>some text some text some text some text some text some text some text<%= icon("icon") %><% end %>
    `

    const expected = dedent`
      <%= link_to "/" do %>
        some text some text some text some text some text some text some
        text<%= icon("icon") %>
      <% end %>
    `

    const result = formatter.format(input)
    expect(result).toBe(expected)
  })

  test("ERB output before and after adjecent text within ERB block causing line-break", () => {
    const input = dedent`
      <%= link_to "/" do %>some text some text some text some text some text some text some<%= icon("icon") %>text some text<% end %>
    `

    const expected = dedent`
      <%= link_to "/" do %>
        some text some text some text some text some text some text
        some<%= icon("icon") %>text some text
      <% end %>
    `

    const result = formatter.format(input)
    expect(result).toBe(expected)
  })

  test("ERB output with heredoc (issue 476)", () => {
    expectFormattedToMatch(dedent`
      <%= <<EXAMPLE
      example
      EXAMPLE
      %>
    `)
  })

  test("ERB output with squiggly heredoc", () => {
    expectFormattedToMatch(dedent`
      <%= <<~HEREDOC
        example
      HEREDOC
      %>
    `)
  })

  test("ERB output with hyphen heredoc", () => {
    expectFormattedToMatch(dedent`
      <%= <<-HEREDOC
      example
      HEREDOC
      %>
    `)
  })

  test("ERB output with single-quoted heredoc", () => {
    expectFormattedToMatch(dedent`
      <%= <<'HEREDOC'
      no #{interpolation}
      HEREDOC
      %>
    `)
  })

  test("ERB output with double-quoted heredoc", () => {
    expectFormattedToMatch(dedent`
      <%= <<"HEREDOC"
      with #{interpolation}
      HEREDOC
      %>
    `)
  })

  test("ERB output with heredoc and method chaining", () => {
    expectFormattedToMatch(dedent`
      <%= <<HEREDOC.strip
      example
      HEREDOC
      %>
    `)
  })

  test("ERB output with bitshift operator", () => {
    expectFormattedToMatch(`<%= 1 << 4 %>`)
  })

  test("ERB output with append operator", () => {
    expectFormattedToMatch(`<%= array << item %>`)
  })

  // The heredoc is not detected because it doesn't start with "<<".
  // See: https://github.com/marcoroth/herb/issues/476
  // TODO: revisit once we have access to Prism nodes
  test("ERB output with heredoc as method argument", () => {
    const input = dedent`
      <%= foo(<<HEREDOC)
      example
      HEREDOC
      %>
    `

    const expected = dedent`
      <%= foo(<<HEREDOC)
      example
      HEREDOC %>
    `

    const result = formatter.format(input)

    expect(result).toBe(expected)
  })

  // The heredoc is not detected because it doesn't start with "<<".
  // See: https://github.com/marcoroth/herb/issues/476
  // TODO: revisit once we have access to Prism nodes
  test("ERB output with heredoc after assignment", () => {
    const input = dedent`
      <%= x = <<HEREDOC
      example
      HEREDOC
      %>
    `

    const expected = dedent`
      <%= x = <<HEREDOC
      example
      HEREDOC %>
    `

    const result = formatter.format(input)

    expect(result).toBe(expected)
  })

  test("keeps hyphen-attached inline element together during line wrapping", () => {
    const input = dedent`
      <div>
        This is a div where we still can assume that whitespace can be inserted-<b>infront or after of this bold you can not insert whitespace</b>. Next senctence.
      </div>
    `

    const expected = dedent`
      <div>
        This is a div where we still can assume that whitespace can be
        inserted-<b>infront or after of this bold you can not insert whitespace</b>.
        Next senctence.
      </div>
    `

    const result = formatter.format(input)
    expect(result).toBe(expected)
  })
})
