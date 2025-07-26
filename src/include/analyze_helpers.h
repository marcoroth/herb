#ifndef HERB_ANALYZE_HELPERS_H
#define HERB_ANALYZE_HELPERS_H

#include <prism.h>
#include <stdbool.h>

#include "analyzed_ruby.h"

bool has_if_node(analyzed_ruby_T* analyzed);
bool has_elsif_node(analyzed_ruby_T* analyzed);
bool has_else_node(analyzed_ruby_T* analyzed);
bool has_end(analyzed_ruby_T* analyzed);
bool has_block_node(analyzed_ruby_T* analyzed);
bool has_block_closing(analyzed_ruby_T* analyzed);
bool has_case_node(analyzed_ruby_T* analyzed);
bool has_case_match_node(analyzed_ruby_T* analyzed);
bool has_when_node(analyzed_ruby_T* analyzed);
bool has_in_node(analyzed_ruby_T* analyzed);
bool has_for_node(analyzed_ruby_T* analyzed);
bool has_while_node(analyzed_ruby_T* analyzed);
bool has_until_node(analyzed_ruby_T* analyzed);
bool has_begin_node(analyzed_ruby_T* analyzed);
bool has_rescue_node(analyzed_ruby_T* analyzed);
bool has_ensure_node(analyzed_ruby_T* analyzed);
bool has_unless_node(analyzed_ruby_T* analyzed);
bool has_yield_node(analyzed_ruby_T* analyzed);

bool has_error_message(analyzed_ruby_T* anlayzed, const char* message);

bool search_if_nodes(const pm_node_t* node, void* data);
bool search_block_nodes(const pm_node_t* node, void* data);
bool search_case_nodes(const pm_node_t* node, void* data);
bool search_case_match_nodes(const pm_node_t* node, void* data);
bool search_while_nodes(const pm_node_t* node, void* data);
bool search_for_nodes(const pm_node_t* node, void* data);
bool search_until_nodes(const pm_node_t* node, void* data);
bool search_begin_nodes(const pm_node_t* node, void* data);
bool search_unless_nodes(const pm_node_t* node, void* data);
bool search_elsif_nodes(analyzed_ruby_T* analyzed);
bool search_else_nodes(analyzed_ruby_T* analyzed);
bool search_end_nodes(analyzed_ruby_T* analyzed);
bool search_block_closing_nodes(analyzed_ruby_T* analyzed);
bool search_when_nodes(analyzed_ruby_T* analyzed);
bool search_in_nodes(analyzed_ruby_T* analyzed);
bool search_rescue_nodes(analyzed_ruby_T* analyzed);
bool search_ensure_nodes(analyzed_ruby_T* analyzed);
bool search_yield_nodes(const pm_node_t* node, void* data);

#endif
