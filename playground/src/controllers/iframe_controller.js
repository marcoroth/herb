import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["hide"]

  connect() {
    if (window.frameElement) {
      this.hideTargets.forEach((item) => item.classList.add("hidden"))
    } else {
      this.hideTargets.forEach((item) => item.classList.remove("hidden"))
    }
  }
}
