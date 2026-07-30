#[derive(Clone, Copy, PartialEq)]
pub enum ControlFlowType {
  Conditional,
  Loop,
}

pub struct ControlFlowState<T> {
  pub previous_branch_values: T,
  pub previous_control_flow_values: T,
  pub previous_control_flow_type: Option<ControlFlowType>,
  pub was_in_control_flow: bool,
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
      previous_control_flow_type: self.current_control_flow_type,
      was_in_control_flow: self.is_in_control_flow,
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
    let returning_to_top_level = !state.was_in_control_flow;
    let was_conditional = self.current_control_flow_type == Some(ControlFlowType::Conditional);
    let values = std::mem::take(&mut self.control_flow_values);

    self.current_branch_values = state.previous_branch_values;
    self.control_flow_values = state.previous_control_flow_values;
    self.is_in_control_flow = state.was_in_control_flow;
    self.current_control_flow_type = state.previous_control_flow_type;

    Some(ExitInfo {
      values,
      was_conditional,
      returning_to_top_level,
    })
  }

  pub fn enter_branch(&mut self) {
    let previous = if self.is_in_control_flow {
      std::mem::take(&mut self.current_branch_values)
    } else {
      self.current_branch_values.clone()
    };

    self.branch_state_stack.push(previous);
  }

  pub fn exit_branch(&mut self) {
    self.branch_state_stack.pop();
  }

  pub fn reset_values(&mut self) {
    self.current_branch_values = T::default();
    self.control_flow_values = T::default();
  }
}

pub struct ExitInfo<T> {
  pub values: T,
  pub was_conditional: bool,
  pub returning_to_top_level: bool,
}
