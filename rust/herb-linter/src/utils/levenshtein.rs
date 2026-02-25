pub fn levenshtein(a: &str, b: &str) -> usize {
  let b_length = b.len();
  let mut previous: Vec<usize> = (0..=b_length).collect();
  let mut current = vec![0; b_length + 1];

  for (i, a_character) in a.chars().enumerate() {
    current[0] = i + 1;

    for (j, b_character) in b.chars().enumerate() {
      let cost = if a_character == b_character { 0 } else { 1 };
      current[j + 1] = (previous[j] + cost).min(previous[j + 1] + 1).min(current[j] + 1);
    }

    std::mem::swap(&mut previous, &mut current);
  }

  previous[b_length]
}
