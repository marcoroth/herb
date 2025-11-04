for file in src/*.c
do
  clang -Isrc -Ivendor/prism/include -c "$file"
done
