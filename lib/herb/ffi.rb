# frozen_string_literal: true
# typed: ignore

require "ffi"

module Herb
  # Herb::Backend for Rubies that can't load the C extension, like JRuby.
  module FFI
    extend ::FFI::Library

    class StaleLibraryError < LoadError; end

    LIBRARY_NAME = "libherb_ffi.#{::FFI::Platform::LIBSUFFIX}".freeze
    LIBRARY_PATH = ENV.fetch("HERB_FFI_LIBRARY") { File.expand_path("../../build/#{LIBRARY_NAME}", __dir__) }.freeze

    ffi_lib LIBRARY_PATH

    class HbString < ::FFI::Struct #[::FFI::Pointer, untyped]
      layout :data, :pointer, :length, :uint32
    end

    # Keeps the opener strings referenced, so they aren't collected while libherb uses them.
    module ErbOpenersField
      def erb_openers=(openers)
        @erb_openers = Options.hb_strings(openers)
        self[:erb_openers] = @erb_openers.first
        self[:erb_opener_count] = openers.size
      end
    end

    class ExtractRubyOptions < ::FFI::Struct #[::FFI::Pointer, untyped]
      include ErbOpenersField

      layout(
        :semicolons, :bool,
        :comments, :bool,
        :preserve_positions, :bool,
        :custom_tags, :bool,
        :erb_openers, :pointer,
        :erb_opener_count, :size_t
      )
    end

    attach_function :herb_ffi_parse, [:pointer, :pointer, :pointer, :pointer], :bool, blocking: true
    attach_function :herb_ffi_lex, [:pointer, :pointer, :pointer, :pointer], :bool, blocking: true
    attach_function :herb_ffi_diff, [:pointer, :pointer, :bool, :pointer, :pointer], :bool, blocking: true
    attach_function :herb_ffi_ruby_syntax_errors, [:pointer, :size_t, :pointer, :pointer], :bool
    attach_function :herb_ffi_extract_ruby, [:pointer, :pointer], :pointer
    attach_function :herb_ffi_extract_html, [:pointer], :pointer
    attach_function :herb_ffi_free, [:pointer], :void
    attach_function :herb_ffi_parser_options_size, [], :size_t
    attach_function :herb_ffi_extract_ruby_options_size, [], :size_t
    attach_function :herb_ffi_parser_options_init, [:pointer], :void
    attach_function :herb_ffi_extract_ruby_options_init, [:pointer], :void
    attach_function :herb_ffi_default_erb_openings, [:pointer], :pointer
    attach_function :herb_ffi_token_type_count, [], :uint32
    attach_function :herb_ffi_token_type_name, [:uint32], HbString.by_value
    attach_function :herb_version, [], :string
    attach_function :herb_prism_version, [], :string
    attach_function :herb_ffi_config_digest, [], :string
    attach_function :herb_ffi_git_sha, [], :string

    TOKEN_TYPES = Array.new(herb_ffi_token_type_count) do |type|
      name = herb_ffi_token_type_name(type)
      -name[:data].read_bytes(name[:length]).force_encoding(Encoding::UTF_8)
    end.freeze

    module_function

    def check_string(source)
      raise TypeError, "wrong argument type #{source.class} (expected String)" unless source.is_a?(String)

      source
    end

    def read_and_free(pointer)
      raise NoMemoryError, "libherb failed to allocate a buffer" if pointer.null?

      pointer.read_string.force_encoding(Encoding::UTF_8)
    ensure
      herb_ffi_free(pointer) unless pointer.nil? || pointer.null?
    end

    def read_buffer(nil_on_failure: false)
      ::FFI::MemoryPointer.new(:pointer) do |out|
        ::FFI::MemoryPointer.new(:size_t) do |out_length|
          unless yield(out, out_length)
            return nil if nil_on_failure

            raise NoMemoryError, "libherb failed to allocate a buffer"
          end

          data = out.read_pointer

          begin
            return data.read_bytes(out_length.read(:size_t))
          ensure
            herb_ffi_free(data)
          end
        end
      end
    end

    def call(function, source, options)
      check_string(source) unless source.nil?
      options ||= {}

      raise NotImplementedError, "arena_stats is not available in the FFI backend" if Options.fetch(options, :arena_stats)

      parser_options = parser_options_for(function, options)
      error_count = ::FFI::MemoryPointer.new(:uint32)
      parser_options[:error_count] = error_count

      source_pointer = string_pointer(source)
      data = read_buffer { |out, out_length| send(function, source_pointer, parser_options, out, out_length) }

      [data, parser_options, error_count.read_uint32]
    end

    def parser_options_for(function, options)
      parser_options = ParserOptionsStruct.new
      herb_ffi_parser_options_init(parser_options)

      if function == :herb_ffi_lex
        # Like Herb_lex in the C extension, lex only reads erb_openers.
        openers = Options.fetch(options, :erb_openers)
        parser_options.erb_openers = openers unless openers.nil?
      else
        parser_options.apply(options)
      end

      parser_options
    end

    def string_pointer(source)
      source && ::FFI::MemoryPointer.from_string(source)
    end

    #: (String) -> Array[[Symbol, String, Integer]]
    def ruby_syntax_errors(source)
      bytes = check_string(source).b
      source_pointer = ::FFI::MemoryPointer.from_string(bytes)

      data = read_buffer do |out, out_length|
        herb_ffi_ruby_syntax_errors(source_pointer, bytes.bytesize, out, out_length)
      end

      Deserializer.new(data).ruby_syntax_errors
    end

    module Options
      # Same as HERB_MAX_ERB_OPENERS in ext/herb/extension.c
      MAX_ERB_OPENERS = 64

      module_function

      def fetch(options, name)
        value = options[name.to_s]
        value.nil? ? options[name] : value
      end

      def given?(options, name)
        options.key?(name.to_s) || options.key?(name)
      end

      # Same as NUM2UINT, including wrapping negative values down to -2**31.
      def uint(value)
        integer =
          if value.is_a?(Integer) || value.is_a?(Float) then value.to_i
          elsif !value.is_a?(String) && value.respond_to?(:to_int) then value.to_int
          else raise TypeError, "no implicit conversion of #{value.class} into Integer"
          end

        raise RangeError, "integer #{integer} too small to convert to 'unsigned int'" if integer < -0x8000_0000
        raise RangeError, "integer #{integer} too big to convert to 'unsigned int'" if integer > 0xFFFF_FFFF

        integer & 0xFFFF_FFFF
      end

      def milliseconds(value)
        raise TypeError, "no implicit conversion to float from #{value.class.name.downcase}" unless value.is_a?(Numeric)

        (value.to_f * 1000).to_i.clamp(0, 0xFFFF_FFFF)
      end

      def hb_strings(openers)
        check_openers(openers)

        array = ::FFI::MemoryPointer.new(HbString, [openers.size, 1].max)

        strings = openers.each_with_index.map do |opener, index|
          data = ::FFI::MemoryPointer.from_string(opener)
          string = HbString.new(array[index])
          string[:data] = data
          string[:length] = opener.bytesize
          data
        end

        [array, *strings]
      end

      def check_openers(openers)
        raise TypeError, "wrong argument type #{openers.class} (expected Array)" unless openers.is_a?(Array)
        raise ArgumentError, "erb_openers accepts at most #{MAX_ERB_OPENERS} entries" if openers.size > MAX_ERB_OPENERS

        openers.each do |opener|
          raise TypeError, "wrong argument type #{opener.class} (expected String)" unless opener.is_a?(String)
          raise ArgumentError, "erb_openers entries must not be empty" if opener.empty?
        end
      end

      def read_hb_strings(pointer, count)
        Array.new(count) do |index|
          string = HbString.new(pointer + (index * HbString.size))
          string[:data].read_bytes(string[:length]).force_encoding(Encoding::UTF_8)
        end
      end
    end

    module Backend
      def parse(source, **options)
        data, parser_options, error_count = FFI.call(:herb_ffi_parse, source, options)

        Deserializer.new(data).parse_result(source, ParserOptions.new(**parser_options.to_options), error_count)
      end

      def lex(source, **options)
        data, = FFI.call(:herb_ffi_lex, source, options)

        Deserializer.new(data).lex_result(source)
      end

      def diff(old_source, new_source, **options)
        FFI.check_string(old_source) unless old_source.nil?
        FFI.check_string(new_source) unless new_source.nil?

        track_whitespace_changes = Options.fetch(options, :track_whitespace_changes) ? true : false

        old_pointer = FFI.string_pointer(old_source)
        new_pointer = FFI.string_pointer(new_source)

        data = FFI.read_buffer(nil_on_failure: true) do |out, out_length|
          FFI.herb_ffi_diff(old_pointer, new_pointer, track_whitespace_changes, out, out_length)
        end

        data && Deserializer.new(data).diff_result
      end

      def extract_ruby(source, **options)
        FFI.check_string(source)

        extract_options = ExtractRubyOptions.new
        FFI.herb_ffi_extract_ruby_options_init(extract_options)

        [:semicolons, :comments, :preserve_positions, :custom_tags].each do |name|
          value = Options.fetch(options, name)
          extract_options[name] = value ? true : false unless value.nil?
        end

        openers = Options.fetch(options, :erb_openers)
        extract_options.erb_openers = openers unless openers.nil?

        FFI.read_and_free(FFI.herb_ffi_extract_ruby(FFI.string_pointer(source), extract_options))
      end

      def extract_html(source)
        FFI.read_and_free(FFI.herb_ffi_extract_html(FFI.string_pointer(FFI.check_string(source))))
      end

      def default_erb_openings
        count = ::FFI::MemoryPointer.new(:size_t)
        openings = FFI.herb_ffi_default_erb_openings(count)

        Options.read_hb_strings(openings, count.read(:size_t)).map(&:freeze)
      end

      def version
        sha = FFI.herb_ffi_git_sha
        return "herb gem v#{Herb::VERSION}, libprism v#{FFI.herb_prism_version}, libherb v#{FFI.herb_version} (Ruby FFI backend)" if sha.nil?

        herb = sha.empty? ? "v#{Herb::VERSION}" : sha
        libherb = sha.empty? ? "v#{FFI.herb_version}" : sha

        "herb gem #{herb}, libprism v#{FFI.herb_prism_version}, libherb #{libherb} (Ruby FFI backend, built from source)"
      end

      def arena_stats(**)
        raise NotImplementedError, "Herb::Backend.arena_stats is not available in the FFI backend"
      end

      def leak_check(_source)
        raise NotImplementedError, "Herb::Backend.leak_check is not available in the FFI backend"
      end
    end
  end
end

require_relative "ffi/deserialize"

if Herb::FFI::ParserOptionsStruct.size != Herb::FFI.herb_ffi_parser_options_size ||
   Herb::FFI::ExtractRubyOptions.size != Herb::FFI.herb_ffi_extract_ruby_options_size ||
   Herb::FFI.herb_ffi_config_digest != Herb::FFI::Deserializer::CONFIG_DIGEST
  raise Herb::FFI::StaleLibraryError, "#{Herb::FFI::LIBRARY_PATH} was built from a different Herb. " \
                                      "Reinstall the herb gem to rebuild it, or run ffi/build.sh in a source checkout."
end

Herb::Backend.singleton_class.prepend(Herb::FFI::Backend)
