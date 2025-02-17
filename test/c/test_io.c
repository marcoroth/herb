#include "include/test.h"
#include "../../src/include/io.h"

// Create a temporary file for testing
void create_test_file(const char* filename, const char* content) {
  FILE* fp = fopen(filename, "w");

  ck_assert_ptr_nonnull(fp);  // Ensure file opened successfully

  fputs(content, fp);
  fclose(fp);
}

// Test reading from a file
TEST(test_erbx_read_file)
  const char* filename = "test_erbx_read_file.txt";
  const char* file_content = "Hello, World!\nThis is a test file.\n";

  create_test_file(filename, file_content);

  char* result = erbx_read_file(filename);

  ck_assert_ptr_nonnull(result);
  ck_assert_str_eq(result, file_content);

  free(result);
  remove(filename);
END

TCase* io_tests(void) {
  TCase* io = tcase_create("IO");

  tcase_add_test(io, test_erbx_read_file);

  return io;
}
