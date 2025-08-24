import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

import dedent from "dedent"

let formatter: Formatter

describe("XML", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("basic XML declaration with library", () => {
    const source = dedent`
      <?xml version="1.0" encoding="UTF-8"?>
      <library
        xmlns="http://example.com/library">
        <book>
            <title>XML Basics</title>
            <author>John Doe</author>
        </book>
        <book>
            <title>Advanced XML</title>
            <author>Jane Smith</author>
        </book>
      </library>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <?xml version="1.0" encoding="UTF-8"?>

      <library xmlns="http://example.com/library">
        <book>
          <title>XML Basics</title>
          <author>John Doe</author>
        </book>
        <book>
          <title>Advanced XML</title>
          <author>Jane Smith</author>
        </book>
      </library>
    `)
  })

  test("XML with namespaces", () => {
    const source = dedent`
      <?xml version="1.0" encoding="UTF-8"?>
      <catalog
        xmlns:bk="http://example.com/books"
        xmlns:auth="http://example.com/authors">
        <bk:book>
            <bk:title>XML Basics</bk:title>
            <auth:author>John Doe</auth:author>
        </bk:book>
        <bk:book>
            <bk:title>Advanced XML</bk:title>
            <auth:author>Jane Smith</auth:author>
        </bk:book>
      </catalog>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <?xml version="1.0" encoding="UTF-8"?>

      <catalog
        xmlns:bk="http://example.com/books"
        xmlns:auth="http://example.com/authors"
      >
        <bk:book>
          <bk:title>XML Basics</bk:title>
          <auth:author>John Doe</auth:author>
        </bk:book>
        <bk:book>
          <bk:title>Advanced XML</bk:title>
          <auth:author>Jane Smith</auth:author>
        </bk:book>
      </catalog>
    `)
  })

  test("simple namespaced elements", () => {
    const source = dedent`
      <root xmlns:prefix="http://example.com/ns">
        <prefix:child>Content</prefix:child>
      </root>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <root xmlns:prefix="http://example.com/ns">
        <prefix:child>Content</prefix:child>
      </root>
    `)
  })

  test("XML declaration with ERB render calls", () => {
    const source = dedent`
      <?xml version="1.0" encoding="UTF-8"?>
      <books>
        <% @books.each do |book| %>
          <%= render book %>
        <% end %>
      </books>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <?xml version="1.0" encoding="UTF-8"?>

      <books>
        <% @books.each do |book| %>
          <%= render book %>
        <% end %>
      </books>
    `)
  })

  test("XML with ERB conditional logic", () => {
    const source = dedent`
      <?xml version="1.0"?>
      <library>
        <% if @featured_books.any? %>
          <featured>
            <% @featured_books.each do |book| %>
              <book id="<%= book.id %>">
                <title><%= book.title %></title>
                <% if book.author %>
                  <author><%= book.author.name %></author>
                <% else %>
                  <author>Unknown</author>
                <% end %>
              </book>
            <% end %>
          </featured>
        <% end %>

        <catalog>
          <% @books.each do |book| %>
            <% unless book.featured? %>
              <book>
                <title><%= book.title %></title>
                <isbn><%= book.isbn %></isbn>
              </book>
            <% end %>
          <% end %>
        </catalog>
      </library>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <?xml version="1.0"?>

      <library>
        <% if @featured_books.any? %>
          <featured>
            <% @featured_books.each do |book| %>
              <book id="<%= book.id %>">
                <title><%= book.title %></title>
                <% if book.author %>
                  <author><%= book.author.name %></author>
                <% else %>
                  <author>Unknown</author>
                <% end %>
              </book>
            <% end %>
          </featured>
        <% end %>

        <catalog>
          <% @books.each do |book| %>
            <% unless book.featured? %>
              <book>
                <title><%= book.title %></title>
                <isbn><%= book.isbn %></isbn>
              </book>
            <% end %>
          <% end %>
        </catalog>
      </library>
    `)
  })

  test("XML declaration with ERB case statement", () => {
    const source = dedent`
      <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <document>
        <% case @document_type %>
        <% when 'book' %>
          <book>
            <title><%= @title %></title>
            <chapters>
              <% @chapters.each do |chapter| %>
                <chapter number="<%= chapter.number %>">
                  <title><%= chapter.title %></title>
                </chapter>
              <% end %>
            </chapters>
          </book>
        <% when 'article' %>
          <article>
            <headline><%= @headline %></headline>
            <content><%= @content %></content>
          </article>
        <% else %>
          <unknown-type>
            <content><%= @content %></content>
          </unknown-type>
        <% end %>
      </document>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <?xml version="1.0" encoding="UTF-8" standalone="yes"?>

      <document>
        <% case @document_type %>
        <% when 'book' %>
          <book>
            <title><%= @title %></title>
            <chapters>
              <% @chapters.each do |chapter| %>
                <chapter number="<%= chapter.number %>">
                  <title><%= chapter.title %></title>
                </chapter>
              <% end %>
            </chapters>
          </book>
        <% when 'article' %>
          <article>
            <headline><%= @headline %></headline>
            <content><%= @content %></content>
          </article>
        <% else %>
          <unknown-type>
            <content><%= @content %></content>
          </unknown-type>
        <% end %>
      </document>
    `)
  })

  test("XML with ERB partial rendering and complex logic", () => {
    const source = dedent`
      <?xml version="1.0"?>
      <sitemap xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <% if @pages.present? %>
          <% @pages.group_by(&:section).each do |section, pages| %>
            <!-- Section: <%= section.humanize %> -->
            <% pages.each do |page| %>
              <url>
                <loc><%= page_url(page) %></loc>
                <% if page.updated_at %>
                  <lastmod><%= page.updated_at.iso8601 %></lastmod>
                <% end %>
                <changefreq><%= page.change_frequency || 'monthly' %></changefreq>
                <priority><%= page.priority || 0.5 %></priority>
              </url>
            <% end %>

            <% if section.has_subsections? %>
              <%= render 'sitemap_subsections', section: section %>
            <% end %>
          <% end %>
        <% else %>
          <!-- No pages available -->
          <url>
            <loc><%= root_url %></loc>
            <changefreq>daily</changefreq>
            <priority>1.0</priority>
          </url>
        <% end %>
      </sitemap>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <?xml version="1.0"?>

      <sitemap xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <% if @pages.present? %>
          <% @pages.group_by(&:section).each do |section, pages| %>
            <!-- Section: <%= section.humanize %> -->
            <% pages.each do |page| %>
              <url>
                <loc><%= page_url(page) %></loc>
                <% if page.updated_at %>
                  <lastmod><%= page.updated_at.iso8601 %></lastmod>
                <% end %>
                <changefreq><%= page.change_frequency || 'monthly' %></changefreq>
                <priority><%= page.priority || 0.5 %></priority>
              </url>
            <% end %>

            <% if section.has_subsections? %>
              <%= render 'sitemap_subsections', section: section %>
            <% end %>
          <% end %>
        <% else %>
          <!-- No pages available -->
          <url>
            <loc><%= root_url %></loc>
            <changefreq>daily</changefreq>
            <priority>1.0</priority>
          </url>
        <% end %>
      </sitemap>
    `)
  })

  test("XML RSS feed with ERB logic", () => {
    const source = dedent`
      <?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
        <channel>
          <title><%= @feed_title %></title>
          <description><%= @feed_description %></description>
          <link><%= @site_url %></link>
          <atom:link href="<%= request.url %>" rel="self" type="application/rss+xml" />

          <% @articles.limit(20).each do |article| %>
            <item>
              <title><%= article.title %></title>
              <description><![CDATA[<%= article.excerpt %>]]></description>
              <link><%= article_url(article) %></link>
              <guid><%= article_url(article) %></guid>
              <pubDate><%= article.published_at.rfc2822 %></pubDate>

              <% if article.author.present? %>
                <author><%= article.author.email %> (<%= article.author.name %>)</author>
              <% end %>

              <% article.categories.each do |category| %>
                <category><%= category.name %></category>
              <% end %>
            </item>
          <% end %>
        </channel>
      </rss>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
        <channel>
          <title><%= @feed_title %></title>
          <description><%= @feed_description %></description>
          <link><%= @site_url %></link>
          <atom:link href="<%= request.url %>" rel="self" type="application/rss+xml" />

          <% @articles.limit(20).each do |article| %>
            <item>
              <title><%= article.title %></title>
              <description><![CDATA[<%= article.excerpt %>]]></description>
              <link><%= article_url(article) %></link>
              <guid><%= article_url(article) %></guid>
              <pubDate><%= article.published_at.rfc2822 %></pubDate>

              <% if article.author.present? %>
                <author><%= article.author.email %> (<%= article.author.name %>)</author>
              <% end %>

              <% article.categories.each do |category| %>
                <category><%= category.name %></category>
              <% end %>
            </item>
          <% end %>
        </channel>
      </rss>
    `)
  })

  test("real-world XML ERB template with complex nested logic", () => {
    const source = dedent`
      <?xml version="1.0" encoding="UTF-8"?>
      <Document>
        <%= render layout: "mobile_ui/restaurant/meal_wrapper" do %>
          <%= render partial: "mobile_ui/restaurant/nav_header" %>
          <%= render partial: "mobile_ui/restaurant/page_title", locals: { title: "Confirm Your Order" } %>

          <% unless order_items_missing %>
            <% if customer_app_version.present? && customer_app_version >= AppVersion.new("2.3.1") %>
              <%= render partial: "mobile_ui/restaurant/components/order_summary", locals: {
                title: "Items in Your Order",
                subtitle: "review items below",
                order_items: order_items
              } %>
            <% end %>
          <% end %>

          <%= render partial: "mobile_ui/restaurant/components/payment_card", locals: {
            message: "Please review your payment method and total",
            show_total: true,
          } %>

          <%= render partial: "mobile_ui/restaurant/components/special_instructions" %>

          <% if order_items_missing %>
            <% if customer_app_version.present? && customer_app_version >= AppVersion.new("2.3.1") %>
              <%= render partial: "mobile_ui/restaurant/components/order_summary", locals: {
                title: "Missing Items - Please Add",
                subtitle: "Select items from the menu to complete your order.",
                order_items: order_items
              } %>
            <% end %>
          <% end %>

      <% gallery_images = restaurant_gallery_photos %>

        <Section styleName="bg-surface p-6 rounded-lg shadow-sm">
          <SectionHeader>
            <Title xml:space="preserve">Upload a photo <Emphasis styleName="font-semibold" >showing your table setup</Emphasis> for verification.</Title>
            <Description styleName="text-sm text-secondary">Our system will verify your table matches your reservation. This helps us ensure food safety and accurate delivery to the right location.</Description>
          </SectionHeader>
          <ImageGallery
                    orientation="horizontal"
                    containerClass="gap-3 pt-4 pr-4"
                    styleName="flex flex-row overflow-scroll gap-3"
                  >
            <% gallery_images.each do |image| %>
              <GalleryImage size="large" src="<%= image[:src]%>" alt="<%= image[:alt]%>" width="<%= image[:width]%>" height="<%= image[:height]%>"></GalleryImage>
            <% end %>
          </ImageGallery>
        </Section>

        <% end %>

        <%= render partial: "mobile_ui/restaurant/toast_notifications"%>

        <% unless defined?(order_confirmed) && order_confirmed == true %>
          <% if order_items_missing %>
            <% if customer_app_version.present? && customer_app_version >= AppVersion.new("2.3.1") %>
              <%= render partial: "mobile_ui/restaurant/footers/action_footer", locals: {
                action_type: "menu_browse",
                primary_button_text: "Browse Menu"
              } %>
            <% end %>
          <% elsif verification_photos_needed %>
            <%= render partial: "mobile_ui/restaurant/footers/action_footer", locals: {
              action_type: "camera",
              primary_button_text: "Take Photo"
            } %>
          <% else %>
            <%= render partial: "mobile_ui/restaurant/footers/checkout_footer", locals: {
              primary_button_text: "Complete Order",
              order_items: order_items,
              enable_photos: true,
              enable_payment: true,
            } %>
          <% end %>
        <% end %>
      </Document>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <?xml version="1.0" encoding="UTF-8"?>

      <Document>
        <%= render layout: "mobile_ui/restaurant/meal_wrapper" do %>
          <%= render partial: "mobile_ui/restaurant/nav_header" %>
          <%= render partial: "mobile_ui/restaurant/page_title", locals: { title: "Confirm Your Order" } %>

          <% unless order_items_missing %>
            <% if customer_app_version.present? && customer_app_version >= AppVersion.new("2.3.1") %>
              <%= render partial: "mobile_ui/restaurant/components/order_summary", locals: {
                title: "Items in Your Order",
                subtitle: "review items below",
                order_items: order_items
              } %>
            <% end %>
          <% end %>

          <%= render partial: "mobile_ui/restaurant/components/payment_card", locals: {
            message: "Please review your payment method and total",
            show_total: true,
          } %>

          <%= render partial: "mobile_ui/restaurant/components/special_instructions" %>

          <% if order_items_missing %>
            <% if customer_app_version.present? && customer_app_version >= AppVersion.new("2.3.1") %>
              <%= render partial: "mobile_ui/restaurant/components/order_summary", locals: {
                title: "Missing Items - Please Add",
                subtitle: "Select items from the menu to complete your order.",
                order_items: order_items
              } %>
            <% end %>
          <% end %>

          <% gallery_images = restaurant_gallery_photos %>

          <Section styleName="bg-surface p-6 rounded-lg shadow-sm">
            <SectionHeader>
              <Title xml:space="preserve">
                Upload a photo
                <Emphasis styleName="font-semibold">
                  showing your table setup
                </Emphasis>
                for verification.
              </Title>
              <Description styleName="text-sm text-secondary">
                Our system will verify your table matches your reservation. This helps
                us ensure food safety and accurate delivery to the right location.
              </Description>
            </SectionHeader>
            <ImageGallery
              orientation="horizontal"
              containerClass="gap-3 pt-4 pr-4"
              styleName="flex flex-row overflow-scroll gap-3"
            >
              <% gallery_images.each do |image| %>
                <GalleryImage
                  size="large"
                  src="<%= image[:src]%>"
                  alt="<%= image[:alt]%>"
                  width="<%= image[:width]%>"
                  height="<%= image[:height]%>"
                ></GalleryImage>
              <% end %>
            </ImageGallery>
          </Section>
        <% end %>

        <%= render partial: "mobile_ui/restaurant/toast_notifications" %>

        <% unless defined?(order_confirmed) && order_confirmed == true %>
          <% if order_items_missing %>
            <% if customer_app_version.present? && customer_app_version >= AppVersion.new("2.3.1") %>
              <%= render partial: "mobile_ui/restaurant/footers/action_footer", locals: {
                action_type: "menu_browse",
                primary_button_text: "Browse Menu"
              } %>
            <% end %>
          <% elsif verification_photos_needed %>
            <%= render partial: "mobile_ui/restaurant/footers/action_footer", locals: {
              action_type: "camera",
              primary_button_text: "Take Photo"
            } %>
          <% else %>
            <%= render partial: "mobile_ui/restaurant/footers/checkout_footer", locals: {
              primary_button_text: "Complete Order",
              order_items: order_items,
              enable_photos: true,
              enable_payment: true,
            } %>
          <% end %>
        <% end %>
      </Document>
    `)
  })

  test("XML with complex ERB assignments and UI components", () => {
    const source = dedent`
      <?xml version="1.0" encoding="UTF-8"?>
      <Screen>
        <%= render layout: "mobile/app_layout" do %>
          <% current_user_orders = @user.orders.active %>
          <% notification_count = current_user_orders.unread.count %>

          <%= render partial: "shared/navigation", locals: {
            title: "My Orders",
            badge_count: notification_count
          } %>

          <% if current_user_orders.any? %>
            <ScrollView styleName="flex-1 bg-background">
              <% current_user_orders.group_by(&:status).each do |status, orders| %>
                <Section>
                  <HeaderText><%= status.humanize %> Orders (<%= orders.count %>)</HeaderText>

                  <% orders.each_with_index do |order, index| %>
                    <% estimated_time = order.estimated_completion %>
                    <% is_urgent = order.priority == 'high' %>

                    <OrderCard
                      id="<%= order.id %>"
                      urgent="<%= is_urgent %>"
                      estimatedTime="<%= estimated_time&.strftime('%I:%M %p') %>"
                    >
                      <% if order.items.present? %>
                        <ItemsList>
                          <% order.items.limit(3).each do |item| %>
                            <Item
                              name="<%= item.name %>"
                              quantity="<%= item.quantity %>"
                            />
                          <% end %>

                          <% if order.items.count > 3 %>
                            <Item
                              name="... and <%= pluralize(order.items.count - 3, 'more item') %>"
                            />
                          <% end %>
                        </ItemsList>
                      <% end %>

                      <StatusBadge
                        status="<%= order.status %>"
                        color="<%= order.status_color %>"
                      />

                      <% case order.status %>
                      <% when 'pending' %>
                        <%= render partial: "orders/pending_actions", locals: { order: order } %>
                      <% when 'in_progress' %>
                        <%= render partial: "orders/progress_tracker", locals: {
                          order: order,
                          show_eta: true
                        } %>
                      <% when 'ready' %>
                        <%= render partial: "orders/pickup_instructions", locals: { order: order } %>
                      <% else %>
                        <Text styleName="text-muted">
                          Status: <%= order.status.humanize %>
                        </Text>
                      <% end %>
                    </OrderCard>
                  <% end %>
                </Section>
              <% end %>
            </ScrollView>
          <% else %>
            <%= render partial: "shared/empty_state", locals: {
              title: "No orders yet",
              description: "When you place an order, it will appear here.",
              action_text: "Browse Menu",
              action_path: menu_path
            } %>
          <% end %>

          <%= render partial: "shared/bottom_navigation" %>
        <% end %>
      </Screen>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <?xml version="1.0" encoding="UTF-8"?>

      <Screen>
        <%= render layout: "mobile/app_layout" do %>
          <% current_user_orders = @user.orders.active %>
          <% notification_count = current_user_orders.unread.count %>

          <%= render partial: "shared/navigation", locals: {
            title: "My Orders",
            badge_count: notification_count
          } %>

          <% if current_user_orders.any? %>
            <ScrollView styleName="flex-1 bg-background">
              <% current_user_orders.group_by(&:status).each do |status, orders| %>
                <Section>
                  <HeaderText>
                    <%= status.humanize %> Orders (<%= orders.count %>)
                  </HeaderText>

                  <% orders.each_with_index do |order, index| %>
                    <% estimated_time = order.estimated_completion %>
                    <% is_urgent = order.priority == 'high' %>

                    <OrderCard
                      id="<%= order.id %>"
                      urgent="<%= is_urgent %>"
                      estimatedTime="<%= estimated_time&.strftime('%I:%M %p') %>"
                    >
                      <% if order.items.present? %>
                        <ItemsList>
                          <% order.items.limit(3).each do |item| %>
                            <Item
                              name="<%= item.name %>"
                              quantity="<%= item.quantity %>"
                            />
                          <% end %>

                          <% if order.items.count > 3 %>
                            <Item
                              name="... and <%= pluralize(order.items.count - 3, 'more item') %>"
                            />
                          <% end %>
                        </ItemsList>
                      <% end %>

                      <StatusBadge
                        status="<%= order.status %>"
                        color="<%= order.status_color %>"
                      />

                      <% case order.status %>
                      <% when 'pending' %>
                        <%= render partial: "orders/pending_actions", locals: { order: order } %>
                      <% when 'in_progress' %>
                        <%= render partial: "orders/progress_tracker", locals: {
                          order: order,
                          show_eta: true
                        } %>
                      <% when 'ready' %>
                        <%= render partial: "orders/pickup_instructions", locals: { order: order } %>
                      <% else %>
                        <Text styleName="text-muted">
                          Status: <%= order.status.humanize %>
                        </Text>
                      <% end %>
                    </OrderCard>
                  <% end %>
                </Section>
              <% end %>
            </ScrollView>
          <% else %>
            <%= render partial: "shared/empty_state", locals: {
              title: "No orders yet",
              description: "When you place an order, it will appear here.",
              action_text: "Browse Menu",
              action_path: menu_path
            } %>
          <% end %>

          <%= render partial: "shared/bottom_navigation" %>
        <% end %>
      </Screen>
    `)
  })
})
