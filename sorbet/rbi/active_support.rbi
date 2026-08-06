# typed: true

module ActiveSupport
  module Notifications
    def self.subscribed(callback, *args, &block); end
  end
end
