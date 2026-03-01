document.addEventListener("DOMContentLoaded", () => {
  if (window.parent.location === window.location) {
    document.body.classList.add("not-inside-iframe")
  } else {
    document.body.classList.add("inside-iframe")
  }
})
