import dedent from "dedent"
import { describe, test } from "vitest"
import { HTMLNoDuplicateIdsRule } from "../../src/rules/html-no-duplicate-ids.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, expectHint, assertOffenses } = createLinterTest(HTMLNoDuplicateIdsRule)

describe("html-no-duplicate-ids", () => {
  test("passes for unique IDs", () => {
    expectNoOffenses(`<div id="unique1"></div><span id="unique2"></span>`)
  })

  test("fails for duplicate IDs", () => {
    expectError('Duplicate ID `duplicate` found. IDs must be unique within a document.')
    assertOffenses(`<div id="duplicate"></div><span id="duplicate"></span>`)
  })

  test("passes for missing IDs", () => {
    expectNoOffenses(`<div></div><span></span>`)
  })

  test("passes for IDs without value", () => {
    expectNoOffenses(`<div id=""></div><span id="  "></span>`)
  })

  test("passes for other attributes with equal value", () => {
    expectNoOffenses(`<div class="value"></div><div class="value"></div>`)
  })

  test("passes when using ERB in ID", () => {
    expectNoOffenses(`<div id="<%= user.id %>"></div>`)
  })

  test("hints for multiple duplicate IDs in ERB in the same context", () => {
    expectHint('Potential duplicate ID `<%= user.id %>` found. If this expression evaluates to the same value, IDs must be unique within a document.')

    assertOffenses(`<div id="<%= user.id %>"></div><span id="<%= user.id %>"></span>`)
  })

  test("passes for IDs in mutually exclusive if/else branches", () => {
    expectNoOffenses(dedent`
      <% if some_condition? %>
        <span id="my-id">content1</span>
      <% else %>
        <span id="my-id">content2</span>
      <% end %>
    `)
  })

  test("passes for IDs in mutually exclusive unless/else branches", () => {
    expectNoOffenses(dedent`
      <% unless some_condition? %>
        <span id="my-id">content1</span>
      <% else %>
        <span id="my-id">content2</span>
      <% end %>
    `)
  })

  test("fails for IDs in mutually exclusive unless/else branches and global", () => {
    expectError('Duplicate ID `my-id` found. IDs must be unique within a document.')
    expectError('Duplicate ID `my-id` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <span id="my-id">content</span>

      <% unless some_condition? %>
        <span id="my-id">content1</span>
      <% else %>
        <span id="my-id">content2</span>
      <% end %>
    `)
  })

  test("passes for IDs in mutually exclusive case/when branches", () => {
    expectNoOffenses(dedent`
      <% case status %>
      <% when 'active' %>
        <div id="status-indicator">Active</div>
      <% when 'inactive' %>
        <div id="status-indicator">Inactive</div>
      <% else %>
        <div id="status-indicator">Unknown</div>
      <% end %>
    `)
  })

  test("fails for IDs in mutually exclusive case/when branches and global", () => {
    expectError('Duplicate ID `status-indicator` found. IDs must be unique within a document.')
    expectError('Duplicate ID `status-indicator` found. IDs must be unique within a document.')
    expectError('Duplicate ID `status-indicator` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <div id="status-indicator">Active</div>

      <% case status %>
      <% when 'active' %>
        <div id="status-indicator">Active</div>
      <% when 'inactive' %>
        <div id="status-indicator">Inactive</div>
      <% else %>
        <div id="status-indicator">Unknown</div>
      <% end %>
    `)
  })

  test("fails for duplicate IDs within same control flow branch", () => {
    expectError('Duplicate ID `duplicate-in-branch` found within the same control flow branch. IDs must be unique within the same control flow branch.')
    assertOffenses(dedent`
      <% if some_condition? %>
        <span id="duplicate-in-branch">content1</span>
        <span id="duplicate-in-branch">content2</span>
      <% end %>
    `)
  })

  test("fails for IDs duplicated outside of control flow", () => {
    expectError('Duplicate ID `global-duplicate` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <div id="global-duplicate">outside</div>

      <% if some_condition? %>
        <span id="different-id">inside branch</span>
      <% end %>

      <div id="global-duplicate">outside again</div>
    `)
  })

  test("fails for IDs duplicated outside before control flow", () => {
    expectError('Duplicate ID `global-duplicate` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <div id="global-duplicate">outside</div>

      <% if some_condition? %>
        <span id="global-duplicate">inside branch</span>
      <% end %>
    `)
  })

  test("fails for IDs duplicated outside after control flow", () => {
    expectError('Duplicate ID `global-duplicate` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <% if some_condition? %>
        <span id="global-duplicate">inside branch</span>
      <% end %>

      <div id="global-duplicate">outside</div>
    `)
  })

  test("fails for IDs duplicated outside after control flow", () => {
    expectError('Duplicate ID `global-duplicate` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <% if some_condition? %>
        <!-- empty -->
      <% elsif another_condition? %>
        <!-- empty -->
      <% else %>
        <span id="global-duplicate">inside branch</span>
      <% end %>

      <div id="global-duplicate">outside</div>
    `)
  })

  test("fails for IDs duplicated outside after control flow", () => {
    expectError('Duplicate ID `global-duplicate` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <% if some_condition? %>
        <!-- empty -->
      <% elsif other_condition? %>
        <span id="global-duplicate">inside branch</span>
      <% end %>

      <div id="global-duplicate">outside</div>
    `)
  })

  test("passes for IDs duplicated in elsif and else", () => {
    expectNoOffenses(dedent`
      <% if some_condition? %>
        <!-- empty -->
      <% elsif other_condition? %>
        <span id="global-duplicate">inside branch</span>
      <% else other_condition? %>
        <span id="global-duplicate">inside branch</span>
      <% end %>
    `)
  })

  test("handles nested control flow properly", () => {
    expectNoOffenses(dedent`
      <% if outer_condition? %>
        <% if inner_condition? %>
          <div id="nested-id">inner true</div>
        <% else %>
          <div id="nested-id">inner false</div>
        <% end %>
      <% else %>
        <div id="nested-id">outer false</div>
      <% end %>
    `)
  })

  test("passes for ID tag.div (ERBBlockNode)", () => {
    expectNoOffenses(dedent`
      <% tag.div do %>
        <div id="user">User</div>
      <% end %>
    `)
  })

  test("passes for output ERB IDs in separate block contexts (unique per iteration)", () => {
    expectNoOffenses(dedent`
      <% users.each do |user| %>
        <div id="user-<%= user.id %>">User</div>
      <% end %>

      <% users.each do |user| %>
        <div id="user-<%= user.id %>">User again</div>
      <% end %>
    `)
  })

  test("fails for non-output ERB IDs in loops (same value repeated)", () => {
    expectError('Duplicate ID `user-` found within the same control flow branch. IDs must be unique within the same control flow branch.')
    assertOffenses(dedent`
      <% users.each do |user| %>
        <div id="user-<% 'static' %>">User</div>
        <div id="user-<% 'static' %>">Duplicate</div>
      <% end %>
    `)
  })

  test("passes for output ERB IDs in while loops", () => {
    expectNoOffenses(dedent`
      <% counter = 0 %>
      <% count = 0 %>

      <% while condition %>
        <div id="item-<%= counter %>">Item</div>
        <div id="item-<%= count %>">Item</div>
        <div id="post-<%= counter %>">Post</div>
        <% counter += 1 %>
      <% end %>
    `)
  })

  test("fails for static ID in while loops", () => {
    expectError('Duplicate ID `static-id` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <% while condition %>
        <div id="static-id">Item</div>
      <% end %>
    `)
  })

  test("fails for non-dynamic ID in until loops", () => {
    expectError('Duplicate ID `static-id` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <% until condition %>
        <div id="static-id">Item</div>
      <% end %>
    `)
  })

  test("handles output ERB IDs in conditional flow normally", () => {
    expectNoOffenses(dedent`
      <% if condition %>
        <div id="user-<%= user.id %>">User A</div>
      <% else %>
        <div id="user-<%= user.id %>">User B</div>
      <% end %>
    `)
  })

  test("hints for duplicate output ERB IDs within same conditional branch", () => {
    expectHint('Potential duplicate ID `user-<%= user.id %>` found within the same control flow branch. If this expression evaluates to the same value, IDs must be unique.')
    assertOffenses(dedent`
      <% if condition %>
        <div id="user-<%= user.id %>">User A</div>
        <div id="user-<%= user.id %>">User A duplicate</div>
      <% end %>
    `)
  })

  test("passes for static ID conflicting with dynamic ID prefix", () => {
    expectNoOffenses(dedent`
      <div id="hello">Static</div>
      <div id="hello<%= suffix %>">Dynamic</div>
    `)
  })

  test("passes for dynamic ID conflicting with existing static ID", () => {
    expectNoOffenses(dedent`
      <div id="hello<%= suffix %>">Dynamic</div>
      <div id="hello">Static</div>
    `)
  })

  test("passes for non-conflicting static and dynamic IDs", () => {
    expectNoOffenses(dedent`
      <div id="hello">Static</div>
      <div id="goodbye<%= suffix %>">Dynamic</div>
    `)
  })

  test.todo("fails for static attribute in a loop context", () => {
    expectError('Duplicate ID `user` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <% @users.each do |user| %>
        <div id="user"></div>
      <% end %>
    `)
  })

  test("passes for dynamic attribute in a ERBBlockNode each context", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <div id="<%= user.id %>"></div>
      <% end %>
    `)
  })

  test("passes for dynamic IDs with same pattern in separate each blocks (issue #388)", () => {
    expectNoOffenses(dedent`
      <% first_options.each do |opt| %>
        <div id="option--<%= opt[:id] %>"></div>
      <% end %>

      <% second_options.each do |opt| %>
        <div id="option--<%= opt[:id] %>"></div>
      <% end %>
    `)
  })

  test("passes for bare output ERB ID reusing the same loop variable in separate each blocks (issue #481)", () => {
    expectNoOffenses(dedent`
      <% good, bad = (1..10).partition { rand > 0.5 } %>

      <% good.each do |i| %>
        <p id="<%= i %>"><%= i %></p>
      <% end %>

      <% bad.each do |i| %>
        <p id="<%= i %>"><%= i %></p>
      <% end %>
    `)
  })

  test("passes for bare output ERB ID reusing the same variable in separate for loops (issue #481)", () => {
    expectNoOffenses(dedent`
      <% for i in good %>
        <p id="<%= i %>"><%= i %></p>
      <% end %>

      <% for i in bad %>
        <p id="<%= i %>"><%= i %></p>
      <% end %>
    `)
  })

  test("hints for duplicate dynamic IDs within same block", () => {
    expectHint('Potential duplicate ID `item-<%= item.id %>` found within the same control flow branch. If this expression evaluates to the same value, IDs must be unique.')

    assertOffenses(dedent`
      <% items.each do |item| %>
        <div id="item-<%= item.id %>"></div>
        <span id="item-<%= item.id %>"></span>
      <% end %>
    `)
  })

  test("passes for three separate each blocks with same dynamic ID pattern", () => {
    expectNoOffenses(dedent`
      <% first.each do |item| %>
        <div id="item-<%= item.id %>"></div>
      <% end %>

      <% second.each do |item| %>
        <div id="item-<%= item.id %>"></div>
      <% end %>

      <% third.each do |item| %>
        <div id="item-<%= item.id %>"></div>
      <% end %>
    `)
  })

  test("passes for dynamic ID in global scope and same dynamic ID in a block", () => {
    expectNoOffenses(dedent`
      <div id="user-<%= user.id %>"></div>

      <% items.each do |item| %>
        <div id="user-<%= user.id %>"></div>
      <% end %>
    `)
  })

  test("passes for dynamic ID in a block and same dynamic ID in global scope", () => {
    expectNoOffenses(dedent`
      <% items.each do |item| %>
        <div id="user-<%= user.id %>"></div>
      <% end %>

      <div id="user-<%= user.id %>"></div>
    `)
  })

  test("passes for dynamic ID in an if branch and same dynamic ID in global scope", () => {
    expectNoOffenses(dedent`
      <div id="user-<%= user.id %>"></div>

      <% if condition %>
        <div id="user-<%= user.id %>"></div>
      <% end %>
    `)
  })

  test("passes for nested each blocks with same dynamic ID pattern", () => {
    expectNoOffenses(dedent`
      <% groups.each do |group| %>
        <% group.items.each do |item| %>
          <div id="item-<%= item.id %>"></div>
        <% end %>
      <% end %>
    `)
  })

  test("passes for different dynamic ID patterns in separate blocks", () => {
    expectNoOffenses(dedent`
      <% users.each do |user| %>
        <div id="user-<%= user.id %>"></div>
      <% end %>

      <% posts.each do |post| %>
        <div id="post-<%= post.id %>"></div>
      <% end %>
    `)
  })

  test("passes for dynamic IDs across map and each blocks", () => {
    expectNoOffenses(dedent`
      <% items.map do |item| %>
        <div id="item-<%= item.id %>"></div>
      <% end %>

      <% items.each do |item| %>
        <div id="item-<%= item.id %>"></div>
      <% end %>
    `)
  })

  test("fails for static IDs in separate each blocks", () => {
    expectError('Duplicate ID `static-id` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <% first.each do |item| %>
        <div id="static-id"></div>
      <% end %>

      <% second.each do |item| %>
        <div id="static-id"></div>
      <% end %>
    `)
  })

  test("passes for dynamic ID in each block nested inside if/else", () => {
    expectNoOffenses(dedent`
      <% if condition %>
        <% items.each do |item| %>
          <div id="item-<%= item.id %>"></div>
        <% end %>
      <% else %>
        <% items.each do |item| %>
          <div id="item-<%= item.id %>"></div>
        <% end %>
      <% end %>
    `)
  })

  test("passes for tag helper with unique id", () => {
    expectNoOffenses('<%= tag.div id: "unique" %>')
  })

  test("fails for duplicate IDs between tag helper and HTML element", () => {
    expectError('Duplicate ID `my-id` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <%= tag.div id: "my-id" do %>
        content
      <% end %>
      <div id="my-id">content</div>
    `)
  })

  test("fails for duplicate IDs between two tag helpers", () => {
    expectError('Duplicate ID `my-id` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <%= tag.div id: "my-id" do %>
        content
      <% end %>
      <%= tag.span id: "my-id" %>
    `)
  })

  test("passes for IDs in mutually exclusive branches with HTML and tag helper", () => {
    expectNoOffenses(dedent`
      <% if use_tag_helper? %>
        <%= tag.div id: "my-id" do %>
          content
        <% end %>
      <% else %>
        <div id="my-id">content</div>
      <% end %>
    `)
  })

  test("fails for duplicate IDs in same branch with void tag helper and HTML", () => {
    expectError('Duplicate ID `my-id` found within the same control flow branch. IDs must be unique within the same control flow branch.')
    assertOffenses(dedent`
      <% if condition? %>
        <%= tag.img id: "my-id", src: "/image.png", alt: "Photo" %>
        <img id="my-id" src="/other.png" alt="Other">
      <% end %>
    `)
  })

  test("fails for duplicate IDs in same branch with block tag helper and HTML", () => {
    expectError('Duplicate ID `my-id` found within the same control flow branch. IDs must be unique within the same control flow branch.')
    assertOffenses(dedent`
      <% if condition? %>
        <%= tag.div id: "my-id" do %>
          content
        <% end %>
        <div id="my-id">content</div>
      <% end %>
    `)
  })

  test("passes for IDs in mutually exclusive branches with tag helpers on both sides", () => {
    expectNoOffenses(dedent`
      <% if condition? %>
        <%= tag.div id: "shared-id" do %>
          branch one
        <% end %>
      <% else %>
        <%= tag.span id: "shared-id" do %>
          branch two
        <% end %>
      <% end %>
    `)
  })

  test("fails for turbo_frame_tag with duplicate id from positional argument and another element", () => {
    expectError('Duplicate ID `my-frame` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <%= turbo_frame_tag "my-frame" do %>
        content
      <% end %>
      <div id="my-frame">content</div>
    `)
  })

  test("passes for turbo_frame_tag id in mutually exclusive branch with HTML id", () => {
    expectNoOffenses(dedent`
      <% if turbo? %>
        <%= turbo_frame_tag "my-frame" do %>
          content
        <% end %>
      <% else %>
        <div id="my-frame">content</div>
      <% end %>
    `)
  })

  test("fails for image_tag with duplicate id and HTML element", () => {
    expectError('Duplicate ID `logo` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <%= image_tag "logo.png", id: "logo" %>
      <img src="logo.png" id="logo">
    `)
  })

  test("fails for link_to with duplicate id and HTML element", () => {
    expectError('Duplicate ID `home-link` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <%= link_to "Home", root_path, id: "home-link" %>
      <a href="/" id="home-link">Home</a>
    `)
  })

  describe("Ruby interpolation in Action View helper attributes", () => {
    test("passes for interpolated helper IDs that only share a static suffix", () => {
      expectNoOffenses(dedent`
        <%= link_to event["url"], id: "#{event["name"]}-pending" do %>
          <div></div>
        <% end %>

        <%= link_to talk["url"], id: "#{talk["title"]}-pending" do %>
          <div></div>
        <% end %>
      `)
    })

    test("hints for the same interpolated helper ID across two helpers", () => {
      expectHint('Potential duplicate ID `#{event["name"]}-pending` found. If this expression evaluates to the same value, IDs must be unique within a document.')

      assertOffenses(dedent`
        <%= link_to event["url"], id: "#{event["name"]}-pending" do %>
          <div></div>
        <% end %>

        <%= link_to event["url"], id: "#{event["name"]}-pending" do %>
          <div></div>
        <% end %>
      `)
    })

    test("passes for interpolated helper IDs in separate loops", () => {
      expectNoOffenses(dedent`
        <% @with_video_link.each do |event| %>
          <%= link_to event["url"], id: "#{event["name"]}-published" do %>
            <div></div>
          <% end %>
        <% end %>

        <% @without_video_link.each do |event| %>
          <%= link_to event["url"], id: "#{event["name"]}-pending" do %>
            <div></div>
          <% end %>
        <% end %>
      `)
    })

    test("passes for an interpolated helper ID and a static ID matching its literal part", () => {
      expectNoOffenses(dedent`
        <%= tag.div id: "#{user.name}-pending" %>
        <div id="-pending"></div>
      `)
    })

    test("hints for the same interpolated helper ID twice", () => {
      expectHint('Potential duplicate ID `#{user.id}-pending` found. If this expression evaluates to the same value, IDs must be unique within a document.')

      assertOffenses(dedent`
        <%= tag.div id: "#{user.id}-pending" %>
        <%= tag.span id: "#{user.id}-pending" %>
      `)
    })

    test("hints for the same Ruby expression helper ID twice", () => {
      expectHint('Potential duplicate ID `#{dom_id(user)}` found. If this expression evaluates to the same value, IDs must be unique within a document.')

      assertOffenses(dedent`
        <%= tag.div id: dom_id(user) %>
        <%= tag.span id: dom_id(user) %>
      `)
    })

    test("passes for interpolated helper IDs in mutually exclusive branches", () => {
      expectNoOffenses(dedent`
        <% if condition? %>
          <%= tag.div id: "#{user.id}-pending" %>
        <% else %>
          <%= tag.span id: "#{user.id}-pending" %>
        <% end %>
      `)
    })

    test("still fails for the same static helper ID twice", () => {
      expectError('Duplicate ID `pending` found. IDs must be unique within a document.')

      assertOffenses(dedent`
        <%= tag.div id: "pending" %>
        <%= tag.span id: "pending" %>
      `)
    })
  })

  describe("<template> elements (issue #1728)", () => {
    describe("isolation from the surrounding document", () => {
      test("passes for ID inside <template> matching an ID outside it", () => {
        expectNoOffenses(dedent`
          <div id="thing">Rendered on load</div>

          <template id="thing-template">
            <div id="thing">Re-added from template</div>
          </template>
        `)
      })

      test("passes for ID outside <template> matching an ID inside it (reverse order)", () => {
        expectNoOffenses(dedent`
          <template>
            <div id="thing">Re-added from template</div>
          </template>

          <div id="thing">Rendered on load</div>
        `)
      })

      test("passes for IDs shared across separate <template> elements", () => {
        expectNoOffenses(dedent`
          <template>
            <div id="item"></div>
          </template>

          <template>
            <div id="item"></div>
          </template>
        `)
      })

      test("passes for the same ID across three separate <template> elements", () => {
        expectNoOffenses(dedent`
          <template>
            <div id="item"></div>
          </template>

          <template>
            <div id="item"></div>
          </template>

          <template>
            <div id="item"></div>
          </template>
        `)
      })

      test("passes for templated static ID string used once per <template>", () => {
        expectNoOffenses(dedent`
          <template>
            <div id="my-thing-:templated-value"></div>
          </template>

          <template>
            <div id="my-thing-:templated-value"></div>
          </template>
        `)
      })

      test("passes for a <template> nested deep inside other elements", () => {
        expectNoOffenses(dedent`
          <div id="dup"></div>

          <div>
            <section>
              <template>
                <div id="dup"></div>
              </template>
            </section>
          </div>
        `)
      })

      test("passes for deeply nested IDs inside a <template>", () => {
        expectNoOffenses(dedent`
          <div id="deep"></div>

          <template>
            <div>
              <section>
                <span id="deep"></span>
              </section>
            </div>
          </template>
        `)
      })

      test("passes for an empty <template>", () => {
        expectNoOffenses(dedent`
          <div id="thing"></div>
          <template></template>
        `)
      })
    })

    describe("duplicates within a single <template>", () => {
      test("fails for duplicate IDs inside the same <template>", () => {
        expectError('Duplicate ID `thing` found. IDs must be unique within a document.')

        assertOffenses(dedent`
          <template>
            <div id="thing">One</div>
            <div id="thing">Two</div>
          </template>
        `)
      })

      test("fails for duplicate IDs inside a <template> that also exist outside it", () => {
        expectError('Duplicate ID `thing` found. IDs must be unique within a document.')

        assertOffenses(dedent`
          <div id="thing">Outside</div>

          <template>
            <div id="thing">One</div>
            <div id="thing">Two</div>
          </template>
        `)
      })

      test("fails once per duplicate for several distinct duplicates in one <template>", () => {
        expectError('Duplicate ID `first` found. IDs must be unique within a document.')
        expectError('Duplicate ID `second` found. IDs must be unique within a document.')

        assertOffenses(dedent`
          <template>
            <div id="first"></div>
            <div id="second"></div>
            <div id="first"></div>
            <div id="second"></div>
          </template>
        `)
      })

      test("fails for duplicate IDs nested at different depths inside one <template>", () => {
        expectError('Duplicate ID `deep` found. IDs must be unique within a document.')

        assertOffenses(dedent`
          <template>
            <div id="deep"></div>
            <section>
              <span id="deep"></span>
            </section>
          </template>
        `)
      })

      test("fails for the same templated static ID string twice in one <template>", () => {
        expectError('Duplicate ID `my-thing-:templated-value` found. IDs must be unique within a document.')

        assertOffenses(dedent`
          <template>
            <div id="my-thing-:templated-value"></div>
            <div id="my-thing-:templated-value"></div>
          </template>
        `)
      })
    })

    describe("the <template> element's own id", () => {
      test("fails for duplicate IDs on the <template> elements themselves", () => {
        expectError('Duplicate ID `my-template` found. IDs must be unique within a document.')

        assertOffenses(dedent`
          <template id="my-template"></template>
          <template id="my-template"></template>
        `)
      })

      test("fails for duplicate ID between a <template> element and an outside element", () => {
        expectError('Duplicate ID `shared` found. IDs must be unique within a document.')

        assertOffenses(dedent`
          <template id="shared">
            <div id="inner"></div>
          </template>
          <div id="shared"></div>
        `)
      })

      test("fails for duplicate ID between an outside element and a later <template> element", () => {
        expectError('Duplicate ID `shared` found. IDs must be unique within a document.')

        assertOffenses(dedent`
          <div id="shared"></div>
          <template id="shared"></template>
        `)
      })

      test("passes when a <template> element's own id matches an ID inside itself", () => {
        expectNoOffenses(dedent`
          <template id="same">
            <div id="same"></div>
          </template>
        `)
      })
    })

    describe("scope restoration", () => {
      test("still detects duplicate IDs outside a <template> after visiting one", () => {
        expectError('Duplicate ID `outside` found. IDs must be unique within a document.')

        assertOffenses(dedent`
          <div id="outside"></div>

          <template>
            <div id="inner"></div>
          </template>

          <div id="outside"></div>
        `)
      })

      test("still detects duplicate IDs outside after several <template> elements", () => {
        expectError('Duplicate ID `outside` found. IDs must be unique within a document.')

        assertOffenses(dedent`
          <div id="outside"></div>

          <template><div id="a"></div></template>
          <template><div id="a"></div></template>

          <div id="outside"></div>
        `)
      })

      test("does not leak IDs from a <template> into the surrounding document", () => {
        expectNoOffenses(dedent`
          <template>
            <div id="only-in-template"></div>
          </template>

          <div id="only-in-template"></div>
        `)
      })
    })

    describe("nested <template> elements", () => {
      test("passes for the same ID in an outer and inner <template>", () => {
        expectNoOffenses(dedent`
          <template>
            <div id="a"></div>

            <template>
              <div id="a"></div>
            </template>
          </template>
        `)
      })

      test("fails for duplicate IDs inside a nested <template>", () => {
        expectError('Duplicate ID `x` found. IDs must be unique within a document.')
        assertOffenses(dedent`
          <template>
            <template>
              <div id="x"></div>
              <div id="x"></div>
            </template>
          </template>
        `)
      })

      test("restores the outer <template> scope after a nested <template>", () => {
        expectError('Duplicate ID `outer` found. IDs must be unique within a document.')
        assertOffenses(dedent`
          <template>
            <div id="outer"></div>

            <template>
              <div id="inner"></div>
            </template>

            <div id="outer"></div>
          </template>
        `)
      })

      test("passes for a nested <template> element's own id matching an outer one", () => {
        expectNoOffenses(dedent`
          <template id="tpl">
            <template id="tpl"></template>
          </template>
        `)
      })
    })

    describe("interaction with ERB control flow", () => {
      test("passes for a <template> ID matching an ID in an if branch outside it", () => {
        expectNoOffenses(dedent`
          <% if condition %>
            <template>
              <div id="x"></div>
            </template>
          <% end %>

          <div id="x"></div>
        `)
      })

      test("passes for IDs in mutually exclusive branches inside a <template>", () => {
        expectNoOffenses(dedent`
          <template>
            <% if condition %>
              <div id="a"></div>
            <% else %>
              <div id="a"></div>
            <% end %>
          </template>
        `)
      })

      test("fails for duplicate IDs in the same branch inside a <template>", () => {
        expectError('Duplicate ID `a` found within the same control flow branch. IDs must be unique within the same control flow branch.')
        assertOffenses(dedent`
          <template>
            <% if condition %>
              <div id="a"></div>
              <div id="a"></div>
            <% end %>
          </template>
        `)
      })

      test("matches outside-template behavior for a static ID in a single block", () => {
        expectNoOffenses(dedent`
          <template>
            <% items.each do |item| %>
              <div id="static-id"></div>
            <% end %>
          </template>
        `)
      })

      test("fails for static IDs in separate blocks inside one <template>", () => {
        expectError('Duplicate ID `static-id` found. IDs must be unique within a document.')

        assertOffenses(dedent`
          <template>
            <% first.each do |item| %>
              <div id="static-id"></div>
            <% end %>

            <% second.each do |item| %>
              <div id="static-id"></div>
            <% end %>
          </template>
        `)
      })

      test("passes for static IDs in blocks in separate <template> elements", () => {
        expectNoOffenses(dedent`
          <template>
            <% first.each do |item| %>
              <div id="static-id"></div>
            <% end %>
          </template>

          <template>
            <% second.each do |item| %>
              <div id="static-id"></div>
            <% end %>
          </template>
        `)
      })

      test("passes for a dynamic ID inside a loop inside a <template>", () => {
        expectNoOffenses(dedent`
          <template>
            <% items.each do |item| %>
              <div id="item-<%= item.id %>"></div>
            <% end %>
          </template>
        `)
      })

      test("passes for a <template> inside a loop", () => {
        expectNoOffenses(dedent`
          <div id="thing"></div>

          <% items.each do |item| %>
            <template>
              <div id="thing"></div>
            </template>
          <% end %>
        `)
      })
    })

    describe("interaction with dynamic IDs", () => {
      test("passes for a dynamic ID inside a <template> matching one outside", () => {
        expectNoOffenses(dedent`
          <div id="<%= user.id %>"></div>

          <template>
            <div id="<%= user.id %>"></div>
          </template>
        `)
      })

      test("hints for a duplicate dynamic ID within the same <template>", () => {
        expectHint('Potential duplicate ID `<%= user.id %>` found. If this expression evaluates to the same value, IDs must be unique within a document.')

        assertOffenses(dedent`
          <template>
            <div id="<%= user.id %>"></div>
            <div id="<%= user.id %>"></div>
          </template>
        `)
      })

      test("passes for the same dynamic ID across separate <template> elements", () => {
        expectNoOffenses(dedent`
          <template>
            <div id="<%= user.id %>"></div>
          </template>

          <template>
            <div id="<%= user.id %>"></div>
          </template>
        `)
      })
    })

    describe("edge cases", () => {
      test("treats an uppercase <TEMPLATE> the same as a lowercase one", () => {
        expectNoOffenses(dedent`
          <div id="thing"></div>

          <TEMPLATE>
            <div id="thing"></div>
          </TEMPLATE>
        `)
      })

      test("passes for whitespace-only and empty IDs inside a <template>", () => {
        expectNoOffenses(dedent`
          <template>
            <div id=""></div>
            <div id="  "></div>
          </template>
        `)
      })

      test("ignores non-id attributes inside a <template>", () => {
        expectNoOffenses(dedent`
          <template>
            <div class="value"></div>
            <div class="value"></div>
          </template>
        `)
      })
    })
  })

  describe("pending: block iteration nodes (ERBBlockEachNode)", () => {
    describe("static IDs repeat once per iteration", () => {
      test.todo("fails for a static ID in a single each block", () => {
        expectError('Duplicate ID `item` found. IDs must be unique within a document.')

        assertOffenses(dedent`
          <% items.each do |item| %>
            <div id="item"></div>
          <% end %>
        `)
      })

      test.todo("fails for a static ID in a map block", () => {
        expectError('Duplicate ID `item` found. IDs must be unique within a document.')

        assertOffenses(dedent`
          <% items.map do |item| %>
            <div id="item"></div>
          <% end %>
        `)
      })

      test.todo("fails for a static ID nested deep inside an each block", () => {
        expectError('Duplicate ID `deep` found. IDs must be unique within a document.')

        assertOffenses(dedent`
          <% items.each do |item| %>
            <section>
              <span id="deep"></span>
            </section>
          <% end %>
        `)
      })

      test.todo("fails for an effectively-static ID in an each block", () => {
        expectError('Duplicate ID `item-` found. IDs must be unique within a document.')

        assertOffenses(dedent`
          <% items.each do |item| %>
            <div id="item-<% 'static' %>"></div>
          <% end %>
        `)
      })

      test.todo("fails for a static ID in an each block nested in an if branch", () => {
        expectError('Duplicate ID `item` found. IDs must be unique within a document.')

        assertOffenses(dedent`
          <% if condition %>
            <% items.each do |item| %>
              <div id="item"></div>
            <% end %>
          <% end %>
        `)
      })

      test.todo("fails for a static ID in nested each blocks", () => {
        expectError('Duplicate ID `item` found. IDs must be unique within a document.')

        assertOffenses(dedent`
          <% groups.each do |group| %>
            <% group.items.each do |item| %>
              <div id="item"></div>
            <% end %>
          <% end %>
        `)
      })

      test.todo("fails for a static ID in an each block inside a <template>", () => {
        expectError('Duplicate ID `item` found. IDs must be unique within a document.')

        assertOffenses(dedent`
          <template>
            <% items.each do |item| %>
              <div id="item"></div>
            <% end %>
          </template>
        `)
      })
    })

    describe("IDs that do not vary with the block argument", () => {
      test.todo("fails for a dynamic ID that never references the block argument", () => {
        expectError('Duplicate ID `item-<%= unrelated.id %>` found. IDs must be unique within a document.')

        assertOffenses(dedent`
          <% items.each do |item| %>
            <div id="item-<%= unrelated.id %>"></div>
          <% end %>
        `)
      })

      test("passes for a dynamic ID that references the block argument", () => {
        expectNoOffenses(dedent`
          <% items.each do |item| %>
            <div id="item-<%= item.id %>"></div>
          <% end %>
        `)
      })

      test("passes for a dynamic ID referencing a nested block argument", () => {
        expectNoOffenses(dedent`
          <% groups.each do |group| %>
            <% group.items.each do |item| %>
              <div id="item-<%= group.id %>-<%= item.id %>"></div>
            <% end %>
          <% end %>
        `)
      })
    })

    describe("regression guard: duplicates within one iteration", () => {
      test.todo("still reports a duplicate dynamic ID within one each iteration", () => {
        expectHint('Potential duplicate ID `item-<%= item.id %>` found within the same loop iteration. If this expression evaluates to the same value, IDs must be unique.')

        assertOffenses(dedent`
          <% items.each do |item| %>
            <div id="item-<%= item.id %>"></div>
            <span id="item-<%= item.id %>"></span>
          <% end %>
        `)
      })

      test.todo("still reports a duplicate dynamic ID within one each iteration inside a <template>", () => {
        expectHint('Potential duplicate ID `item-<%= item.id %>` found within the same loop iteration. If this expression evaluates to the same value, IDs must be unique.')

        assertOffenses(dedent`
          <template>
            <% items.each do |item| %>
              <div id="item-<%= item.id %>"></div>
              <span id="item-<%= item.id %>"></span>
            <% end %>
          </template>
        `)
      })

      test.todo("keeps separate each blocks independent once they are loops", () => {
        expectNoOffenses(dedent`
          <% first.each do |item| %>
            <div id="item-<%= item.id %>"></div>
          <% end %>

          <% second.each do |item| %>
            <div id="item-<%= item.id %>"></div>
          <% end %>
        `)
      })
    })
  })
})
