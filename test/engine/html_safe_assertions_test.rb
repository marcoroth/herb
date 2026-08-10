# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"
require_relative "../../lib/herb/engine/html_safe_assertions"

module Engine
  class HTMLSafeAssertionsTest < Minitest::Spec
    def violations(value, **)
      Herb::Engine::HTMLSafeAssertions.violations_for(value, **).map(&:name)
    end

    test "reports a script element" do
      assert_equal [:script_element], violations("<p>hi</p><script>alert(1)</script>")
    end

    test "reports an inline event handler" do
      assert_equal [:event_handler], violations(%(<img src="x" onerror="steal()">))
      assert_equal [:event_handler], violations("<svg/onload=alert(1)>")
      assert_equal [:event_handler], violations(%(<a ONCLICK="x()">link</a>))
      assert_equal [:event_handler], violations(%(<video onloadeddata="x()">))
    end

    test "reports a javascript URL" do
      assert_equal [:javascript_url], violations(%(<a href="javascript:alert(1)">link</a>))
      assert_equal [:javascript_url], violations("javascript:alert(1)")
      assert_equal [:javascript_url], violations(%(<a href="VBScript:msgbox(1)">link</a>))
    end

    test "reports a data URL that is a document" do
      assert_equal [:data_url], violations(%(<a href="data:text/html;base64,PHNjcmlwdD4=">link</a>))
    end

    test "reports elements that load remote content" do
      assert_equal [:risky_element], violations(%(<iframe src="https://example.com"></iframe>))
      assert_equal [:risky_element], violations(%(<object data="x.swf"></object>))
      assert_equal [:risky_element], violations(%(<base href="https://example.com">))
    end

    test "reports a meta refresh" do
      assert_equal [:meta_refresh], violations(%(<meta http-equiv="refresh" content="0;url=https://example.com">))
    end

    test "reports every check that matches" do
      value = %(<script>alert(1)</script><iframe src="x"></iframe>)

      assert_equal [:script_element, :risky_element], violations(value)
    end

    test "leaves ordinary markup alone" do
      assert_empty violations(%(<p class="intro">Hello <b>world</b></p>))
      assert_empty violations(%(<a href="/posts/1">Post</a>))
      assert_empty violations(%(<div only="1" data-online="true">safe</div>))
      assert_empty violations(%(<link rel="stylesheet" href="/app.css">))
      assert_empty violations(%(<form action="/posts"><input name="title"></form>))
    end

    test "leaves values that are not strings alone" do
      assert_empty violations(nil)
      assert_empty violations(42)
    end

    test "leaves values that are already html safe alone" do
      assert_empty violations("<script>alert(1)</script>".html_safe)
    end

    test "ignored checks are skipped" do
      value = %(<script>alert(1)</script><iframe src="x"></iframe>)

      assert_equal [:risky_element], violations(value, ignore: [:script_element])
      assert_empty violations(value, ignore: [:script_element, :risky_element])
    end

    test "check returns the value it was given" do
      value = "<p>hi</p>"

      assert_same value, Herb::Engine::HTMLSafeAssertions.check(value)
    end
  end
end
