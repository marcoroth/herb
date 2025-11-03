# frozen_string_literal: true
# typed: true

module Herb
  module Colors
    def self.enabled?
      return false if ENV["NO_COLOR"]
      return false if defined?(IRB)
      return false if defined?(Minitest)

      $stdout.tty?
    end

    refine String do
      def white
        return self unless Herb::Colors.enabled?

        "\e[37m#{self}\e[0m"
      end

      def yellow
        return self unless Herb::Colors.enabled?

        "\e[33m#{self}\e[0m"
      end

      def green
        return self unless Herb::Colors.enabled?

        "\e[32m#{self}\e[0m"
      end

      def red
        return self unless Herb::Colors.enabled?

        "\e[31m#{self}\e[0m"
      end

      def magenta
        return self unless Herb::Colors.enabled?

        "\e[35m#{self}\e[0m"
      end

      def cyan
        return self unless Herb::Colors.enabled?

        "\e[36m#{self}\e[0m"
      end

      def bright_magenta
        return self unless Herb::Colors.enabled?

        "\e[95m#{self}\e[0m"
      end

      def dimmed
        return self unless Herb::Colors.enabled?

        "\e[2m#{self}\e[0m"
      end

      def bold
        return self unless Herb::Colors.enabled?

        "\e[1m#{self}\e[0m"
      end
    end
  end
end
