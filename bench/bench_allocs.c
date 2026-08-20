#include "../src/include/herb.h"
#include "../src/include/lib/hb_allocator.h"
#include "../src/include/parser/parser.h"
#include "../src/include/util/io.h"

#include <stdbool.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static const char* SMALL_INPUT = "<div class=\"hello\"><%= foo %></div>";

static const char* MEDIUM_INPUT =
  "<!DOCTYPE html>\n"
  "<html lang=\"en\">\n"
  "<head>\n"
  "  <meta charset=\"UTF-8\">\n"
  "  <title><%= @title %></title>\n"
  "</head>\n"
  "<body>\n"
  "  <div id=\"app\" class=\"container\">\n"
  "    <h1><%= @heading %></h1>\n"
  "    <% @items.each do |item| %>\n"
  "      <div class=\"item\" data-id=\"<%= item.id %>\">\n"
  "        <span class=\"name\"><%= item.name %></span>\n"
  "        <p><%= item.description %></p>\n"
  "        <% if item.active? %>\n"
  "          <span class=\"badge\">Active</span>\n"
  "        <% else %>\n"
  "          <span class=\"badge inactive\">Inactive</span>\n"
  "        <% end %>\n"
  "      </div>\n"
  "    <% end %>\n"
  "  </div>\n"
  "  <%# This is a comment %>\n"
  "  <%= render partial: 'footer', locals: { year: 2024 } %>\n"
  "</body>\n"
  "</html>\n";

static const char* LARGE_INPUT =
  "<!DOCTYPE html>\n"
  "<html lang=\"<%= I18n.locale %>\">\n"
  "<head>\n"
  "  <meta charset=\"UTF-8\">\n"
  "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n"
  "  <title><%= @page_title || 'Default' %></title>\n"
  "  <%= csrf_meta_tags %>\n"
  "  <%= csp_meta_tag %>\n"
  "  <%= stylesheet_link_tag 'application' %>\n"
  "  <%= javascript_include_tag 'application' %>\n"
  "</head>\n"
  "<body class=\"<%= body_class %>\">\n"
  "  <nav class=\"navbar\">\n"
  "    <div class=\"nav-brand\">\n"
  "      <%= link_to root_path do %>\n"
  "        <img src=\"<%= asset_path('logo.png') %>\" alt=\"Logo\">\n"
  "      <% end %>\n"
  "    </div>\n"
  "    <ul class=\"nav-links\">\n"
  "      <% @nav_items.each do |nav| %>\n"
  "        <li class=\"<%= 'active' if current_page?(nav.path) %>\">\n"
  "          <%= link_to nav.label, nav.path, class: 'nav-link' %>\n"
  "        </li>\n"
  "      <% end %>\n"
  "    </ul>\n"
  "    <div class=\"nav-user\">\n"
  "      <% if current_user %>\n"
  "        <span><%= current_user.name %></span>\n"
  "        <%= link_to 'Logout', logout_path, method: :delete %>\n"
  "      <% else %>\n"
  "        <%= link_to 'Login', login_path %>\n"
  "      <% end %>\n"
  "    </div>\n"
  "  </nav>\n"
  "  <main id=\"content\">\n"
  "    <% if flash[:notice] %>\n"
  "      <div class=\"alert alert-info\"><%= flash[:notice] %></div>\n"
  "    <% end %>\n"
  "    <% if flash[:alert] %>\n"
  "      <div class=\"alert alert-danger\"><%= flash[:alert] %></div>\n"
  "    <% end %>\n"
  "    <div class=\"container\">\n"
  "      <h1><%= @heading %></h1>\n"
  "      <table class=\"table\">\n"
  "        <thead>\n"
  "          <tr>\n"
  "            <th>Name</th>\n"
  "            <th>Email</th>\n"
  "            <th>Role</th>\n"
  "            <th>Status</th>\n"
  "            <th>Actions</th>\n"
  "          </tr>\n"
  "        </thead>\n"
  "        <tbody>\n"
  "          <% @users.each do |user| %>\n"
  "            <tr id=\"user-<%= user.id %>\" class=\"<%= cycle('odd', 'even') %>\">\n"
  "              <td><%= user.name %></td>\n"
  "              <td><%= mail_to user.email %></td>\n"
  "              <td><%= user.role.titleize %></td>\n"
  "              <td>\n"
  "                <% if user.active? %>\n"
  "                  <span class=\"badge badge-success\">Active</span>\n"
  "                <% elsif user.suspended? %>\n"
  "                  <span class=\"badge badge-warning\">Suspended</span>\n"
  "                <% else %>\n"
  "                  <span class=\"badge badge-danger\">Inactive</span>\n"
  "                <% end %>\n"
  "              </td>\n"
  "              <td>\n"
  "                <%= link_to 'View', user_path(user), class: 'btn btn-sm' %>\n"
  "                <%= link_to 'Edit', edit_user_path(user), class: 'btn btn-sm' %>\n"
  "                <% if can?(:destroy, user) %>\n"
  "                  <%= link_to 'Delete', user_path(user), method: :delete, class: 'btn btn-sm btn-danger', data: { confirm: 'Are you sure?' } %>\n"
  "                <% end %>\n"
  "              </td>\n"
  "            </tr>\n"
  "          <% end %>\n"
  "        </tbody>\n"
  "      </table>\n"
  "      <%= render 'shared/pagination', collection: @users %>\n"
  "    </div>\n"
  "  </main>\n"
  "  <footer class=\"footer\">\n"
  "    <p>&copy; <%= Time.current.year %> Company</p>\n"
  "  </footer>\n"
  "</body>\n"
  "</html>\n";

