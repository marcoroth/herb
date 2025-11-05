#include <stdarg.h>
#include <stdio.h>
#include <string.h>

#include "../include/util/hb_arena.h"

#define ANSI_COLOR_GREEN "\033[32m"
#define ANSI_COLOR_YELLOW "\033[33m"
#define ANSI_COLOR_RED "\033[31m"
#define ANSI_COLOR_RESET "\033[0m"

#define UTF8_BULLET_OVERHEAD 2
#define BOX_WIDTH 100

static const char* get_usage_color(double percentage) {
  if (percentage >= 90.0) {
    return ANSI_COLOR_RED;
  } else if (percentage >= 70.0) {
    return ANSI_COLOR_YELLOW;
  } else {
    return ANSI_COLOR_GREEN;
  }
}

static void format_bytes(size_t bytes, char* buffer, size_t buffer_size) {
  if (bytes >= 1024 * 1024) {
    snprintf(buffer, buffer_size, "%.2f MB", bytes / (1024.0 * 1024.0));
  } else if (bytes >= 1024) {
    snprintf(buffer, buffer_size, "%zu KB", bytes / 1024);
  } else {
    snprintf(buffer, buffer_size, "%zu B", bytes);
  }
}

static void print_progress_bar(size_t used, size_t capacity, int width, const char* color) {
  int filled = (int) ((double) used / (double) capacity * width);

  printf("%s[", color);

  for (int i = 0; i < width; i++) {
    if (i < filled) {
      printf("█");
    } else {
      printf("░");
    }
  }

  printf("]%s", ANSI_COLOR_RESET);
}

static void print_box_top(void) {
  printf("╔");
  for (int i = 0; i < BOX_WIDTH; i++) {
    printf("═");
  }
  printf("╗\n");
}

static void print_box_separator(void) {
  printf("╠");
  for (int i = 0; i < BOX_WIDTH; i++) {
    printf("═");
  }
  printf("╣\n");
}

static void print_box_bottom(void) {
  printf("╚");
  for (int i = 0; i < BOX_WIDTH; i++) {
    printf("═");
  }
  printf("╝\n");
}

static void print_box_line(const char* format, ...) {
  char line[256];
  va_list args;
  va_start(args, format);
  int length = vsnprintf(line, sizeof(line), format, args);
  va_end(args);

  printf("║%s%*s║\n", line, BOX_WIDTH - length, "");
}

static void print_box_line_centered(const char* format, ...) {
  char line[256];
  va_list args;
  va_start(args, format);
  int length = vsnprintf(line, sizeof(line), format, args);
  va_end(args);

  int total_padding = BOX_WIDTH - length;
  int left_padding = total_padding / 2;
  int right_padding = total_padding - left_padding;

  printf("║%*s%s%*s║\n", left_padding, "", line, right_padding, "");
}

static void print_box_line_with_bullet(const char* format, ...) {
  char line[256];
  va_list args;
  va_start(args, format);
  int length = vsnprintf(line, sizeof(line), format, args);
  va_end(args);

  printf("║%s%*s║\n", line, BOX_WIDTH - (length - UTF8_BULLET_OVERHEAD), "");
}

static void print_box_line_with_bullet_and_color(const char* color, const char* format, ...) {
  char line[256];
  va_list args;
  va_start(args, format);
  int length = vsnprintf(line, sizeof(line), format, args);
  va_end(args);

  int visual_length = length - UTF8_BULLET_OVERHEAD - (int) strlen(color) - (int) strlen(ANSI_COLOR_RESET);
  printf("║%s%*s║\n", line, BOX_WIDTH - visual_length, "");
}

