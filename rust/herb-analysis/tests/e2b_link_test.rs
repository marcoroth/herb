#[test]
fn herb_and_rubydex_both_work_in_one_binary() {
  let (erb_children, declarations) =
    herb_analysis::e2b_link_check("<div><%= @post.title %></div>", "module Alpha\n  class Beta\n    def gamma; end\n  end\nend\n");

  assert!(erb_children > 0, "herb parsed no ERB children — its Prism may have been displaced");
  assert!(declarations > 0, "rubydex produced no declarations — its Prism may have been displaced");
}

#[test]
fn herb_still_parses_ruby_through_its_own_prism() {
  let result = herb::parse("<%= user.name %>").expect("herb parse failed");

  assert!(!result.value.children.is_empty());
}
