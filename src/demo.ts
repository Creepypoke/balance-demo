import { create, type Game, type ThrowResult } from "./index";
import "./demo.css";
import { styleDemoWidget } from "./demo-theme";
import { demoFragmentShader } from "./demo-shader";
import { demoWoodFragmentShader } from "./demo-wood-shader";

let game: Game;
let successes = 0;
let color = "#79d6a4";
let finished = false;
let dialogTimer = 0;
const gameContainer = document.querySelector<HTMLElement>("#game")!;
const completion = document.querySelector<HTMLTemplateElement>("#completion-actions")!;
const dialog = document.querySelector<HTMLDialogElement>("#success-dialog")!;
const form = document.querySelector<HTMLFormElement>("#feedback-form")!;
const email = document.querySelector<HTMLInputElement>("#feedback-email")!;
const newsletter = document.querySelector<HTMLInputElement>("#feedback-newsletter")!;
const feedback = document.querySelector<HTMLTextAreaElement>("#feedback-message")!;
const formStatus = document.querySelector<HTMLElement>("#feedback-status")!;
const openFeedback = completion.content.querySelector<HTMLButtonElement>("#open-feedback")!;
const playAgain = completion.content.querySelector<HTMLButtonElement>("#play-again")!;
const settings = document.querySelectorAll<
  HTMLInputElement | HTMLSelectElement | HTMLButtonElement
>("#rate, #shader-enabled, #shader-type, [data-color]");
const showFeedback = () => {
  window.clearTimeout(dialogTimer);
  if (!dialog.open) dialog.showModal();
};
const rate = document.querySelector<HTMLInputElement>("#rate")!;
const shaderToggle = document.querySelector<HTMLInputElement>("#shader-enabled")!;
const shaderType = document.querySelector<HTMLSelectElement>("#shader-type")!;
const onResult = (result: ThrowResult) => {
  if (result.success) successes++;
  document.querySelector("#successes")!.textContent = String(successes).padStart(2, "0");
  document.querySelector("#throws")!.textContent = String(result.count).padStart(2, "0");
  if (result.success && !finished) {
    finished = true;
    game.disableMotion();
    const root = gameContainer.firstElementChild?.shadowRoot;
    const scene = root?.querySelector<HTMLElement>(".scene");
    if (scene) scene.inert = true;
    root?.querySelector(".actions")?.replaceChildren(openFeedback, playAgain);
    const status = root?.querySelector(".status");
    if (status) status.textContent = "Равновесие найдено. Игра завершена ✦";
    settings.forEach((control) => {
      control.disabled = true;
    });
    openFeedback.focus({ preventScroll: true });
    dialogTimer = window.setTimeout(
      showFeedback,
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1400,
    );
  }
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
mount();
const remount = () => {
  if (finished) return;
  const initial = game?.count ?? 0;
  game?.destroy();
  mount(initial);
};
shaderToggle.addEventListener("change", () => {
  shaderType.disabled = !shaderToggle.checked;
  remount();
});
openFeedback.addEventListener("click", showFeedback);
document.querySelector("#close-feedback")!.addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => {
  if (finished) openFeedback.focus({ preventScroll: true });
});
newsletter.addEventListener("change", () => {
  email.required = newsletter.checked;
  feedback.setCustomValidity("");
  formStatus.textContent = "";
});
form.addEventListener("input", () => {
  feedback.setCustomValidity("");
  formStatus.textContent = "";
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  feedback.setCustomValidity(
    !newsletter.checked && !feedback.value.trim()
      ? "Напишите отзыв или выберите подписку на рассылку."
      : "",
  );
  if (!form.reportValidity()) return;
  formStatus.textContent =
    "Демоформа заполнена корректно. Данные не отправлены, подписка не оформлена.";
});
playAgain.addEventListener("click", () => {
  window.clearTimeout(dialogTimer);
  dialog.close();
  finished = false;
  successes = 0;
  completion.content.append(openFeedback, playAgain);
  game.destroy();
  settings.forEach((control) => {
    control.disabled = false;
  });
  shaderType.disabled = !shaderToggle.checked;
  form.reset();
  email.required = false;
  feedback.setCustomValidity("");
  formStatus.textContent = "";
  document.querySelector("#successes")!.textContent = "00";
  document.querySelector("#throws")!.textContent = "00";
  mount();
  gameContainer.firstElementChild?.shadowRoot
    ?.querySelector<HTMLElement>(".scene")
    ?.focus({ preventScroll: true });
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
