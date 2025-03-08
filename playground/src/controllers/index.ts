import { Application } from "@hotwired/stimulus"
import PlaygroundController from "./playground_controller"

const application = Application.start()

application.register("playground", PlaygroundController)
