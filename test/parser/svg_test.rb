# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class SVGTest < Minitest::Spec
    include SnapshotUtils

    test "svg" do
      assert_parsed_snapshot("<svg></svg>")
    end

    test "svg with void path element" do
      assert_parsed_snapshot(<<~SVG)
        <svg>
          <path />
        </svg>
      SVG
    end

    test "svg with non-void path element" do
      assert_parsed_snapshot(<<~SVG)
        <svg>
          <path></path>
        </svg>
      SVG
    end

    test "svg with nested void path element" do
      assert_parsed_snapshot(<<~SVG)
        <svg>
          <g>
            <path/>
          </g>
        </svg>
      SVG
    end

    test "HTML void can be non-void within svg" do
      assert_parsed_snapshot(<<~SVG)
        <svg>
          <br></br>
        </svg>
      SVG
    end

    test "svg unclosed element reports an error" do
      assert_parsed_snapshot(<<~SVG)
        <svg>
          <g>
        </svg>
      SVG
    end
  end
end