void hb_arena_print_stats(const hb_arena_T* allocator) {
  if (allocator->head == NULL) {
    print_box_top();
    print_box_line_centered("ARENA MEMORY LAYOUT");
    print_box_separator();
    print_box_line("  Arena is empty (not initialized)");
    print_box_bottom();

    return;
  }

  size_t num_pages = 0;
  size_t total_capacity = 0;
  size_t total_used = 0;
  size_t fragmentation = 0;

  for (const hb_arena_page_T* page = allocator->head; page != NULL; page = page->next) {
    num_pages++;
    total_capacity += page->capacity;
    total_used += page->position;

    if (page != allocator->tail && page->position < page->capacity) {
      fragmentation += (page->capacity - page->position);
    }
  }

  size_t total_available = total_capacity - total_used;
  double usage_percentage = (double) total_used / (double) total_capacity * 100.0;
  double fragmentation_percentage = (double) fragmentation / (double) total_capacity * 100.0;
  const char* overall_color = get_usage_color(usage_percentage);

  char capacity_string[32], used_string[32], available_string[32], fragmentation_string[32], default_size_string[32];
  format_bytes(total_capacity, capacity_string, sizeof(capacity_string));
  format_bytes(total_used, used_string, sizeof(used_string));
  format_bytes(total_available, available_string, sizeof(available_string));
  format_bytes(fragmentation, fragmentation_string, sizeof(fragmentation_string));
  format_bytes(allocator->default_page_size, default_size_string, sizeof(default_size_string));

  print_box_top();
  print_box_line_centered("ARENA MEMORY LAYOUT");
  print_box_separator();
  print_box_line("  Statistics:");

  print_box_line_with_bullet("    • Pages: %zu", num_pages);
  print_box_line_with_bullet("    • Default Page Size: %s", default_size_string);
  print_box_line_with_bullet("    • Total Capacity: %s", capacity_string);
  print_box_line_with_bullet_and_color(
    overall_color,
    "    • Total Used: %s%s%s",
    overall_color,
    used_string,
    ANSI_COLOR_RESET
  );
  print_box_line_with_bullet("    • Total Available: %s", available_string);
  print_box_line_with_bullet_and_color(
    overall_color,
    "    • Usage: %s%.1f%%%s",
    overall_color,
    usage_percentage,
    ANSI_COLOR_RESET
  );
  print_box_line_with_bullet("    • Allocations: %zu", allocator->allocation_count);
  print_box_line_with_bullet("    • Fragmentation: %s", fragmentation_string);

  if (fragmentation > 0) { print_box_line("      (%.1f%% skipped in non-tail pages)", fragmentation_percentage); }

  print_box_separator();

  size_t page_number = 0;

  for (const hb_arena_page_T* page = allocator->head; page != NULL; page = page->next) {
    double page_usage = (double) page->position / (double) page->capacity * 100.0;
    const char* page_color = get_usage_color(page_usage);

    char page_capacity_string[32], page_used_string[32];
    format_bytes(page->capacity, page_capacity_string, sizeof(page_capacity_string));
    format_bytes(page->position, page_used_string, sizeof(page_used_string));

    if (page == allocator->tail) {
      char header_line[256];
      snprintf(header_line, sizeof(header_line), "  Page %zu @ %p ← CURRENT", page_number, (void*) page);
      int visual_length = (int) strlen(header_line) - 2;
      printf("║%s%*s║\n", header_line, BOX_WIDTH - visual_length, "");
    } else {
      print_box_line("  Page %zu @ %p", page_number, (void*) page);
    }

    char stats_line[128];
    int stats_length =
      snprintf(stats_line, sizeof(stats_line), "%s / %s (%.0f%%)", page_used_string, page_capacity_string, page_usage);

    int bar_width = BOX_WIDTH - 4 - 2 - 2 - stats_length - 1;
    int bar_with_brackets = bar_width + 2;

    printf("║    ");
    print_progress_bar(page->position, page->capacity, bar_width, page_color);
    printf("  %s %*s║\n", stats_line, BOX_WIDTH - 4 - bar_with_brackets - 2 - stats_length - 1, "");

    size_t unused = page->capacity - page->position;

    if (unused > 0) {
      char unused_string[32];
      format_bytes(unused, unused_string, sizeof(unused_string));

      if (page == allocator->tail) {
        print_box_line("    Unused: %s (available for allocations)", unused_string);
      } else {
        print_box_line("    Unused: %s", unused_string);
      }
    }

    printf("║%*s║\n", BOX_WIDTH, "");

    page_number++;
  }

  print_box_bottom();
}
