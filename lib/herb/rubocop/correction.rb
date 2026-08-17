# frozen_string_literal: true

module Herb
  module Rubocop
    Correction = Data.define(:begin_pos, :end_pos, :replacement)
  end
end
