import { create, type Game, type ThrowResult } from "./index";
import "./demo.css";
import { styleDemoWidget } from "./demo-theme";
import { demoFragmentShader } from "./demo-shader";
import { demoWoodFragmentShader } from "./demo-wood-shader";

let game: Game;
let successes = 0;
let color = "#79d6a4";
const rate = document.querySelector<HTMLInputElement>("#rate")!;
const shaderToggle = document.querySelector<HTMLInputElement>("#shader-enabled")!;
const shaderType = document.querySelector<HTMLSelectElement>("#shader-type")!;
const embedCode = document.querySelector<HTMLElement>("#embed-code")!;
const onResult = (result: ThrowResult) => {
  if (result.success) successes++;
  document.querySelector("#successes")!.textContent = String(successes).padStart(2, "0");
  document.querySelector("#throws")!.textContent = String(result.count).padStart(2, "0");
};
const mount = (initial = 0) => {
  try {
    game = create("#game", {
      successRate: Number(rate.value) / 100,
      confetti: true,
      counter: { initial, milestones: [5, 10, 25] },
      style: {
        color,
        fragmentShader: shaderToggle.checked
          ? shaderType.value === "wood"
            ? demoWoodFragmentShader
            : demoFragmentShader
          : undefined,
        idleShaderSpeed: shaderToggle.checked && shaderType.value === "liquid" ? 0.16 : 0,
      },
      onSuccess: onResult,
      onFailure: onResult,
      onCount: (result) => console.info(`Пройден рубеж: ${result.count} бросков`),
    });
    styleDemoWidget();
  } catch (error) {
    document.querySelector("#game")!.textContent =
      `Не удалось запустить WebGL: ${(error as Error).message}`;
  }
};
const renderEmbedCode = () => {
  const isLiquid = shaderType.value !== "wood";
  const styleLines = [`    color: "${color}",`];
  if (shaderToggle.checked) {
    styleLines.push(
      `    fragmentShader: ${isLiquid ? "liquidShader" : "woodShader"}, // GLSL — инлайн в init-файле`,
    );
    if (isLiquid) styleLines.push("    idleShaderSpeed: 0.16,");
  }
  embedCode.textContent = `<div id="triangle-game" style="max-width:640px"></div>
<script defer src="/assets/triangle-toss.min.js"></script>
<script defer src="/assets/init-triangle.js"></script>

// init-triangle.js
const game = TriangleToss.create("#triangle-game", {
  successRate: ${Number(rate.value) / 100},
  labels: ["Время", "Стоимость", "Качество"],
  style: {
${styleLines.join("\n")}
  },
});`;
};
const copyButton = document.querySelector<HTMLButtonElement>("#embed-copy")!;
const copyLabel = copyButton.querySelector("span")!;
let copyTimer = 0;
const fallbackCopy = (text: string) => {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
};
const showCopyFeedback = (ok: boolean) => {
  window.clearTimeout(copyTimer);
  copyLabel.textContent = ok ? "Скопировано ✓" : "Не удалось скопировать";
  copyButton.classList.toggle("copied", ok);
  copyTimer = window.setTimeout(() => {
    copyLabel.textContent = "Скопировать";
    copyButton.classList.remove("copied");
  }, 1600);
};
copyButton.addEventListener("click", async () => {
  const text = embedCode.textContent ?? "";
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    ok = fallbackCopy(text);
  }
  showCopyFeedback(ok);
});
mount();
renderEmbedCode();
const remount = () => {
  const initial = game?.count ?? 0;
  game?.destroy();
  mount(initial);
};
shaderToggle.addEventListener("change", () => {
  shaderType.disabled = !shaderToggle.checked;
  remount();
  renderEmbedCode();
});
shaderType.addEventListener("change", () => {
  remount();
  renderEmbedCode();
});
rate.addEventListener("input", () => {
  document.querySelector("#rate-value")!.innerHTML = `${rate.value}<span>%</span>`;
  game?.setSuccessRate(Number(rate.value) / 100);
  renderEmbedCode();
});
document.querySelectorAll<HTMLButtonElement>("[data-color]").forEach((button) => {
  button.addEventListener("click", () => {
    color = button.dataset.color!;
    remount();
    renderEmbedCode();
    document
      .querySelectorAll("[data-color]")
      .forEach((swatch) => swatch.setAttribute("aria-pressed", String(swatch === button)));
  });
});
