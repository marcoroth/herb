# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"

module Engine
  class EscapeTest < Minitest::Spec
    include SnapshotUtils

    context "escape ERB output tag" do
      template = %(<h1><%= value %></h1>)

      test "default" do
        assert_compiled_snapshot(template)
      end

      test "escape: true" do
        assert_compiled_snapshot(template, escape: true)
      end

      test "custom escapefunc" do
        assert_compiled_snapshot(template, escapefunc: "CustomEscape.h")
      end

      test "empty escapefunc" do
        assert_compiled_snapshot(template, escapefunc: "")
      end

      test "escape: true and custom escapefunc" do
        assert_compiled_snapshot(template, escape: true, escapefunc: "CustomEscape.h")
      end

      test "escape: true and empty escapefunc" do
        assert_compiled_snapshot(template, escape: true, escapefunc: "")
      end

      test "escape: false and custom escapefunc" do
        assert_compiled_snapshot(template, escape: false, escapefunc: "CustomEscape.h")
      end

      test "escape: false and empty escapefunc" do
        assert_compiled_snapshot(template, escape: false, attrfunc: "")
      end
    end

    context "escape ERB raw output tag" do
      template = %(<h1><%== value %></h1>)

      test "default" do
        assert_compiled_snapshot(template)
      end

      test "escape: true" do
        assert_compiled_snapshot(template, escape: true)
      end

      test "custom escapefunc" do
        assert_compiled_snapshot(template, escapefunc: "CustomEscape.h")
      end

      test "empty escapefunc" do
        assert_compiled_snapshot(template, escapefunc: "")
      end

      test "escape: true and custom escapefunc" do
        assert_compiled_snapshot(template, escape: true, escapefunc: "CustomEscape.h")
      end

      test "escape: true and empty escapefunc" do
        assert_compiled_snapshot(template, escape: true, escapefunc: "")
      end

      test "escape: false and custom escapefunc" do
        assert_compiled_snapshot(template, escape: false, escapefunc: "CustomEscape.h")
      end

      test "escape: false and empty escapefunc" do
        assert_compiled_snapshot(template, escape: false, escapefunc: "")
      end
    end

    context "attributes" do
      template = %(<div class="<%= value %>"></div>)

      test "default" do
        assert_compiled_snapshot(template)
      end

      test "escape: true" do
        assert_compiled_snapshot(template, escape: true)
      end

      test "custom attrfunc" do
        assert_compiled_snapshot(template, attrfunc: "CustomEscape.attribute")
      end

      test "empty attrfunc" do
        assert_compiled_snapshot(template, attrfunc: "")
      end

      test "escape: true and custom attrfunc" do
        assert_compiled_snapshot(template, escape: true, attrfunc: "CustomEscape.attribute")
      end

      test "escape: true and empty attrfunc" do
        assert_compiled_snapshot(template, escape: true, attrfunc: "")
      end

      test "escape: false and custom attrfunc" do
        assert_compiled_snapshot(template, escape: false, attrfunc: "CustomEscape.attribute")
      end

      test "escape: false and empty attrfunc" do
        assert_compiled_snapshot(template, escape: false, attrfunc: "")
      end
    end

    context "javascript" do
      template = %(<script><%= value %></script>)

      test "default" do
        assert_compiled_snapshot(template)
      end

      test "escape: true" do
        assert_compiled_snapshot(template, escape: true)
      end

      test "custom jsfunc" do
        assert_compiled_snapshot(template, jsfunc: "CustomEscape.js")
      end

      test "empty jsfunc" do
        assert_compiled_snapshot(template, jsfunc: "")
      end

      test "escape: true and custom jsfunc" do
        assert_compiled_snapshot(template, escape: true, jsfunc: "CustomEscape.js")
      end

      test "escape: true and empty jsfunc" do
        assert_compiled_snapshot(template, escape: true, jsfunc: "")
      end

      test "escape: false and custom jsfunc" do
        assert_compiled_snapshot(template, escape: false, jsfunc: "CustomEscape.js")
      end

      test "escape: false and empty jsfunc" do
        assert_compiled_snapshot(template, escape: false, jsfunc: "")
      end
    end

    context "style" do
      template = %(<style><%= value %></style>)

      test "default" do
        assert_compiled_snapshot(template)
      end

      test "escape: true" do
        assert_compiled_snapshot(template, escape: true)
      end

      test "custom cssfunc" do
        assert_compiled_snapshot(template, cssfunc: "CustomEscape.css")
      end

      test "empty cssfunc" do
        assert_compiled_snapshot(template, cssfunc: "")
      end

      test "escape: true and custom cssfunc" do
        assert_compiled_snapshot(template, escape: true, cssfunc: "CustomEscape.css")
      end

      test "escape: true and empty cssfunc" do
        assert_compiled_snapshot(template, escape: true, cssfunc: "")
      end

      test "escape: false and custom cssfunc" do
        assert_compiled_snapshot(template, escape: false, cssfunc: "CustomEscape.css")
      end

      test "escape: false and empty cssfunc" do
        assert_compiled_snapshot(template, escape: false, cssfunc: "")
      end
    end
  end
end
