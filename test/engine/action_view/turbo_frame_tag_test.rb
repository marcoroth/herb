# frozen_string_literal: true

require_relative "action_view_test_helper"

module Engine
  module ActionView
    class TurboFrameTagTest < Minitest::Spec
      include ActionViewTestHelper

      ModelName = Data.define(:param_key)

      Post = Data.define(:id) do
        def to_key = [id]
        def self.model_name = ModelName.new("post")
        def model_name = self.class.model_name
      end

      test "turbo_frame_tag with block" do
        assert_optimized_snapshot(<<~ERB)
          <%= turbo_frame_tag "tray" do %>
            Content
          <% end %>
        ERB
      end

      test "turbo_frame_tag without block" do
        assert_optimized_snapshot('<%= turbo_frame_tag "tray" %>')
      end

      test "turbo_frame_tag with src" do
        assert_optimized_snapshot('<%= turbo_frame_tag "tray", src: "/path" %>')
      end

      test "turbo_frame_tag with src and target" do
        assert_optimized_snapshot('<%= turbo_frame_tag "tray", src: "/path", target: "_top" %>')
      end

      test "turbo_frame_tag with loading lazy" do
        assert_optimized_snapshot('<%= turbo_frame_tag "tray", src: "/path", loading: "lazy" %>')
      end

      test "turbo_frame_tag with class and block" do
        assert_optimized_snapshot(<<~ERB)
          <%= turbo_frame_tag "tray", class: "frame" do %>
            Content
          <% end %>
        ERB
      end

      test "turbo_frame_tag with variable id" do
        assert_optimized_snapshot(
          "<%= turbo_frame_tag dom_id do %>Content<% end %>",
          { dom_id: "post_1" }
        )
      end

      test "turbo_frame_tag with data attributes" do
        assert_optimized_snapshot('<%= turbo_frame_tag "tray", data: { controller: "frame" } do %>Content<% end %>')
      end

      test "turbo_frame_tag with a string id held in a local" do
        assert_optimized_snapshot(
          "<%= turbo_frame_tag frame_id do %>Content<% end %>",
          { frame_id: "post_1" }
        )
      end

      test "turbo_frame_tag with a string prefix and a string id held in a local" do
        assert_optimized_snapshot(
          '<%= turbo_frame_tag "notes", frame_id do %>Content<% end %>',
          { frame_id: "post_1" }
        )
      end

      test "turbo_frame_tag with literal ids joins them" do
        assert_optimized_snapshot('<%= turbo_frame_tag "notes", :list %>')
      end

      test "turbo_frame_tag with an array id" do
        assert_optimized_snapshot(
          '<%= turbo_frame_tag frame_id %>',
          { frame_id: ["post", [7, "notes"]] }
        )
      end

      test "turbo_frame_tag with an array id and block" do
        assert_optimized_snapshot(
          '<%= turbo_frame_tag frame_id do %>Content<% end %>',
          { frame_id: ["post", [7, "notes"]] }
        )
      end

      test "turbo_frame_tag with splatted ids" do
        assert_optimized_snapshot(
          '<%= turbo_frame_tag *ids %>',
          { ids: ["post", 7] }
        )
      end

      test "turbo_frame_tag with splatted ids and block" do
        assert_optimized_snapshot(
          '<%= turbo_frame_tag *ids do %>Content<% end %>',
          { ids: ["post", 7] }
        )
      end

      test "turbo_frame_tag with ids around a splat and keyword attributes" do
        assert_optimized_snapshot(
          '<%= turbo_frame_tag "post", *ids, "notes", class: "frame" %>',
          { ids: [7, "comments"] }
        )
      end

      test "turbo_frame_tag with ids around a splat and keyword attributes and block" do
        assert_optimized_snapshot(
          '<%= turbo_frame_tag "post", *ids, "notes", class: "frame" do %>Content<% end %>',
          { ids: [7, "comments"] }
        )
      end

      test "turbo_frame_tag with an empty splat" do
        assert_optimized_snapshot(
          '<%= turbo_frame_tag *ids %>',
          { ids: [] }
        )
      end

      test "turbo_frame_tag with an empty splat and block" do
        assert_optimized_snapshot(
          '<%= turbo_frame_tag *ids do %>Content<% end %>',
          { ids: [] }
        )
      end

      test "turbo_frame_tag with a command call id" do
        assert_optimized_snapshot(
          '<%= turbo_frame_tag frame_ids.fetch "post" %>',
          { frame_ids: { "post" => "post_7" } }
        )
      end

      test "turbo_frame_tag with a record and prefix" do
        assert_optimized_snapshot('<%= turbo_frame_tag record, "notes" %>', { record: Post.new(7) })
      end

      test "turbo_frame_tag with a splatted record and prefix" do
        assert_optimized_snapshot('<%= turbo_frame_tag *ids %>', { ids: [Post.new(7), "notes"] })
      end

      test "turbo_frame_tag with a record class" do
        assert_optimized_snapshot('<%= turbo_frame_tag record_class %>', { record_class: Post })
      end

      test "turbo_frame_tag evaluates each id expression once in order" do
        calls = []
        first = lambda do
          calls << :first
          "post"
        end
        rest = lambda do
          calls << :rest
          [7]
        end
        last = lambda do
          calls << :last
          "notes"
        end
        engine = Herb::Engine.new(
          '<%= turbo_frame_tag first.call, *rest.call, last.call %>',
          escape: false,
          visitors: [Herb::Engine::OptimizeVisitor.new]
        )

        result = action_view_eval(engine.src, { first: first, rest: rest, last: last })

        assert_equal action_view_context.turbo_frame_tag("post", 7, "notes"), result
        assert_equal [:first, :rest, :last], calls
      end

    end
  end
end
