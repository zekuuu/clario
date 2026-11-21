// Applies the saved theme before first paint so dark-mode users don't see a light flash.
// Kept as an external file because the Tauri CSP disallows inline scripts.
(function () {
  var theme = "light";
  try {
    var stored = window.localStorage.getItem("clario:theme");
    if (stored === "light" || stored === "dark") theme = stored;
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) theme = "dark";
  } catch (error) {
    // Storage can be unavailable; fall back to light.
  }
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = theme;
  document.documentElement.style.colorScheme = theme;
})();
