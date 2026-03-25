# frozen_string_literal: true

require_relative "benchmark_helper"

Profile = Data.define(:id, :name) do
  def to_s = "/profiles/#{id}"
  def model_name = "Profile"
end

module Bench
  class ActionViewBenchmarkTest < Minitest::Spec
    include BenchmarkHelper

    after { puts "─" * 80 }

    RESULTS = []

    NO_HELPERS_FIXTURE = File.expand_path("fixtures/benchmark_no_helpers_template.html.erb", __dir__)
    SIMPLE_FIXTURE = File.expand_path("fixtures/benchmark_simple_template.html.erb", __dir__)
    STATIC_FIXTURE = File.expand_path("fixtures/benchmark_template.html.erb", __dir__)
    DYNAMIC_FIXTURE = File.expand_path("fixtures/benchmark_dynamic_template.html.erb", __dir__)
    DYNAMIC_FIXTURE_HELPERS_ONLY = File.expand_path("fixtures/benchmark_dynamic_only_helpers_template.html.erb", __dir__)
    LINK_TO_BLOCK_FIXTURE = File.expand_path("fixtures/benchmark_link_to_block_template.html.erb", __dir__)
    HELPERS_CASE_FIXTURE = File.expand_path("fixtures/action_view_helpers_case.html.erb", __dir__)
    REALISTIC_FIXTURE = File.expand_path("fixtures/benchmark_realistic_template.html.erb", __dir__)

    test "benchmark 0: no helpers, only interpolation" do
      run_benchmark(
        title: "No helpers, only interpolation",
        subtitle: "Pure HTML with ERB interpolation — no ActionView helpers",
        template: File.read(NO_HELPERS_FIXTURE),
        fixture: NO_HELPERS_FIXTURE,
        results: RESULTS,
        locals: {
          user_name: "Alice", profile_path: "/profiles/1", avatar_url: "http://example.com/avatar.jpg",
          page_title: "Welcome", page_subtitle: "The best platform.", signup_path: "/signup",
          demo_path: "/demo", trial_path: "/trial", user_count: "10,000+", current_year: 2024,
        },
      )

      pass
    end

    test "mostly HTML, one helper" do
      run_benchmark(
        title: "Mostly HTML, one helper",
        subtitle: "4 lines of HTML with a single content_tag call",
        template: File.read(SIMPLE_FIXTURE),
        fixture: SIMPLE_FIXTURE,
        results: RESULTS,
        locals: {
          "@title": "Hello",
          "@message": "World"
        },
      )

      pass
    end

    test "all helpers, all variables" do
      run_benchmark(
        title: "All helpers, all variables",
        subtitle: "Every tag and value is dynamic — worst case for precompilation",
        template: File.read(DYNAMIC_FIXTURE_HELPERS_ONLY),
        fixture: DYNAMIC_FIXTURE_HELPERS_ONLY,
        results: RESULTS,
        locals: {
          container_class: "page",
          nav_class: "navbar", nav_controller: "navigation",
          home_text: "Home", home_url: "/",
          about_text: "About", about_url: "/about",
          user_name: "Alice", profile_url: "/profiles/1",
          link_class: "nav-link", frame_target: "content",
          section_class: "hero", section_id: "hero",
          heading: "Welcome", description: "A demo page.",
          actions_class: "actions",
          cta_text: "Get Started", cta_url: "/start", cta_class: "btn btn-primary",
          secondary_text: "Learn More", secondary_url: "/learn", secondary_class: "btn btn-secondary",
          card_class: "card", card_controller: "card",
          card_index: 1, card_index_2: 2,
          image_url: "http://example.com/1.png", image_alt: "Feature 1", image_class: "card-img",
          image_url_2: "http://example.com/2.png", image_alt_2: "Feature 2",
          card_title: "Fast", card_description: "Lightning fast",
          card_title_2: "Secure", card_description_2: "Built secure",
          card_link_text: "Read more", card_link_class: "card-link",
          card_link_url: "/features/1", card_link_url_2: "/features/2",
          footer_class: "footer",
          copyright: "2024 Example Corp",
          privacy_text: "Privacy", privacy_url: "/privacy",
          terms_text: "Terms", terms_url: "/terms",
          sidebar_url: "/sidebar",
          skeleton_class: "skeleton", skeleton_line_class: "skeleton-line",
        },
      )

      pass
    end

    test "helpers with variables and static HTML" do
      run_benchmark(
        title: "Helpers with variables and static HTML",
        subtitle: "Mix of static HTML structure and helpers with dynamic values",
        template: File.read(DYNAMIC_FIXTURE),
        fixture: DYNAMIC_FIXTURE,
        results: RESULTS,
        locals: {
          nav_class: "navbar",
          root_url: "/",
          about_url: "/about",
          user_name: "Alice",
          profile_url: "/profiles/1",
          avatar_url: "http://example.com/avatar.jpg",
          signup_url: "/signup",
          demo_url: "/demo",
          trial_url: "/trial",
          sidebar_url: "/sidebar",
          page_title: "Welcome",
          page_description: "The best platform.",
          cta_text: "Get Started",
          cta_url: "/start",
          learn_url: "/learn",
          feature_count: 3,
          features: [
            { image: "http://example.com/1.png", alt: "Feature 1", title: "Fast", description: "Lightning fast" },
            { image: "http://example.com/2.png", alt: "Feature 2", title: "Secure", description: "Built secure" },
            { image: "http://example.com/3.png", alt: "Feature 3", title: "Scalable", description: "Grows with you" },
          ],
          cta_class: "cta",
          cta_heading: "Ready to get started?",
          cta_button_text: "Sign Up Free",
          copyright_text: "&copy; 2024 Example Corp",
          privacy_url: "/privacy",
          terms_url: "/terms",
          contact_email: "hello@example.com",
          current_year: 2024,
          testimonial_author_1: "Jane Smith",
          testimonial_author_2: "Bob Johnson",
          starter_price: 9,
          pro_price: 29,
          user_count: "10,000+",
          twitter_url: "https://twitter.com/myapp",
          github_url: "https://github.com/myapp",
          contact_email: "hello@myapp.com",
          current_year: 2024,
        },
      )

      pass
    end

    test "realistic page layout" do
      run_benchmark(
        title: "Realistic page layout",
        subtitle: "Full page with nav, hero, features, pricing, CTA, and footer",
        template: File.read(REALISTIC_FIXTURE),
        fixture: REALISTIC_FIXTURE,
        results: RESULTS,
        locals: {
          page_title: "Welcome to My App",
          page_subtitle: "The best platform for building modern web applications.",
          user_name: "Alice",
          profile_path: "/profiles/1",
          avatar_url: "http://example.com/avatar.jpg",
          signup_path: "/signup",
          demo_path: "/demo",
          trial_path: "/trial",
          sidebar_path: "/sidebar",
          testimonial_author_1: "Jane Smith",
          testimonial_author_2: "Bob Johnson",
          starter_price: 9,
          pro_price: 29,
          user_count: "10,000+",
          twitter_url: "https://twitter.com/myapp",
          github_url: "https://github.com/myapp",
          contact_email: "hello@myapp.com",
          current_year: 2024,
        },
      )

      pass
    end

    test "link_to block with object" do
      run_benchmark(
        title: "link_to block with object",
        subtitle: "link_to with a block, object method call, and mixed HTML",
        template: File.read(LINK_TO_BLOCK_FIXTURE),
        fixture: LINK_TO_BLOCK_FIXTURE,
        results: RESULTS,
        locals: {
          "@profile": Profile.new(id: 1, name: "Alice")
        },
      )

      pass
    end

    test "all helpers, no variables" do
      run_benchmark(
        title: "All helpers, no variables",
        subtitle: "Every value is a literal — best case for precompilation",
        template: File.read(STATIC_FIXTURE),
        fixture: STATIC_FIXTURE,
        results: RESULTS,
      )

      pass
    end

    test "nested helpers with conditionals" do
      run_benchmark(
        title: "Nested helpers with conditionals",
        subtitle: "Nested tag.* calls with postfix if conditions and string interpolation",
        template: File.read(HELPERS_CASE_FIXTURE),
        fixture: HELPERS_CASE_FIXTURE,
        results: RESULTS,
        locals: {
          wrapper_classes: "alert alert-info",
          icon: "info-circle",
          icon_classes: "icon icon-sm",
          title: "Notice",
          title_classes: "alert-title",
          message: "Something happened.",
          message_classes: "alert-message",
        },
      )

      pass
    end

    Minitest.after_run do
      next if RESULTS.empty?

      helper = Object.new.extend(BenchmarkHelper)
      helper.send(:print_summary, RESULTS)
    end
  end
end
