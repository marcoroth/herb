# frozen_string_literal: true
# typed: true

require "digest"

module Herb
  # Identifies content by what it is instead of by where it lives or when it was touched.
  #
  #     Herb::Fingerprint.file(asset)      #=> "9f2a1c4e…"
  #     Herb::Fingerprint.template(source) #=> "d242d277…"
  #
  module Fingerprint
    BOM = "\xEF\xBB\xBF".b #: String
    SHORT_LENGTH = 8 #: Integer

    #: (String?) -> String?
    def self.of(content)
      return nil unless content

      ::Digest::SHA256.hexdigest(content.to_s.b)
    end

    #: ((String | Pathname)?) -> String?
    def self.file(path)
      return nil unless path

      ::Digest::SHA256.file(path.to_s).hexdigest
    rescue SystemCallError, IOError
      nil
    end

    #: (String?) -> String?
    def self.template(source)
      return nil unless source

      of(strip_bom(source.to_s.b))
    end

    #: ((String | Pathname)?) -> String?
    def self.template_file(path)
      return nil unless path

      stat = File.stat(path.to_s)
      key = [path.to_s, stat.mtime.to_i, stat.size]
      cached = cache[key]

      return cached if cached

      digest = template(File.binread(path.to_s))

      return nil unless digest

      cache[key] = digest
    rescue SystemCallError, IOError
      nil
    end

    #: (String?) -> String?
    def self.short(digest)
      digest&.slice(0, SHORT_LENGTH)
    end

    #: () -> void
    def self.clear_cache
      cache.clear

      nil
    end

    #: () -> Hash[Array[untyped], String]
    def self.cache
      @cache ||= {} #: Hash[Array[untyped], String]
    end

    #: (String) -> String
    def self.strip_bom(bytes)
      return bytes unless bytes.start_with?(BOM)

      bytes.byteslice(BOM.bytesize, bytes.bytesize - BOM.bytesize) || ""
    end
  end
end
