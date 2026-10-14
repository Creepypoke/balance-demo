import widgetTheme from "./demo-widget.css?inline";

type ThemePreference = "light" | "dark" | "system";

const root = document.documentElement;
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
const buttons = document.querySelectorAll<HTMLButtonElement>("[data-theme]");
let preference = (root.dataset.demoThemePreference ?? "system") as ThemePreference;

const applyTheme = () => {
  const dark = preference === "dark" || (preference === "system" && systemTheme.matches);
  root.dataset.demoTheme = dark ? "dark" : "light";
  root.dataset.demoThemePreference = preference;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!.content = dark
    ? "#151c18"
    : "#f5f5ef";
  buttons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.theme === preference));
  });
};

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    preference = button.dataset.theme as ThemePreference;
    try {
      localStorage.setItem("triangle-toss-demo-theme", preference);
    } catch {
      // Keep the selected theme for this visit if storage is blocked.
    }
    applyTheme();
  });
});
systemTheme.addEventListener("change", applyTheme);
applyTheme();

/** Demo-only overrides: the distributed widget and its styles stay unchanged. */
export const styleDemoWidget = () => {
  const shadowRoot = document.querySelector("#game > div")?.shadowRoot;
  if (!shadowRoot) return;
  const style = document.createElement("style");
  style.textContent = widgetTheme;
  shadowRoot.append(style);
};
