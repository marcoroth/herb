# frozen_string_literal: true

require_relative "test_helper"

class HerbTest < Minitest::Spec
  test "version" do
    assert_equal "herb gem v0.10.3, libprism v1.9.0, libherb v0.10.3 (Ruby C native extension)", Herb.version
  end
end
