#ifndef ERBX_UTIL_H
#define ERBX_UTIL_H

int iswhitespace(int character);
int isnewline(int character);

int count_in_string(const char* string, char character);
int count_newlines(const char* string);

char* replace_char(char* string, char find, char replace);
char* escape_newlines(const char* input);

#endif
