# frozen_string_literal: true

require_relative "test_helper"

class HerbTest < Minitest::Spec
  test "version" do
    assert_equal "herb gem v0.8.2, libprism v1.6.0, libherb v0.8.2 (Ruby C native extension)", Herb.version
  end
end
