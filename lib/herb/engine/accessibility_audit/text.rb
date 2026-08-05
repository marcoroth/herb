# frozen_string_literal: true
# typed: false

module Herb
  class Engine
    module AccessibilityAudit
      module Text
        NAMING_ATTRIBUTE = /\s(?:alt|aria-label|title)=(?:"([^"]*)"|'([^']*)')/
        TAG = /<[^>]*>/
        NON_BREAKING_SPACE = /&nbsp;|&#160;|&#xa0;/i

        class << self
          #: (String?) -> bool
          def blank?(value)
            value.nil? || value.to_s.strip.empty?
          end

          #: (String) -> String
          def visible(html)
            markup = html.to_s

            names = markup.scan(NAMING_ATTRIBUTE).flatten.compact

            text = markup.gsub(TAG, " ")
            text = "#{text} #{names.join(" ")}"

            text.gsub(NON_BREAKING_SPACE, " ").gsub(/\s+/, " ").strip
          end
        end
      end
    end
  end
end
