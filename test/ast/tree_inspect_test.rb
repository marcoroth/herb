# frozen_string_literal: true

require_relative "../test_helper"

module AST
  class TreeInspectTest < Minitest::Spec
    include SnapshotUtils

    test "deeply nested document" do
      assert_parsed_snapshot(<<~ERB)
        <div>
          <div>
            <div>
              <div>
                <div>
                  <div>
                    <div>
                      <div>
                        <div>
                          <div>
                            <div>
                              <div>
                                <p>Very deep nesting</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ERB
    end

    test "deeply nested with attributes" do
      assert_parsed_snapshot(<<~ERB)
        <div>
          <div>
            <div>
              <div>
                <div>
                  <div>
                    <div>
                      <div>
                        <div class="nested" id="test" data-controller="example">
                          <p>Deep with attributes</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ERB
    end
  end
end
