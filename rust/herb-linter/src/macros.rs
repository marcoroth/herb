macro_rules! rule_visitor {
  ($name:ident) => {
    struct $name {
      rule_name: &'static str,
      offenses: Vec<$crate::offense::UnboundOffense>,
    }

    impl $name {
      fn new(rule_name: &'static str) -> Self {
        Self {
          rule_name,
          offenses: Vec::new(),
        }
      }

      #[allow(dead_code)]
      fn add_offense(&mut self, message: impl Into<String>, location: herb::Location) {
        self.offenses.push($crate::offense::UnboundOffense::new(self.rule_name, message, location));
      }
    }
  };
}

macro_rules! define_parser_rule {
  ($rule:ident, $name:expr, $severity:ident, $visitor:ident
   $(, enabled: $enabled:expr)? $(, exclude: [$($exclude:expr),* $(,)?])?) => {
    pub struct $rule;

    impl $crate::rule::Rule for $rule {
      fn name(&self) -> &'static str {
        $name
      }

      fn default_severity(&self) -> herb_config::Severity {
        herb_config::Severity::$severity
      }

      $(
        fn default_enabled(&self) -> bool {
          $enabled
        }
      )?

      $(
        fn default_exclude(&self) -> &[&str] {
          &[$($exclude),*]
        }
      )?
    }

    impl $crate::rule::ParserRule for $rule {
      fn check(
        &self,
        result: &herb::ParseResult,
        _context: &$crate::rule::LintContext,
      ) -> Vec<$crate::offense::UnboundOffense> {
        let mut visitor = $visitor::new(<Self as $crate::rule::Rule>::name(self));
        visitor.visit_document_node(&result.value);
        visitor.offenses
      }
    }
  };
}

macro_rules! impl_control_flow_visitor {
  ($visitor:ty, $tracker:ident) => {
    fn visit_erb_if_node(&mut self, node: &herb::nodes::ERBIfNode) {
      self
        .$tracker
        .enter_control_flow($crate::utils::control_flow_tracker::ControlFlowType::Conditional);
      self.walk_erb_if_node(node);
      self.handle_exit_control_flow();
    }

    fn visit_erb_unless_node(&mut self, node: &herb::nodes::ERBUnlessNode) {
      self
        .$tracker
        .enter_control_flow($crate::utils::control_flow_tracker::ControlFlowType::Conditional);
      self.walk_erb_unless_node(node);
      self.handle_exit_control_flow();
    }

    fn visit_erb_case_node(&mut self, node: &herb::nodes::ERBCaseNode) {
      self
        .$tracker
        .enter_control_flow($crate::utils::control_flow_tracker::ControlFlowType::Conditional);
      self.walk_erb_case_node(node);
      self.handle_exit_control_flow();
    }

    fn visit_erb_case_match_node(&mut self, node: &herb::nodes::ERBCaseMatchNode) {
      self
        .$tracker
        .enter_control_flow($crate::utils::control_flow_tracker::ControlFlowType::Conditional);
      self.walk_erb_case_match_node(node);
      self.handle_exit_control_flow();
    }

    fn visit_erb_while_node(&mut self, node: &herb::nodes::ERBWhileNode) {
      self.$tracker.enter_control_flow($crate::utils::control_flow_tracker::ControlFlowType::Loop);
      self.walk_erb_while_node(node);
      self.handle_exit_control_flow();
    }

    fn visit_erb_for_node(&mut self, node: &herb::nodes::ERBForNode) {
      self.$tracker.enter_control_flow($crate::utils::control_flow_tracker::ControlFlowType::Loop);
      self.walk_erb_for_node(node);
      self.handle_exit_control_flow();
    }

    fn visit_erb_until_node(&mut self, node: &herb::nodes::ERBUntilNode) {
      self.$tracker.enter_control_flow($crate::utils::control_flow_tracker::ControlFlowType::Loop);
      self.walk_erb_until_node(node);
      self.handle_exit_control_flow();
    }

    fn visit_erb_block_node(&mut self, node: &herb::nodes::ERBBlockNode) {
      self
        .$tracker
        .enter_control_flow($crate::utils::control_flow_tracker::ControlFlowType::Conditional);
      self.walk_erb_block_node(node);
      self.handle_exit_control_flow();
    }

    fn visit_erb_else_node(&mut self, node: &herb::nodes::ERBElseNode) {
      self.$tracker.enter_branch();
      self.walk_erb_else_node(node);
      self.$tracker.exit_branch();
    }

    fn visit_erb_when_node(&mut self, node: &herb::nodes::ERBWhenNode) {
      self.$tracker.enter_branch();
      self.walk_erb_when_node(node);
      self.$tracker.exit_branch();
    }
  };
}

macro_rules! define_source_rule {
  ($rule:ident, $name:expr, $severity:ident
   $(, enabled: $enabled:expr)? $(, exclude: [$($exclude:expr),* $(,)?])?) => {
    pub struct $rule;

    impl $crate::rule::Rule for $rule {
      fn name(&self) -> &'static str {
        $name
      }

      fn default_severity(&self) -> herb_config::Severity {
        herb_config::Severity::$severity
      }

      $(
        fn default_enabled(&self) -> bool {
          $enabled
        }
      )?

      $(
        fn default_exclude(&self) -> &[&str] {
          &[$($exclude),*]
        }
      )?
    }
  };
}
