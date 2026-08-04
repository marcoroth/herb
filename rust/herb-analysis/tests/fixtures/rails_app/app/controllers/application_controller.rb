class ApplicationController < ActionController::Base
  include Searchable

  helper_method :current_user, :signed_in?
  helper_method :page_title

  # not exposed to views
  def internal_thing
  end

  private

  def current_user
    @current_user
  end
end
