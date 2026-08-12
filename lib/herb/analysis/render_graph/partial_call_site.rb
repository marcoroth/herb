# frozen_string_literal: true

require_relative "call_site_location"

module Herb
  module Analysis
    class RenderGraph
      PartialCallSite = Data.define(:caller, :locals, :ancestors, :ancestor_attributes, :via, :location)

      class PartialCallSite
        #: (Hash[String, untyped]) -> PartialCallSite
        def self.from(data)
          new(
            caller: data["caller"],
            locals: data["locals"] || [],
            ancestors: data["ancestors"] || [],
            ancestor_attributes: data["ancestorAttributes"],
            via: data["via"],
            location: CallSiteLocation.from(data["location"])
          )
        end

        #: () -> Hash[String, untyped]
        def to_h
          hash = {
            "caller" => caller,
            "locals" => locals,
            "ancestors" => ancestors
          }

          hash["ancestorAttributes"] = ancestor_attributes if ancestor_attributes
          hash["via"] = via if via
          hash["location"] = location.to_h if location

          hash
        end
      end
    end
  end
end
