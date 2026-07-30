macro_rules! severity_config {
  ({ cli: $cli:ident, editor: $editor:ident }) => {
    herb_config::SeverityConfig::PerMode {
      cli: herb_config::Severity::$cli,
      editor: herb_config::Severity::$editor,
    }
  };

  ($severity:ident) => {
    herb_config::SeverityConfig::Severity(herb_config::Severity::$severity)
  };
}

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

      #[allow(dead_code)]
      fn add_offense_with_severity(&mut self, message: impl Into<String>, location: herb::Location, severity: herb_config::Severity) {
        self
          .offenses
          .push($crate::offense::UnboundOffense::with_severity(self.rule_name, message, location, severity));
      }

      #[allow(dead_code)]
      fn add_unsafe_offense_with_severity(&mut self, message: impl Into<String>, location: herb::Location, severity: herb_config::Severity) {
        self
          .offenses
          .push($crate::offense::UnboundOffense::with_severity(self.rule_name, message, location, severity).unsafe_fix());
      }
    }
  };
}

macro_rules! define_parser_rule {
  ($rule:ident, $name:expr, $severity:tt, $visitor:ident
   $(, enabled: $enabled:expr)? $(, exclude: [$($exclude:expr),* $(,)?])?
   $(, parser_options: { $($option:ident: $value:expr),* $(,)? })?
   $(, autocorrectable: $autocorrectable:expr)?
   $(, unsafe_autocorrectable: $unsafe_autocorrectable:expr)?
   $(, reindent_after_autofix: $reindent:expr)?
   $(, autofix: $autofix:path)?) => {
    pub struct $rule;

    impl $crate::rule::Rule for $rule {
      fn name(&self) -> &'static str {
        $name
      }

      fn default_severity(&self) -> herb_config::SeverityConfig {
        severity_config!($severity)
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

      $(
        fn parser_options(&self) -> herb::ParserOptions {
          herb::ParserOptions {
            $($option: $value,)*
            ..$crate::rule::default_linter_parser_options()
          }
        }
      )?

      $(
        fn autocorrectable(&self) -> bool {
          $autocorrectable
        }
      )?

      $(
        #[allow(unused)]
        fn has_autofix(&self) -> bool {
          let _ = $autofix;
          true
        }
      )?

      $(
        fn unsafe_autocorrectable(&self) -> bool {
          $unsafe_autocorrectable
        }
      )?

      $(
        fn reindent_after_autofix(&self) -> bool {
          $reindent
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

      $(
        fn autofix(
          &self,
          offense: &$crate::offense::Offense,
          document: &mut herb::nodes::DocumentNode,
          context: &$crate::rule::LintContext,
        ) -> bool {
          $autofix(offense, document, context)
        }
      )?
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
  ($rule:ident, $name:expr, $severity:tt
   $(, enabled: $enabled:expr)? $(, exclude: [$($exclude:expr),* $(,)?])?
   $(, parser_options: { $($option:ident: $value:expr),* $(,)? })?
   $(, has_autofix: $has_autofix:expr)?
   $(, autocorrectable: $autocorrectable:expr)?
   $(, unsafe_autocorrectable: $unsafe_autocorrectable:expr)?
   $(, reindent_after_autofix: $reindent:expr)?) => {
    pub struct $rule;

    impl $crate::rule::Rule for $rule {
      fn name(&self) -> &'static str {
        $name
      }

      fn default_severity(&self) -> herb_config::SeverityConfig {
        severity_config!($severity)
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

      $(
        fn parser_options(&self) -> herb::ParserOptions {
          herb::ParserOptions {
            $($option: $value,)*
            ..$crate::rule::default_linter_parser_options()
          }
        }
      )?

      $(
        fn autocorrectable(&self) -> bool {
          $autocorrectable
        }
      )?

      $(
        fn has_autofix(&self) -> bool {
          $has_autofix
        }
      )?

      $(
        fn unsafe_autocorrectable(&self) -> bool {
          $unsafe_autocorrectable
        }
      )?

      $(
        fn reindent_after_autofix(&self) -> bool {
          $reindent
        }
      )?
    }
  };
}
