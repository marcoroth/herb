#ifndef TEST_H
#define TEST_H

#include <check.h>

#define TEST(name) START_TEST(name) {
#define END                                                                              \
  }                                                                                      \
  END_TEST

#endif
