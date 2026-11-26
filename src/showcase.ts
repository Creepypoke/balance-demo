import { create } from "./index";
import "./showcase.css";

const modal = document.querySelector<HTMLDialogElement>("#widget-modal");

const DEFAULT_BRAND = "Пример-бизнес";
const rawSite = new URLSearchParams(window.location.search).get("site") ?? "";
const brand =
  [...rawSite].filter((ch) => ch >= " " && ch !== "\u007f").join("").trim().slice(0, 60) ||
  DEFAULT_BRAND;
document.querySelectorAll("[data-brand]").forEach((el) => {
  el.textContent = brand;
});
document.title = `Демо виджета — ${brand}`;

create("#widget", {
  successRate: 0.35,
  confetti: true,
  counter: { initial: 0, visible: true, milestones: [5, 10, 25] },
  labels: ["Время", "Стоимость", "Качество"],
  style: {
    color: "#79d6a4",
    strokeColor: "#294c38",
    background: "#f6f8f3",
  },
});

document.querySelectorAll<HTMLButtonElement>("[data-open-widget]").forEach((button) => {
  button.addEventListener("click", () => modal?.showModal());
});

document
  .querySelector<HTMLButtonElement>("#close-widget-modal")
  ?.addEventListener("click", () => modal?.close());

modal?.addEventListener("click", (event) => {
  if (event.target === modal) modal.close();
});
