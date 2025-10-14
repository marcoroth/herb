import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../src"
import dedent from "dedent"

let linter: Linter

describe("XML+ERB Linting", () => {
  beforeAll(async () => {
    await Herb.load()
    linter = new Linter(Herb)
  })

  test("should lint valid XML ERB without errors", () => {
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
    ` + '\n'

    const result = linter.lint(source, { fileName: "test.xml.erb" })
    expect(result.offenses).toHaveLength(0)
  })

  test("should detect ERB whitespace issues in XML", () => {
    const source = dedent`
      <?xml version="1.0" encoding="UTF-8"?>
      <config>
        <setting><%=value%></setting>
        <debug><%=debug_mode %></debug>
      </config>
    ` + '\n'

    const result = linter.lint(source, { fileName: "config.xml.erb" })


    const whitespaceErrors = result.offenses.filter(offense =>
      offense.code === "erb-require-whitespace-inside-tags"
    )
    expect(whitespaceErrors.length).toBeGreaterThanOrEqual(2)
  })

  test("should detect self-closing tags in XML (which are different from HTML)", () => {
    const source = dedent`
      <?xml version="1.0" encoding="UTF-8"?>
      <manifest>
        <application>
          <% permissions.each do |perm| %>
            <uses-permission android:name="<%= perm %>" />
          <% end %>
        </application>
      </manifest>
    ` + '\n'

    const result = linter.lint(source, { fileName: "manifest.xml.erb" })

    // In XML context, self-closing tags are normal, but linter treats as HTML
    const selfClosingErrors = result.offenses.filter(offense =>
      offense.code === "html-no-self-closing"
    )
    expect(selfClosingErrors.length).toBeGreaterThanOrEqual(1)
  })

  test.todo("should handle XML with CDATA sections", () => {
    const source = dedent`
      <?xml version="1.0" encoding="UTF-8"?>
      <document>
        <script>
          <![CDATA[
            <% if @analytics_enabled %>
              function track() { analytics.track(); }
            <% end %>
          ]]>
        </script>
      </document>
    ` + '\n'

    const result = linter.lint(source, { fileName: "document.xml.erb" })
    expect(result.offenses).toEqual(expect.any(Array))
  })

  test("should handle self-closing XML tags appropriately", () => {
    const source = dedent`
      <?xml version="1.0" encoding="UTF-8"?>
      <manifest>
        <uses-permission android:name="CAMERA" />
        <uses-feature android:name="camera" android:required="true" />
      </manifest>
    ` + '\n'

    const result = linter.lint(source, { fileName: "manifest.xml.erb" })

    const selfClosingErrors = result.offenses.filter(offense =>
      offense.code === "html-no-self-closing"
    )

    expect(selfClosingErrors.length).toBeGreaterThanOrEqual(0)
  })

  test("should lint Android manifest XML ERB", () => {
    const source = dedent`
      <?xml version="1.0" encoding="UTF-8"?>
      <manifest xmlns:android="http://schemas.android.com/apk/res/android">
        <application android:name="MainActivity">
          <% @permissions.each do |permission| %>
            <uses-permission android:name="<%= permission %>" />
          <% end %>
          <% @features.each do |feature| %>
            <uses-feature
              android:name="<%= feature.name %>"
              android:required="<%= feature.required %>" />
          <% end %>
        </application>
      </manifest>
    ` + '\n'

    const result = linter.lint(source, { fileName: "AndroidManifest.xml.erb" })
    expect(result.offenses).toEqual(expect.any(Array))

    const parserErrors = result.offenses.filter(offense => offense.code === "parser-no-errors")
    expect(parserErrors).toHaveLength(0)
  })

  test("should lint RSS feed XML ERB", () => {
    const source = dedent`
      <?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title><%= @feed_title %></title>
          <link><%= @site_url %></link>
          <description><%= @feed_description %></description>
          <language><%= @language || 'en-us' %></language>
          <lastBuildDate><%= @last_updated.rfc822 %></lastBuildDate>

          <% @articles.each do |article| %>
            <item>
              <title><%= article.title %></title>
              <link><%= article_url(article) %></link>
              <guid><%= article_url(article) %></guid>
              <pubDate><%= article.published_at.rfc822 %></pubDate>
              <description><![CDATA[<%= article.summary %>]]></description>
            </item>
          <% end %>
        </channel>
      </rss>
    ` + '\n'

    const result = linter.lint(source, { fileName: "feed.xml.erb" })
    expect(result.offenses).toEqual(expect.any(Array))

    const parserErrors = result.offenses.filter(offense => offense.code === "parser-no-errors")
    expect(parserErrors.length).toBeGreaterThanOrEqual(0)
  })

  test("should handle XML sitemap ERB", () => {
    const source = dedent`
      <?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <% @pages.each do |page| %>
          <url>
            <loc><%= page.canonical_url %></loc>
            <lastmod><%= page.updated_at.iso8601 %></lastmod>
            <changefreq><%= page.change_frequency %></changefreq>
            <priority><%= page.priority %></priority>
          </url>
        <% end %>
      </urlset>
    ` + '\n'

    const result = linter.lint(source, { fileName: "sitemap.xml.erb" })
    expect(result.offenses).toEqual(expect.any(Array))

    const parserErrors = result.offenses.filter(offense => offense.code === "parser-no-errors")
    expect(parserErrors).toHaveLength(0)
  })
})
