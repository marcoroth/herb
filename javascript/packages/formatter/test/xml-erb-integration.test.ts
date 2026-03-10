import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../src"

import dedent from "dedent"

let formatter: Formatter

describe("XML ERB Integration", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("XML RSS feed with ERB", () => {
    const source = dedent`
      <?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title><%= @title %></title>
          <description><%= @description %></description>
          <% @items.each do |item| %>
          <item>
            <title><%= item.title %></title>
            <description><%= item.content %></description>
          </item>
          <% end %>
        </channel>
      </rss>
    `

    const expected = dedent`
      <?xml version="1.0" encoding="UTF-8"?>

      <rss version="2.0">
        <channel>
          <title><%= @title %></title>
          <description><%= @description %></description>
          <% @items.each do |item| %>
            <item>
              <title><%= item.title %></title>
              <description><%= item.content %></description>
            </item>
          <% end %>
        </channel>
      </rss>
    `

    const result = formatter.format(source)
    expect(result.trim()).toEqual(expected)
  })

  test("XML configuration with conditional ERB", () => {
    const source = dedent`
      <?xml version="1.0" encoding="UTF-8"?>
      <configuration>
        <settings>
          <% if Rails.env.production? %>
            <env>production</env>
            <debug>false</debug>
          <% else %>
            <env>development</env>
            <debug>true</debug>
          <% end %>
        </settings>
        <database>
          <host><%= database_host %></host>
          <port><%= database_port || 5432 %></port>
        </database>
      </configuration>
    `

    const expected = dedent`
      <?xml version="1.0" encoding="UTF-8"?>

      <configuration>
        <settings>
          <% if Rails.env.production? %>
            <env>production</env>
            <debug>false</debug>
          <% else %>
            <env>development</env>
            <debug>true</debug>
          <% end %>
        </settings>
        <database>
          <host><%= database_host %></host>
          <port><%= database_port || 5432 %></port>
        </database>
      </configuration>
    `

    const result = formatter.format(source)
    expect(result.trim()).toEqual(expected)
  })

  test("Android manifest XML with ERB loops", () => {
    const source = dedent`
      <?xml version="1.0" encoding="UTF-8"?>
      <manifest xmlns:android="http://schemas.android.com/apk/res/android">
        <application android:name="MainActivity">
          <% permissions.each do |permission| %>
            <uses-permission android:name="<%= permission %>" />
          <% end %>
          <% features.each_with_index do |feature, index| %>
            <uses-feature
              android:name="<%= feature.name %>"
              android:required="<%= feature.required %>"
              android:glEsVersion="<%= feature.gl_version if feature.gl_version %>"
            />
          <% end %>
        </application>
      </manifest>
    `

    const expected = dedent`
      <?xml version="1.0" encoding="UTF-8"?>

      <manifest xmlns:android="http://schemas.android.com/apk/res/android">
        <application android:name="MainActivity">
          <% permissions.each do |permission| %>
            <uses-permission android:name="<%= permission %>" />
          <% end %>
          <% features.each_with_index do |feature, index| %>
            <uses-feature
              android:name="<%= feature.name %>"
              android:required="<%= feature.required %>"
              android:glEsVersion="<%= feature.gl_version if feature.gl_version %>"
            />
          <% end %>
        </application>
      </manifest>
    `

    const result = formatter.format(source)
    expect(result.trim()).toEqual(expected)
  })

  test("XML with mixed content and ERB", () => {
    const source = dedent`
      <?xml version="1.0" encoding="UTF-8"?>
      <document>
        <header>
          <title>Document Title</title>
        </header>
        <content>
          <% if @show_intro %>
            <introduction>
              <p>This is an introduction paragraph.</p>
            </introduction>
          <% end %>
          <main>
            <% @sections.each do |section| %>
              <section id="<%= section.id %>">
                <h2><%= section.title %></h2>
                <% section.paragraphs.each do |p| %>
                  <p><%= p %></p>
                <% end %>
              </section>
            <% end %>
          </main>
        </content>
      </document>
    `

    const expected = dedent`
      <?xml version="1.0" encoding="UTF-8"?>

      <document>
        <header>
          <title>Document Title</title>
        </header>
        <content>
          <% if @show_intro %>
            <introduction>
              <p>This is an introduction paragraph.</p>
            </introduction>
          <% end %>
          <main>
            <% @sections.each do |section| %>
              <section id="<%= section.id %>">
                <h2><%= section.title %></h2>
                <% section.paragraphs.each do |p| %>
                  <p><%= p %></p>
                <% end %>
              </section>
            <% end %>
          </main>
        </content>
      </document>
    `

    const result = formatter.format(source)
    expect(result.trim()).toEqual(expected)
  })

  test("Compact XML gets properly formatted", () => {
    const source = '<?xml version="1.0"?><root><% if true %><item/><% end %></root>'

    const expected = dedent`
      <?xml version="1.0"?>

      <root>
        <% if true %>
          <item />
        <% end %>
      </root>
    `

    const result = formatter.format(source)
    expect(result.trim()).toEqual(expected)
  })

  test.skip("XML with CDATA and ERB", () => {
    const source = dedent`
      <?xml version="1.0" encoding="UTF-8"?>
      <document>
        <script>
          <![CDATA[
            <% if @include_analytics %>
              function trackEvent(name) {
                analytics.track(name);
              }
            <% end %>
          ]]>
        </script>
      </document>
    `

    const expected = dedent`
      <?xml version="1.0" encoding="UTF-8"?>

      <document>
        <script>
          <![CDATA[
            <% if @include_analytics %>
              function trackEvent(name) {
                analytics.track(name);
              }
            <% end %>
          ]]>
        </script>
      </document>
    `

    const result = formatter.format(source)
    expect(result.trim()).toEqual(expected)
  })
})
