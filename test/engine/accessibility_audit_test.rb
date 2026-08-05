# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"
require_relative "../../lib/herb/engine/accessibility_audit/test_helper"

module Engine
  class AccessibilityAuditTest < Minitest::Spec
    include SnapshotUtils

    Audit = Herb::Engine::AccessibilityAudit

    before do
      Audit.mode = :silent
      Audit.disabled_checks = []
      Audit.on_violation = nil
      Audit.sample_rate = 1.0
      Audit.report_once = false
      Audit.max_violations = nil
      Audit.reset_reported!
    end

    after do
      Audit.mode = :warn
      Audit.disabled_checks = []
      Audit.on_violation = nil
      Audit.sample_rate = 1.0
      Audit.report_once = false
      Audit.max_violations = nil
      Audit.reset_reported!
      Audit.reset!
    end

    def compile(template, options = {})
      Herb::Engine.new(template, {
        accessibility_audit: true,
        filename: "app/views/test.html.erb",
        escape: true,
      }.merge(options))
    end

    def audit(template, locals = {}, options = {})
      engine = compile(template, options)

      Audit.collect { evaluate_herb_source(engine.src, locals) }
    end

    def codes(template, locals = {}, options = {})
      audit(template, locals, options).map(&:code)
    end

    test "audit disabled by default" do
      template = '<img src="/logo.png" alt="<%= caption %>">'

      assert_compiled_snapshot(template)
    end

    test "attribute value gets wrapped" do
      template = '<img src="/logo.png" alt="<%= caption %>">'

      assert_compiled_snapshot(template, accessibility_audit: true, filename: "app/views/test.html.erb")
    end

    test "element with a dynamic accessible name gets a name frame" do
      template = '<a href="/about"><%= label %></a>'

      assert_compiled_snapshot(template, accessibility_audit: true, filename: "app/views/test.html.erb")
    end

    test "static markup is left alone" do
      template = '<a href="/about">About us</a><img src="/logo.png" alt="Logo">'

      assert_compiled_snapshot(template, accessibility_audit: true, filename: "app/views/test.html.erb")
    end

    test "element with static text is left alone" do
      template = '<a href="/about">Read the <%= post.title %> announcement</a>'

      assert_compiled_snapshot(template, accessibility_audit: true, filename: "app/views/test.html.erb")
    end

    test "element with a static accessible name is left alone" do
      template = '<a href="/about" aria-label="About us"><%= icon %></a>'

      assert_compiled_snapshot(template, accessibility_audit: true, filename: "app/views/test.html.erb")
    end

    test "attribute without any applicable check is left alone" do
      template = '<div class="<%= css_class %>" data-id="<%= user.id %>">Content</div>'

      assert_compiled_snapshot(template, accessibility_audit: true, filename: "app/views/test.html.erb")
    end

    test "attribute mixing static and dynamic parts is left alone" do
      template = '<img src="/logo.png" alt="Logo for <%= account.name %>">'

      assert_compiled_snapshot(template, accessibility_audit: true, filename: "app/views/test.html.erb")
    end

    test "nested elements report through the outer name frame" do
      template = '<a href="/about"><span><%= label %></span></a>'

      assert_compiled_snapshot(template, accessibility_audit: true, filename: "app/views/test.html.erb")
    end

    test "erb inside excluded elements is left alone" do
      template = '<script>var id = "<%= user.id %>";</script>'

      assert_compiled_snapshot(template, accessibility_audit: true, filename: "app/views/test.html.erb")
    end

    test "block expressions are left alone" do
      template = <<~ERB
        <a href="/about"><%= content_tag :span do %><%= label %><% end %></a>
      ERB

      assert_compiled_snapshot(template, accessibility_audit: true, filename: "app/views/test.html.erb")
    end

    test "audit only compiles the requested checks" do
      template = '<a href="<%= url %>"><%= label %></a>'

      assert_compiled_snapshot(template, accessibility_audit: [:empty_link_text], filename: "app/views/test.html.erb")
    end

    test "instrumentation does not change the rendered output" do
      template = <<~ERB
        <a href="<%= url %>" id="<%= id %>"><%= label %></a>
        <img src="/logo.png" alt="<%= caption %>">
        <h1><%= title %></h1>
      ERB

      locals = { url: "/about", id: "link", label: "<b>About</b>", caption: "Logo", title: "Welcome" }

      plain = evaluate_herb_source(Herb::Engine.new(template, escape: true).src, locals)
      audited = nil

      Audit.collect { audited = evaluate_herb_source(compile(template).src, locals) }

      assert_equal plain, audited
    end

    test "blank alt text" do
      template = '<img src="/logo.png" alt="<%= caption %>">'

      assert_equal ["blank-alt-text"], codes(template, { caption: "  " })
      assert_empty codes(template, { caption: "Company logo" })
    end

    test "redundant alt text" do
      template = '<img src="/logo.png" alt="<%= caption %>">'

      assert_equal ["redundant-alt-text"], codes(template, { caption: "Photo of a cat" })
      assert_empty codes(template, { caption: "A cat" })
    end

    test "blank aria label" do
      template = '<button aria-label="<%= label %>">…</button>'

      assert_equal ["blank-aria-label"], codes(template, { label: nil })
      assert_empty codes(template, { label: "Open menu" })
    end

    test "blank href" do
      template = '<a href="<%= url %>">About</a>'

      assert_equal ["blank-href"], codes(template, { url: "" })
      assert_empty codes(template, { url: "/about" })
    end

    test "blank frame title" do
      template = '<iframe src="/embed" title="<%= title %>"></iframe>'

      assert_equal ["blank-frame-title"], codes(template, { title: "" })
      assert_empty codes(template, { title: "Sales report" })
    end

    test "duplicate id" do
      template = '<div id="<%= id %>">a</div><div id="<%= other_id %>">b</div>'

      assert_equal ["duplicate-id"], codes(template, { id: "user_1", other_id: "user_1" })
      assert_empty codes(template, { id: "user_1", other_id: "user_2" })
    end

    test "duplicate id is only checked inside a session" do
      engine = compile('<div id="<%= id %>">a</div><div id="<%= other_id %>">b</div>')
      locals = { id: "user_1", other_id: "user_1" }

      Audit.reset!
      evaluate_herb_source(engine.src, locals)

      assert_empty Audit.violations
    end

    test "invalid lang" do
      template = '<html lang="<%= locale %>"><body>Hi</body></html>'

      assert_equal ["invalid-lang"], codes(template, { locale: "english" })
      assert_empty codes(template, { locale: "en-GB" })
    end

    test "invalid role" do
      template = '<div role="<%= role %>">Content</div>'

      assert_equal ["invalid-role"], codes(template, { role: "buton" })
      assert_equal ["invalid-role"], codes(template, { role: "widget" })
      assert_empty codes(template, { role: "button" })
    end

    test "positive tabindex" do
      template = '<div tabindex="<%= index %>">Content</div>'

      assert_equal ["positive-tabindex"], codes(template, { index: 3 })
      assert_empty codes(template, { index: 0 })
      assert_empty codes(template, { index: -1 })
    end

    test "invalid aria value" do
      template = '<button aria-expanded="<%= expanded %>">Menu</button>'

      assert_equal ["invalid-aria-value"], codes(template, { expanded: "yes" })
      assert_empty codes(template, { expanded: false })
    end

    test "empty link text" do
      template = '<a href="/about"><%= label %></a>'

      assert_equal ["empty-link-text"], codes(template, { label: "" })
      assert_empty codes(template, { label: "About us" })
    end

    test "empty link text accounts for accessible names inside the link" do
      template = '<a href="/profile"><%= avatar %></a>'

      assert_empty codes(template, { avatar: '<img src="/me.png" alt="My profile">' }, { escape: false })
      assert_equal ["empty-link-text"], codes(template, { avatar: '<img src="/me.png" alt="">' }, { escape: false })
    end

    test "generic link text" do
      template = '<a href="/about"><%= label %></a>'

      assert_equal ["generic-link-text"], codes(template, { label: "Read more" })
      assert_empty codes(template, { label: "Read the 2026 report" })
    end

    test "empty button text" do
      template = "<button><%= icon %> <%= label %></button>"

      assert_equal ["empty-button-text"], codes(template, { icon: "", label: "" })
      assert_empty codes(template, { icon: "", label: "Save" })
    end

    test "empty heading" do
      template = "<h2><%= title %></h2>"

      assert_equal ["empty-heading"], codes(template, { title: "  " })
      assert_empty codes(template, { title: "Latest posts" })
    end

    test "empty label" do
      template = '<label for="email"><%= label %></label>'

      assert_equal ["empty-label"], codes(template, { label: "" })
      assert_empty codes(template, { label: "Email" })
    end

    test "empty summary" do
      template = "<details><summary><%= label %></summary>Body</details>"

      assert_equal ["empty-summary"], codes(template, { label: "" })
      assert_empty codes(template, { label: "Details" })
    end

    test "nested name frames report separately and propagate to the parent" do
      template = '<a href="/post"><h2><%= title %></h2></a>'

      assert_equal ["empty-heading", "empty-link-text"], codes(template, { title: "" })
      assert_empty codes(template, { title: "Announcement" })
    end

    test "violations carry the source location" do
      template = <<~ERB
        <div>
          <img src="/logo.png" alt="<%= caption %>">
        </div>
      ERB

      violation = audit(template, { caption: "" }).first

      assert_equal "blank-alt-text", violation.code
      assert_equal "img", violation.element
      assert_equal "alt", violation.attribute
      assert_equal "app/views/test.html.erb", violation.file
      assert_equal 2, violation.line
      assert_equal 29, violation.column
    end

    test "each location is only reported once per session" do
      template = <<~ERB
        <% 3.times do %>
          <a href="/about"><%= label %></a>
        <% end %>
      ERB

      assert_equal ["empty-link-text"], codes(template, { label: "" })
    end

    test "raise mode raises on the first violation" do
      Audit.mode = :raise

      engine = compile("<h1><%= title %></h1>")

      error = assert_raises(Herb::Engine::AccessibilityAudit::ViolationError) do
        evaluate_herb_source(engine.src, { title: "" })
      end

      assert_includes error.message, "empty-heading"
    end

    test "disabled mode turns instrumented templates into no-ops" do
      Audit.mode = :disabled

      engine = compile("<h1><%= title %></h1>")

      Audit.reset!
      evaluate_herb_source(engine.src, { title: "" })

      assert_empty Audit.violations
    end

    test "on_violation is called for every violation" do
      reported = []
      Audit.on_violation = ->(violation) { reported << violation.code }

      audit("<h1><%= title %></h1>", { title: "" })

      assert_equal ["empty-heading"], reported
    end

    test "checks can be disabled at runtime" do
      Audit.disabled_checks = [:empty_heading]

      assert_empty codes("<h1><%= title %></h1>", { title: "" })
    end

    test "checks can be limited at compile time" do
      template = '<a href="<%= url %>"><%= label %></a>'

      assert_equal ["empty-link-text"],
                   codes(template, { url: "", label: "" }, { accessibility_audit: [:empty_link_text] })
    end

    test "session scopes the state to one render" do
      engine = compile('<div id="<%= id %>">a</div>')

      first = Audit.collect { evaluate_herb_source(engine.src, { id: "user_1" }) }
      second = Audit.collect { evaluate_herb_source(engine.src, { id: "user_1" }) }

      assert_empty first
      assert_empty second
    end

    test "session returns the value of the block" do
      assert_equal(:result, Audit.session { :result })
    end

    test "start_session and end_session scope state without a block" do
      engine = compile('<div id="<%= id %>">a</div><div id="<%= other_id %>">b</div>')

      Audit.start_session
      evaluate_herb_source(engine.src, { id: "user_1", other_id: "user_1" })
      violations = Audit.end_session

      assert_equal ["duplicate-id"], violations.map(&:code)
      assert_empty Audit.violations
    end

    test "verify! raises with every recorded violation" do
      engine = compile('<h1><%= title %></h1><a href="/x"><%= label %></a>')

      error = assert_raises(Herb::Engine::AccessibilityAudit::ViolationError) do
        Audit.session do
          evaluate_herb_source(engine.src, { title: "", label: "" })

          Audit.verify!
        end
      end

      assert_includes error.message, "2 accessibility violations:"
      assert_includes error.message, "empty-heading"
      assert_includes error.message, "empty-link-text"
    end

    test "verify! is a no-op without violations" do
      assert_nil(Audit.session { Audit.verify! })
    end

    test "unsampled sessions skip the checks" do
      Audit.sample_rate = 0.0

      assert_empty codes("<h1><%= title %></h1>", { title: "" })
    end

    test "sampling does not change the rendered output" do
      Audit.sample_rate = 0.0

      template = '<a href="/about"><%= label %></a>'
      locals = { label: "About" }

      plain = evaluate_herb_source(Herb::Engine.new(template, escape: true).src, locals)
      audited = nil

      Audit.session { audited = evaluate_herb_source(compile(template).src, locals) }

      assert_equal plain, audited
    end

    test "renders outside a session are always audited" do
      Audit.sample_rate = 0.0

      engine = compile("<h1><%= title %></h1>")

      Audit.reset!
      evaluate_herb_source(engine.src, { title: "" })

      assert_equal ["empty-heading"], Audit.violations.map(&:code)
    end

    test "max_violations caps how much a single session reports" do
      Audit.max_violations = 1

      template = <<~ERB
        <h1><%= title %></h1>
        <h2><%= subtitle %></h2>
      ERB

      assert_equal ["empty-heading"], codes(template, { title: "", subtitle: "" })
    end

    test "report_once reports each site once per process" do
      Audit.report_once = true

      template = "<h1><%= title %></h1>"

      assert_equal ["empty-heading"], codes(template, { title: "" })
      assert_empty codes(template, { title: "" })
    end

    test "a check that raises does not break the render" do
      Audit.on_violation = ->(_violation) { raise "boom" }

      engine = compile("<h1><%= title %></h1>")
      output = nil

      _stdout, stderr = capture_io do
        Audit.session { output = evaluate_herb_source(engine.src, { title: "" }) }
      end

      assert_equal "<h1></h1>", output
      assert_includes stderr, "accessibility audit check failed"
    end

    test "internal errors are only reported once per process" do
      Audit.on_violation = ->(_violation) { raise "boom" }

      engine = compile("<h1><%= title %></h1>")

      _stdout, first = capture_io { Audit.session { evaluate_herb_source(engine.src, { title: "" }) } }
      _stdout, second = capture_io { Audit.session { evaluate_herb_source(engine.src, { title: "" }) } }

      assert_includes first, "accessibility audit check failed"
      assert_empty second
    end

    test "configure sets everything in one place" do
      Audit.configure do |audit|
        audit.mode = :silent
        audit.sample_rate = 0.5
        audit.report_once = true
        audit.max_violations = 10
      end

      assert_equal :silent, Audit.mode
      assert_in_delta 0.5, Audit.sample_rate
      assert Audit.report_once
      assert_equal 10, Audit.max_violations
    end

    test "violations serialize to a hash" do
      violation = audit('<img src="/logo.png" alt="<%= caption %>">', { caption: "" }).first

      assert_equal({
        code: "blank-alt-text",
        message: violation.message,
        element: "img",
        attribute: "alt",
        value: "",
        file: "app/views/test.html.erb",
        line: 1,
        column: 27,
      }, violation.to_h)
    end
  end

  class AccessibilityAuditMiddlewareTest < Minitest::Spec
    include SnapshotUtils

    Audit = Herb::Engine::AccessibilityAudit

    before do
      Audit.mode = :silent
    end

    after do
      Audit.mode = :warn
      Audit.reset!
    end

    def render(template, locals = {})
      engine = Herb::Engine.new(template, accessibility_audit: true, filename: "test.html.erb", escape: true)

      evaluate_herb_source(engine.src, locals)
    end

    def app(body, headers: { "content-type" => "text/html; charset=utf-8" }, template: "<h1><%= title %></h1>", locals: { title: "" })
      lambda { |_env|
        render(template, locals)

        [200, headers, [body]]
      }
    end

    def call(middleware)
      middleware.call({})
    end

    def payload_from(html)
      JSON.parse(html[%r{<script type="application/json" data-herb-accessibility-violations[^>]*>(.*?)</script>}m, 1])
    end

    test "injects the violations into an HTML response" do
      status, headers, body = call(Audit::Middleware.new(app("<html><body>Hi</body></html>")))

      assert_equal 200, status
      assert_includes body.first, %(<script type="application/json" data-herb-accessibility-violations data-count="1">)
      assert_equal body.first.bytesize.to_s, headers["content-length"] if headers.key?("content-length")

      violation = payload_from(body.first).first

      assert_equal "empty-heading", violation["code"]
      assert_equal "h1", violation["element"]
      assert_equal "test.html.erb", violation["file"]
      assert_equal 1, violation["line"]
    end

    test "injects at the end of the page" do
      _status, _headers, body = call(Audit::Middleware.new(app("<html><body>Hi</body></html>")))

      assert_match %r{<script type="application/json".*</script></body></html>\z}m, body.first
    end

    test "escapes markup in the payload so it cannot end the script block early" do
      template = "<h1><%= title %></h1>"
      locals = { title: "" }

      middleware = Audit::Middleware.new(app("<html><body>Hi</body></html>", template: template, locals: locals))

      _status, _headers, body = call(middleware)

      payload = body.first[%r{data-herb-accessibility-violations[^>]*>(.*?)</script>}m, 1]

      refute_includes payload, "<"
      assert_kind_of Array, JSON.parse(payload)
    end

    test "updates the content length" do
      headers = { "content-type" => "text/html", "content-length" => "31" }

      _status, updated, body = call(Audit::Middleware.new(app("<html><body>Hi</body></html>", headers: headers)))

      assert_equal body.first.bytesize.to_s, updated["content-length"]
    end

    test "leaves a response without violations alone" do
      original = "<html><body>Hi</body></html>"
      middleware = Audit::Middleware.new(app(original, locals: { title: "Welcome" }))

      _status, _headers, body = call(middleware)

      assert_equal original, body.first
    end

    test "leaves non-HTML responses alone" do
      original = %({"ok":true})
      headers = { "content-type" => "application/json" }

      _status, _headers, body = call(Audit::Middleware.new(app(original, headers: headers)))

      assert_equal original, body.first
    end

    test "leaves a response without a body tag alone" do
      original = "<turbo-stream></turbo-stream>"

      _status, _headers, body = call(Audit::Middleware.new(app(original)))

      assert_equal original, body.first
    end

    test "injection can be turned off" do
      original = "<html><body>Hi</body></html>"

      _status, _headers, body = call(Audit::Middleware.new(app(original), inject: false))

      assert_equal original, body.first
    end

    test "disabled mode skips the session entirely" do
      Audit.mode = :disabled

      original = "<html><body>Hi</body></html>"

      _status, _headers, body = call(Audit::Middleware.new(app(original)))

      assert_equal original, body.first
    end

    test "scopes one session to one request" do
      template = '<div id="<%= id %>">a</div><div id="<%= other %>">b</div>'
      locals = { id: "user_1", other: "user_1" }

      middleware = Audit::Middleware.new(app("<html><body>Hi</body></html>", template: template, locals: locals))

      _status, _headers, first = call(middleware)
      _status, _headers, second = call(middleware)

      assert_includes first.first, "duplicate-id"
      assert_includes second.first, "duplicate-id"
    end
  end

  class AccessibilityAuditTestHelperTest < Minitest::Spec
    include SnapshotUtils
    include Herb::Engine::AccessibilityAudit::TestHelper

    Audit = Herb::Engine::AccessibilityAudit

    before do
      Audit.mode = :silent
    end

    after do
      Audit.mode = :warn
    end

    def render(template, locals = {})
      engine = Herb::Engine.new(template, accessibility_audit: true, filename: "test.html.erb", escape: true)

      evaluate_herb_source(engine.src, locals)
    end

    test "passes when nothing violates a check" do
      assert_no_accessibility_violations do
        render('<a href="/about"><%= label %></a>', { label: "About us" })
      end
    end

    test "fails when a render violates a check" do
      error = assert_raises(Minitest::Assertion) do
        assert_no_accessibility_violations do
          render('<a href="/about"><%= label %></a>', { label: "" })
        end
      end

      assert_includes error.message, "1 accessibility violation:"
      assert_includes error.message, "empty-link-text"
    end

    test "violations can be inspected instead of failing" do
      violations = accessibility_violations do
        render("<h1><%= title %></h1>", { title: "" })
      end

      assert_equal ["empty-heading"], violations.map(&:code)
    end

    test "every render in a test is audited, and a test can opt out" do
      render("<h1><%= title %></h1>", { title: "" })

      assert_equal ["empty-heading"], Audit.violations.map(&:code)

      skip_accessibility_audit!
    end
  end
end
