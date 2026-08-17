# frozen_string_literal: true
# typed: ignore

module Herb
  module Rubocop
    Correction = Data.define(:begin_pos, :end_pos, :replacement)
  end
end
