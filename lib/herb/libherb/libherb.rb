# frozen_string_literal: true
# typed: ignore
# rbs_inline: disabled

require "herb/libherb/ast_node"
require "herb/libherb/buffer"
require "herb/libherb/array"
require "herb/libherb/token"

require "herb/libherb/lex_result"
require "herb/libherb/parse_result"

module Herb
  VERSION = LibHerb.herb_version.read_string

  def self.parse(source)
    ParseResult.new(
      LibHerb.herb_parse(source)
    )
  end

  def self.lex(source)
    LexResult.new(
      LibHerb.herb_lex(source)
    )
  end

  def self.lex_to_json(source)
    LibHerb::Buffer.with do |output|
      LibHerb.herb_lex_json_to_buffer(source, output.pointer)

      JSON.parse(output.read.force_encoding("utf-8"))
    end
  end

  def self.extract_ruby(source)
    LibHerb::Buffer.with do |output|
      LibHerb.herb_extract_ruby_to_buffer(source, output.pointer)

      output.read
    end
  end

  def self.extract_html(source)
    LibHerb::Buffer.with do |output|
      LibHerb.herb_extract_html_to_buffer(source, output.pointer)

      output.read
    end
  end
end
