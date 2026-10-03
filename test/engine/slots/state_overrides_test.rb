# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../../lib/herb/engine/slots/state_overrides"

module Engine
  module Slots
    class StateOverridesTest < Minitest::Spec
      Overrides = Herb::Engine::Slots::StateOverrides
      Bindings = Herb::Engine::Slots::Bindings

      test "resolve digs the template's own overrides and rejects every other shape" do
        raw = { "app/views/a.html.erb" => { "open" => true } }

        assert_equal({ "open" => true }, Overrides.resolve(raw, "app/views/a.html.erb"))
        assert_nil Overrides.resolve(raw, "app/views/b.html.erb")
        assert_nil Overrides.resolve(nil, "app/views/a.html.erb")
        assert_nil Overrides.resolve("junk", "app/views/a.html.erb")
        assert_nil Overrides.resolve({ "app/views/a.html.erb" => "junk" }, "app/views/a.html.erb")
      end

      test "fetch yields the default when there is nothing to say" do
        assert_equal :fallback, Overrides.fetch(nil, "open", :boolean) { :fallback }
        assert_equal :fallback, Overrides.fetch({}, "open", :boolean) { :fallback }
      end

      test "booleans accept booleans and their strings" do
        assert_equal true, Overrides.fetch({ "open" => true }, "open", :boolean) { :fallback }
        assert_equal true, Overrides.fetch({ "open" => "true" }, "open", :boolean) { :fallback }
        assert_equal false, Overrides.fetch({ "open" => "false" }, "open", :boolean) { :fallback }
        assert_equal :fallback, Overrides.fetch({ "open" => "yes" }, "open", :boolean) { :fallback }
        assert_equal :fallback, Overrides.fetch({ "open" => 1 }, "open", :boolean) { :fallback }
      end

      test "integers accept integers and integer strings" do
        assert_equal 7, Overrides.fetch({ "n" => 7 }, "n", :integer) { :fallback }
        assert_equal(-3, Overrides.fetch({ "n" => "-3" }, "n", :integer) { :fallback })
        assert_equal :fallback, Overrides.fetch({ "n" => 3.9 }, "n", :integer) { :fallback }
        assert_equal :fallback, Overrides.fetch({ "n" => "3.9" }, "n", :integer) { :fallback }
      end

      test "strings and symbols stringify scalars and refuse nil" do
        assert_equal "a", Overrides.fetch({ "q" => "a" }, "q", :string) { :fallback }
        assert_equal "7", Overrides.fetch({ "q" => 7 }, "q", :string) { :fallback }
        assert_equal :a, Overrides.fetch({ "s" => "a" }, "s", :symbol) { :fallback }
        assert_equal :fallback, Overrides.fetch({ "q" => nil }, "q", :string) { :fallback }
      end

      test "structured values never pass through" do
        assert_equal :fallback, Overrides.fetch({ "q" => ["a"] }, "q", :seeded) { :fallback }
        assert_equal :fallback, Overrides.fetch({ "q" => { "a" => 1 } }, "q", :seeded) { :fallback }
      end

      test "seeded and nil kinds carry the seeds envelope through" do
        assert_nil Overrides.fetch({ "q" => nil }, "q", :seeded) { :fallback }
        assert_equal 7, Overrides.fetch({ "q" => 7 }, "q", :seeded) { :fallback }
        assert_equal "a", Overrides.fetch({ "q" => "a" }, "q", :nil) { :fallback }
      end

      test "a render frame layers seeds under the client's values and bindings over them" do
        raw = { "app/views/a.html.erb" => { "open" => "client", "page" => "client" } }

        Bindings.with("app/views/a.html.erb", bound: { "open" => "bound" }, seeded: { "page" => "seed", "tab" => "seed" }) do
          assert_equal({ "page" => "client", "tab" => "seed", "open" => "bound" }, Overrides.resolve(raw, "app/views/a.html.erb"))
          assert_nil Overrides.resolve(raw, "app/views/b.html.erb")
        end

        assert_equal({ "open" => "client", "page" => "client" }, Overrides.resolve(raw, "app/views/a.html.erb"))
      end

      test "a frame resolves on its own when the client sent nothing" do
        Bindings.with("app/views/a.html.erb", seeded: { "open" => true }) do
          assert_equal({ "open" => true }, Overrides.resolve(nil, "app/views/a.html.erb"))
          assert_equal({ "open" => true }, Overrides.resolve("junk", "app/views/a.html.erb"))
        end

        assert_nil Overrides.resolve(nil, "app/views/a.html.erb")
      end

      test "nested frames answer the nearest one naming the template" do
        Bindings.with("app/views/a.html.erb", bound: { "open" => 1 }) do
          Bindings.with("app/views/b.html.erb", bound: { "open" => 2 }) do
            assert_equal({ "open" => 1 }, Overrides.resolve(nil, "app/views/a.html.erb"))
            assert_equal({ "open" => 2 }, Overrides.resolve(nil, "app/views/b.html.erb"))

            Bindings.with("app/views/a.html.erb", bound: { "open" => 3 }) do
              assert_equal({ "open" => 3 }, Overrides.resolve(nil, "app/views/a.html.erb"))
            end
          end
        end
      end

      test "a frame pops when its block raises" do
        assert_raises(RuntimeError) do
          Bindings.with("app/views/a.html.erb", bound: { "open" => true }) { raise "boom" }
        end

        assert_nil Bindings.current("app/views/a.html.erb")
      end

      test "an uncoercible seed raises before the partial renders" do
        error = assert_raises(Bindings::UncoercibleSeedError) do
          Bindings.with("app/views/a.html.erb", seeded: { "albums" => [1, 2] }) { flunk "the block must not run" }
        end

        assert_equal "`albums` on `app/views/a.html.erb` was seeded with Array, and a state holds a scalar. Pass the value as a local instead.", error.message
        assert_nil Bindings.current("app/views/a.html.erb")
      end
    end
  end
end
