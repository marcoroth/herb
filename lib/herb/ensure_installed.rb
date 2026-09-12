# frozen_string_literal: true

module Herb
  #: (*String gems) -> void
  def self.ensure_installed(*gems)
    missing = gems.reject do |name|
      require name
      true
    rescue LoadError
      false
    end

    return if missing.empty?

    refuse_bundle_replacement(missing) if defined?(Bundler) && Bundler.instance_variable_get(:@definition) && !@inline_gemfile

    @inline_gemfile = true

    require "bundler/inline"

    verbose = $VERBOSE
    $VERBOSE = nil

    begin
      gemfile(true, quiet: true) do # steep:ignore
        source "https://rubygems.org" # steep:ignore
        missing.each { |name| gem name }
      end
    ensure
      $VERBOSE = verbose
    end
  end

  #: (Array[String]) -> void
  def self.refuse_bundle_replacement(missing)
    names = missing.map { |name| "`#{name}`" }.join(", ")
    additions = missing.map { |name| "`gem \"#{name}\"`" }.join(", ")

    raise LoadError, "Herb needs the #{names} #{missing.one? ? "gem" : "gems"}. Add #{additions} to the Gemfile."
  end

  private_class_method :refuse_bundle_replacement
end
