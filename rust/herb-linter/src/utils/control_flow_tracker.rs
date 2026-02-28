#[derive(PartialEq)]
pub enum ControlFlowType {
  Conditional,
  Loop,
}

pub struct ControlFlowState<T> {
  pub previous_branch_values: T,
  pub previous_control_flow_values: T,
}

pub struct ControlFlowTracker<T: Default + Clone> {
  pub current_branch_values: T,
  pub control_flow_values: T,
  pub is_in_control_flow: bool,
  pub current_control_flow_type: Option<ControlFlowType>,
  pub state_stack: Vec<ControlFlowState<T>>,
  pub branch_state_stack: Vec<T>,
}

impl<T: Default + Clone> ControlFlowTracker<T> {
  pub fn new() -> Self {
    Self {
      current_branch_values: T::default(),
      control_flow_values: T::default(),
      is_in_control_flow: false,
      current_control_flow_type: None,
      state_stack: Vec::new(),
      branch_state_stack: Vec::new(),
    }
  }

  pub fn enter_control_flow(&mut self, control_flow_type: ControlFlowType) {
    let state = ControlFlowState {
      previous_branch_values: std::mem::take(&mut self.current_branch_values),
      previous_control_flow_values: if !self.is_in_control_flow {
        std::mem::take(&mut self.control_flow_values)
      } else {
        self.control_flow_values.clone()
      },
    };

    if !self.is_in_control_flow {
      self.control_flow_values = T::default();
    }

    self.state_stack.push(state);
    self.is_in_control_flow = true;
    self.current_control_flow_type = Some(control_flow_type);
  }

  pub fn exit_control_flow(&mut self) -> Option<ExitInfo<T>> {
    let state = self.state_stack.pop()?;
    let returning_to_top_level = self.state_stack.is_empty();
    let was_conditional = self.current_control_flow_type == Some(ControlFlowType::Conditional);
    let values = std::mem::take(&mut self.control_flow_values);

    self.current_branch_values = state.previous_branch_values;
    self.control_flow_values = state.previous_control_flow_values;
    self.is_in_control_flow = !returning_to_top_level;
    self.current_control_flow_type = if returning_to_top_level { None } else { Some(ControlFlowType::Conditional) };

    Some(ExitInfo {
      values,
      was_conditional,
      returning_to_top_level,
    })
  }

  pub fn enter_branch(&mut self) {
    let previous = if self.is_in_control_flow {
      std::mem::replace(&mut self.current_branch_values, T::default())
    } else {
      self.current_branch_values.clone()
    };

    self.branch_state_stack.push(previous);
  }

  pub fn exit_branch(&mut self) {
    if let Some(previous) = self.branch_state_stack.pop() {
      self.current_branch_values = previous;
    }
  }
}

pub struct ExitInfo<T> {
  pub values: T,
  pub was_conditional: bool,
  pub returning_to_top_level: bool,
}
