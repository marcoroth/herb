import { Application } from "@hotwired/stimulus"
import PlaygroundController from "./playground_controller"
import IFrameController from "./iframe_controller"

const application = Application.start()

application.register("playground", PlaygroundController)
application.register("iframe", IFrameController)
