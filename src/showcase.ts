import { create, type ThrowResult } from "./index";
import "./showcase.css";
import { demoFragmentShader } from "./demo-shader";
import { demoWoodFragmentShader } from "./demo-wood-shader";

const modal = document.querySelector<HTMLDialogElement>("#widget-modal");

const DEFAULT_BRAND = "Пример-бизнес";
const params = new URLSearchParams(window.location.search);
const rawSite = params.get("site") ?? "";
const brand =
  [...rawSite].filter((ch) => ch >= " " && ch !== "\u007f").join("").trim().slice(0, 60) ||
  DEFAULT_BRAND;
const rawShader = params.get("shader");
const shader = rawShader === "wood" ? "wood" : "liquid";
document.querySelectorAll("[data-brand]").forEach((el) => {
  el.textContent = brand;
});
document.title = `Демо виджета — ${brand}`;

const dialog = document.querySelector<HTMLDialogElement>("#success-dialog");
const form = document.querySelector<HTMLFormElement>("#feedback-form");
const email = document.querySelector<HTMLInputElement>("#feedback-email");
const newsletter = document.querySelector<HTMLInputElement>("#feedback-newsletter");
const feedback = document.querySelector<HTMLTextAreaElement>("#feedback-message");
const formStatus = document.querySelector<HTMLElement>("#feedback-status");
let dialogTimer = 0;
const showFeedback = () => {
  window.clearTimeout(dialogTimer);
  if (dialog && !dialog.open) dialog.showModal();
};
const onSuccess = (_result: ThrowResult) => {
  dialogTimer = window.setTimeout(
    showFeedback,
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1400,
  );
};
const clearFormStatus = () => {
  if (feedback) feedback.setCustomValidity("");
  if (formStatus) formStatus.textContent = "";
};

create("#widget", {
  successRate: 0.35,
  confetti: true,
  counter: { initial: 0, visible: true, milestones: [5, 10, 25] },
  labels: ["Время", "Стоимость", "Качество"],
  style: {
    color: "#79d6a4",
    strokeColor: "#294c38",
    background: "#f6f8f3",
    fragmentShader: shader === "wood" ? demoWoodFragmentShader : demoFragmentShader,
    idleShaderSpeed: shader === "liquid" ? 0.16 : 0,
  },
  onSuccess,
});

document.querySelectorAll<HTMLButtonElement>("[data-open-widget]").forEach((button) => {
  button.addEventListener("click", () => modal?.showModal());
});

document.querySelector<HTMLButtonElement>("#close-widget-modal")?.addEventListener("click", () => {
  window.clearTimeout(dialogTimer);
  dialog?.close();
  modal?.close();
});

modal?.addEventListener("click", (event) => {
  if (event.target === modal) {
    window.clearTimeout(dialogTimer);
    dialog?.close();
    modal.close();
  }
});

document.querySelector<HTMLButtonElement>("#close-feedback")?.addEventListener("click", () => dialog?.close());

newsletter?.addEventListener("change", () => {
  if (email) email.required = newsletter.checked;
  clearFormStatus();
});
form?.addEventListener("input", clearFormStatus);
form?.addEventListener("submit", (event) => {
  event.preventDefault();
  feedback?.setCustomValidity(
    !newsletter?.checked && !feedback.value.trim()
      ? "Напишите отзыв или выберите подписку на рассылку."
      : "",
  );
  if (!form.reportValidity()) return;
  if (formStatus)
    formStatus.textContent =
      "Демоформа заполнена корректно. Данные не отправлены, подписка не оформлена.";
});
