# frozen_string_literal: true

require "erbx/liberbx"

require "erbx/liberbx/ast_node"
require "erbx/liberbx/buffer"
require "erbx/liberbx/array"
require "erbx/liberbx/token"

require "erbx/lex_result"
require "erbx/parse_result"

module ERBX
  VERSION = LibERBX.erbx_version.read_string

  def self.parse(source)
    ParseResult.new(
      LibERBX.erbx_parse(source)
    )
  end

  def self.lex(source)
    LexResult.new(
      LibERBX.erbx_lex(source)
    )
  end

  def self.lex_to_json(source)
    LibERBX::Buffer.with do |output|
      LibERBX.erbx_lex_json_to_buffer(source, output.pointer)

      JSON.parse(output.read.force_encoding("utf-8"))
    end
  end

  def self.extract_ruby(source)
    LibERBX::Buffer.with do |output|
      LibERBX.erbx_extract_ruby_to_buffer(source, output.pointer)

      output.read
    end
  end

  def self.extract_html(source)
    LibERBX::Buffer.with do |output|
      LibERBX.erbx_extract_html_to_buffer(source, output.pointer)

      output.read
    end
  end
end
