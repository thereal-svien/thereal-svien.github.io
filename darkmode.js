const toggleButton = document.getElementById("toggle-dark");
const body = document.body;

// Load saved mode
if (localStorage.getItem("theme") === "dark") {
  body.classList.add("dark-mode");
  toggleButton.textContent = "light mode";
} else {
  toggleButton.textContent = "dark mode";
}

toggleButton.addEventListener("click", () => {
  body.classList.toggle("dark-mode");

  // Save preference and update icon
  if (body.classList.contains("dark-mode")) {
    localStorage.setItem("theme", "dark");
    toggleButton.textContent = "light mode";
  } else {
    localStorage.setItem("theme", "light");
    toggleButton.textContent = "dark mode";
  }
});