typedef struct {
  const char* name;
  const char* source;
} test_case_T;

static bool no_untracked_deallocations(const char* phase, const char* name, hb_allocator_tracking_stats_T* stats) {
  if (stats->untracked_deallocation_count == 0) { return true; }

  printf(
    "  %-5s %-9s  FAILED: %zu deallocation(s) of untracked pointers\n",
    phase,
    name,
    stats->untracked_deallocation_count
  );

  return false;
}

static bool run_lex_benchmark(const char* name, const char* source) {
  hb_allocator_T allocator = hb_allocator_with_tracking();

  hb_array_T* tokens = herb_lex(source, &allocator);

  hb_allocator_tracking_stats_T* stats = hb_allocator_tracking_stats(&allocator);

  printf("  lex  %-10s  allocs: %-6zu  deallocs: %-6zu  bytes_alloc: %-8zu  tokens: %zu\n",
    name, stats->allocation_count, stats->deallocation_count, stats->bytes_allocated, tokens->size);

  herb_free_tokens(&tokens, &allocator);

  bool ok = no_untracked_deallocations("lex", name, stats);

  hb_allocator_destroy(&allocator);

  return ok;
}

static bool run_parse_benchmark(const char* name, const char* source) {
  hb_allocator_T allocator = hb_allocator_with_tracking();

  AST_DOCUMENT_NODE_T* root = herb_parse(source, NULL, &allocator);

  hb_allocator_tracking_stats_T* stats = hb_allocator_tracking_stats(&allocator);

  printf("  parse %-9s  allocs: %-6zu  deallocs: %-6zu  bytes_alloc: %-8zu\n",
    name, stats->allocation_count, stats->deallocation_count, stats->bytes_allocated);

  ast_node_free((AST_NODE_T*) root, &allocator);

  bool ok = no_untracked_deallocations("parse", name, stats);

  hb_allocator_destroy(&allocator);

  return ok;
}

