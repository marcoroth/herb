exec = erbx
sources = $(wildcard src/*.c)
objects = $(sources:.c=.o)
flags = -g -Wall -fPIC

$(exec): $(objects)
	gcc $(objects) $(flags) -o $(exec)

%.o: %.c include/%.h
	gcc -c $(flags) $< -o $@

clean:
	rm -f $(exec)
	rm -f src/*.o
