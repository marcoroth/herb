# frozen_string_literal: true

$LOAD_PATH.unshift File.expand_path("../../lib", __dir__)

require "erbx"

puts ERBX.lex("<html><html>")
