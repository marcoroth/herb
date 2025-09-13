# frozen_string_literal: true

require_relative "test_helper"

class HerbTest < Minitest::Spec
  test "version" do
    assert_equal "herb gem v0.7.0, libprism v1.5.1, libherb v0.7.0 (Ruby C native extension)", Herb.version
  end
end
