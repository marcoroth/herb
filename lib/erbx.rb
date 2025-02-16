# frozen_string_literal: true

require "erbx/liberbx"
require "erbx/liberbx/buffer"
require "erbx/liberbx/array"
require "erbx/liberbx/token"

require "erbx/lex_result"

module ERBX
  VERSION = LibERBX.erbx_version.read_string

  def self.lex(source)
    LexResult.new(
      LibERBX.erbx_lex(source)
    )
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
