use super::levenshtein::levenshtein;

pub fn didyoumean(input: &str, list: &[String]) -> Option<String> {
  if list.is_empty() {
    return None;
  }

  let input_lower = input.to_lowercase();

  let mut scored: Vec<(String, usize)> = list
    .iter()
    .map(|item| (item.clone(), levenshtein(&input_lower, &item.to_lowercase())))
    .collect();

  scored.sort_by(|(a_item, a_dist), (b_item, b_dist)| a_dist.cmp(b_dist).then_with(|| a_item.cmp(b_item)));

  scored.into_iter().next().map(|(item, _)| item)
}
