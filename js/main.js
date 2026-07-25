document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("theme-toggle");
  const body = document.body;
  const saved = localStorage.getItem("theme");
  if (saved === "light") {
    body.classList.remove("dark");
    body.classList.add("light");
    toggle.textContent = "☀️";
  }

  toggle.addEventListener("click", () => {
    if (body.classList.contains("dark")) {
      body.classList.remove("dark");
      body.classList.add("light");
      toggle.textContent = "☀️";
      localStorage.setItem("theme", "light");
    } else {
      body.classList.remove("light");
      body.classList.add("dark");
      toggle.textContent = "🌙";
      localStorage.setItem("theme", "dark");
    }
  });

  const copyBtn = document.getElementById("copy-btn");
  const sourceUrl = document.getElementById("source-url");
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(sourceUrl.textContent).then(() => {
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
    });
  });
});