# frozen_string_literal: true

require "herb"
require "herb/engine"
require "herb/engine/validators"
require "herb/engine/report/error_page"
require "herb/engine/report/middleware"

module Demo
  VIEWS = File.expand_path("views", __dir__) #: String
  DIST = File.expand_path("../../dist", __dir__) #: String
  BUNDLE_PATH = "/herb-dev-tools.js" #: String
  DEV_TOOLS = ENV.fetch("HERB_DEV_TOOLS", BUNDLE_PATH) #: String

  ROUTES = {
    "/valid" => "A template that compiles. The panel docks in the corner with what the page reported.",
    "/broken" => "A template that does not. The engine raises and `ErrorPage` answers instead.",
    "/broken.json" => "The same failure asked for as JSON, which is raised on rather than answered.",
    "/boom" => "An error that is not Herb's, which is raised on untouched.",
  }.freeze #: Hash[String, String]

  class App
    #: (untyped) -> untyped
    def call(env)
      case env["PATH_INFO"]
      when BUNDLE_PATH then bundle
      when "/" then index
      when "/valid" then valid
      when "/broken", "/broken.json" then broken
      when "/boom" then raise "This is not a Herb error, so nothing should catch it."
      else [404, { "content-type" => "text/plain" }, ["Not found"]]
      end
    end

    private

    #: () -> untyped
    def bundle
      path = File.join(DIST, "herb-dev-tools.esm.js")

      unless File.exist?(path)
        return [404, { "content-type" => "text/plain" }, ["Run `yarn build` in javascript/packages/dev-tools first."]]
      end

      [200, { "content-type" => "text/javascript; charset=utf-8", "cache-control" => "no-store" }, [File.read(path)]]
    end

    #: () -> untyped
    def index
      items = ROUTES.map { |path, description|
        %(<li><a href="#{path}"><code>#{path}</code></a> #{description}</li>)
      }

      html(<<~HTML)
        <h1>Herb dev tools, served by Rack</h1>
        <p>Each route below exercises one path through the report middlewares.</p>
        <ul>#{items.join}</ul>
      HTML
    end

    #: () -> untyped
    def valid
      Herb::Engine::Report::Session.record(
        Herb::Diagnostic.new(
          template: "demo/rack/views/valid.html.erb",
          message: "This byline was rendered without checking that the author is present.",
          code: "demo-unchecked-author",
          severity: :warning,
          origin: "Acme Scanner",
          location: Herb::Location.from(6, 15, 6, 21)
        )
      )

      html(render("valid.html.erb", author: "Marco Roth"))
    end

    #: () -> untyped
    def broken
      html(render("broken.html.erb"))
    end

    #: (String, **untyped) -> String
    def render(name, **locals)
      path = File.join(VIEWS, name)
      source = File.read(path)

      engine = Herb::Engine.new(source, filename: "demo/rack/views/#{name}", visitors: Herb::Engine::Validators.all)

      Object.new.instance_eval do
        locals.each { |key, value| define_singleton_method(key) { value } }

        eval(engine.src) # rubocop:disable Security/Eval
      end
    end

    #: (String) -> untyped
    def html(body)
      page = <<~HTML
        <!DOCTYPE html>
        <html lang="en"><head><meta charset="utf-8"><title>Herb dev tools demo</title>
        <style>
          body { max-width: 900px; margin: 0 auto; padding: 40px 24px; color: #111827;
                 font: 15px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
          code { background: #f3f4f6; padding: 2px 5px; border-radius: 4px; }
          li { margin-bottom: 8px; }
          .post { padding: 20px; border-radius: 10px; background: #f9fafb; }
        </style>
        </head><body>#{body}
        <p><a href="/">Back to the index</a></p>
        <script type="module">
          import { HerbDevTools } from "#{DEV_TOOLS}"

          HerbDevTools.start({ devServer: false })
        </script>
        </body></html>
      HTML

      [200, { "content-type" => "text/html; charset=utf-8" }, [page]]
    end
  end
end

use Herb::Engine::Report::ErrorPage, dev_tools: Demo::DEV_TOOLS
use Herb::Engine::Report::Middleware

run Demo::App.new
