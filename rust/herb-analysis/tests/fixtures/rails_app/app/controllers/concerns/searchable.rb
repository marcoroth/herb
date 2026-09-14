# frozen_string_literal: true

module Searchable
  extend ActiveSupport::Concern

  included do
    helper_method :search_query
    helper_method :cookies if defined?(helper_method)
  end

  # dynamic form carries no symbol and cannot be resolved statically
  def self.expose(type)
    helper_method(type) if respond_to?(:helper_method)
  end
end