static bool run_source_check(
  const char* path,
  const char* label,
  const char* source,
  const parser_options_T* options
) {
  hb_allocator_T allocator = hb_allocator_with_tracking();

  AST_DOCUMENT_NODE_T* root = herb_parse(source, options, &allocator);

  ast_node_free((AST_NODE_T*) root, &allocator);

  hb_allocator_tracking_stats_T* stats = hb_allocator_tracking_stats(&allocator);

  printf("  %-44s  %-10s  allocs: %-6zu  deallocs: %-6zu  bytes_alloc: %-8zu\n",
    path, label, stats->allocation_count, stats->deallocation_count, stats->bytes_allocated);

  bool ok = no_untracked_deallocations(label, path, stats);

  hb_allocator_destroy(&allocator);

  return ok;
}

typedef struct {
  const char* label;
  size_t offset;
} option_toggle_T;

static const option_toggle_T OPTION_TOGGLES[] = {
  {          "whitespace",     offsetof(parser_options_T, track_whitespace) },
  {         "action-view",  offsetof(parser_options_T, action_view_helpers) },
  {        "conditionals", offsetof(parser_options_T, transform_conditionals) },
  {        "render-nodes",          offsetof(parser_options_T, render_nodes) },
  {       "strict-locals",         offsetof(parser_options_T, strict_locals) },
  {     "iteration-nodes",       offsetof(parser_options_T, iteration_nodes) },
  {         "prism-nodes",           offsetof(parser_options_T, prism_nodes) },
  {    "prism-nodes-deep",      offsetof(parser_options_T, prism_nodes_deep) },
  {       "prism-program",         offsetof(parser_options_T, prism_program) },
  {   "dot-notation-tags",     offsetof(parser_options_T, dot_notation_tags) },
};

static const size_t OPTION_TOGGLES_COUNT = sizeof(OPTION_TOGGLES) / sizeof(OPTION_TOGGLES[0]);

static void set_toggle(parser_options_T* options, size_t offset) {
  *(bool*) ((char*) options + offset) = true;
}

static bool run_file_check(const char* path) {
  hb_allocator_T file_allocator = hb_allocator_with_malloc();
  char* source = herb_read_file(path, &file_allocator);

  if (!source) {
    printf("  %-44s  FAILED: could not read file\n", path);

    return false;
  }

  bool ok = run_source_check(path, "default", source, NULL);

  for (size_t i = 0; i < OPTION_TOGGLES_COUNT; i++) {
    parser_options_T options = HERB_DEFAULT_PARSER_OPTIONS;
    set_toggle(&options, OPTION_TOGGLES[i].offset);

    ok = run_source_check(path, OPTION_TOGGLES[i].label, source, &options) && ok;
  }

  parser_options_T everything = HERB_DEFAULT_PARSER_OPTIONS;

  for (size_t i = 0; i < OPTION_TOGGLES_COUNT; i++) {
    set_toggle(&everything, OPTION_TOGGLES[i].offset);
  }

  ok = run_source_check(path, "all", source, &everything) && ok;

  hb_allocator_dealloc(&file_allocator, source);

  return ok;
}

static int run_file_checks(int count, char** paths) {
  printf("=== Allocation Check ===\n\n");

  bool ok = true;

  for (int i = 0; i < count; i++) { ok = run_file_check(paths[i]) && ok; }

  printf("\n");

  if (!ok) { return 1; }

  return 0;
}

int main(int argc, char** argv) {
  if (argc > 1) { return run_file_checks(argc - 1, argv + 1); }

  test_case_T cases[] = {
    { "small",  SMALL_INPUT },
    { "medium", MEDIUM_INPUT },
    { "large",  LARGE_INPUT },
  };

  size_t num_cases = sizeof(cases) / sizeof(cases[0]);

  printf("=== Allocation Benchmark ===\n\n");

  bool ok = true;

  for (size_t i = 0; i < num_cases; i++) {
    printf("[%s] (%zu bytes input)\n", cases[i].name, strlen(cases[i].source));
    ok = run_lex_benchmark(cases[i].name, cases[i].source) && ok;
    ok = run_parse_benchmark(cases[i].name, cases[i].source) && ok;
    printf("\n");
  }

  if (!ok) { return 1; }

  return 0;
}
