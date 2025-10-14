import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["name", "button", "output"]

  connect() {
    console.log("Hello from Stimulus!")
  }

  greet() {
    this.outputTarget.textContent = `Hello, ${this.nameTarget.value}!`
  }

  reset() {
    this.nameTarget.value = ""
    this.outputTarget.textContent = ""
  }
}
