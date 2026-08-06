# typed: true

module ActiveSupport
  module Notifications
    def self.subscribed(callback, *args, &block); end
    def self.subscribe(*args, &block); end
    def self.unsubscribe(subscriber); end
  end
end
