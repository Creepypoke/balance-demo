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
const onResult = (result: ThrowResult) => {
  if (result.success) successes++;
  document.querySelector("#successes")!.textContent = String(successes).padStart(2, "0");
  document.querySelector("#throws")!.textContent = String(result.count).padStart(2, "0");
};
const mount = (initial = 0) => {
  try {
    game = create("#game", {
      successRate: Number(rate.value) / 100,
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
mount();
const remount = () => {
  const initial = game?.count ?? 0;
  game?.destroy();
  mount(initial);
};
shaderToggle.addEventListener("change", () => {
  shaderType.disabled = !shaderToggle.checked;
  remount();
});
shaderType.addEventListener("change", remount);
rate.addEventListener("input", () => {
  document.querySelector("#rate-value")!.innerHTML = `${rate.value}<span>%</span>`;
  game?.setSuccessRate(Number(rate.value) / 100);
});
document.querySelectorAll<HTMLButtonElement>("[data-color]").forEach((button) => {
  button.addEventListener("click", () => {
    color = button.dataset.color!;
    remount();
    document
      .querySelectorAll("[data-color]")
      .forEach((swatch) => swatch.setAttribute("aria-pressed", String(swatch === button)));
  });
});
