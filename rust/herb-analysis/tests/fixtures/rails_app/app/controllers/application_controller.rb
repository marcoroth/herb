# frozen_string_literal: true

class ApplicationController < ActionController::Base
  include Searchable

  protect_from_forgery with: :exception

  helper_method :current_user, :signed_in?
  helper_method :page_title

  # not exposed to views
  def internal_thing; end

  private

  attr_reader :current_user
end
