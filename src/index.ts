import { chooseOutcome, Physics, STEP, validateRate, vertices } from "./physics";
import { Renderer } from "./renderer";
import { styles } from "./styles";
import type { Game, GameOptions, ThrowResult } from "./types";
import { Confetti } from "./confetti";
export type { Game, GameOptions, ThrowResult } from "./types";

type MotionConstructor = typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> };

/** Creates an isolated widget. No work or global event listeners until called. */
export function create(target: string | HTMLElement, options: GameOptions = {}): Game {
  const container =
    typeof target === "string" ? document.querySelector<HTMLElement>(target) : target;
  if (!container) throw new Error("Контейнер игры не найден.");
  let rate = validateRate(options.successRate ?? 0.3);
  const idleShaderSpeed = options.style?.idleShaderSpeed ?? 0;
  if (!Number.isFinite(idleShaderSpeed) || idleShaderSpeed < 0 || idleShaderSpeed > 1)
    throw new RangeError("idleShaderSpeed должен быть числом от 0 до 1.");
  let count = options.counter?.initial ?? 0;
  if (!Number.isSafeInteger(count) || count < 0)
    throw new RangeError("counter.initial должен быть целым неотрицательным числом.");
  const milestones = new Set(options.counter?.milestones ?? []);
  if ([...milestones].some((n) => !Number.isSafeInteger(n) || n < 1))
    throw new RangeError("milestones должны быть положительными целыми числами.");
  const labelTexts = options.labels ?? ["Время", "Стоимость", "Качество"];
  if (labelTexts.length !== 3 || labelTexts.some((s) => typeof s !== "string"))
    throw new TypeError("labels: нужны три строки.");
  const host = document.createElement("div");
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${styles}</style><section class="game" aria-label="Треугольник равновесия">
    <header class="top"><span>Три стороны. Один баланс.</span><span class="count"></span></header>
    <div class="scene" tabindex="0" role="group" aria-label="Подбросьте треугольник кнопкой или жестом вверх">
      <div class="ground"></div><div class="shadow"></div><canvas aria-hidden="true"></canvas>
      <span class="label"></span><span class="label"></span><span class="label"></span>
      <div class="grab-target" aria-hidden="true"></div>
    </div>
    <div class="bottom"><p class="status" role="status" aria-live="polite"></p>
      <div class="actions"><button class="throw" type="button">Подбросить ↗</button><button class="motion" type="button" aria-pressed="false">Тряска устройства</button></div>
      <p class="note">Управляемая вероятность · не денежная игра</p>
    </div></section>`;
  const get = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const canvas = get<HTMLCanvasElement>("canvas");
  const scene = get<HTMLDivElement>(".scene");
  const button = get<HTMLButtonElement>(".throw");
  const motionButton = get<HTMLButtonElement>(".motion");
  const status = get<HTMLParagraphElement>(".status");
  const counter = get<HTMLSpanElement>(".count");
  const shadow = get<HTMLDivElement>(".shadow");
  const grabTarget = get<HTMLDivElement>(".grab-target");
  const note = get<HTMLParagraphElement>(".note");
  const labels = [...root.querySelectorAll<HTMLSpanElement>(".label")];
  labels.forEach((label, i) => {
    label.textContent = labelTexts[i];
    label.title = labelTexts[i];
  });
  if (options.style?.background) {
    if (!CSS.supports("color", options.style.background))
      throw new TypeError("Неверный цвет фона.");
    host.style.setProperty("--background", options.style.background);
  }
  const makeRenderer = () =>
    new Renderer(
      canvas,
      options.style?.color ?? "#79d6a4",
      options.style?.strokeColor ?? "#294c38",
      options.style?.fragmentShader,
      options.confetti === true,
    );
  let renderer: Renderer;
  try {
    renderer = makeRenderer();
  } catch (error) {
    try {
      options.onError?.(error as Error);
    } catch (callbackError) {
      console.error("[TriangleToss] onError", callbackError);
    }
    throw error;
  }
  container.append(host);
  const physics = new Physics();
  const confetti = options.confetti ? new Confetti() : undefined;
  const abort = new AbortController();
  const signal = abort.signal;
  let destroyed = false,
    contextLost = false,
    intersecting = true,
    sized = false;
  let frame = 0,
    last = 0,
    accumulator = 0,
    lastVibration = -Infinity;
  let source: ThrowResult["source"] = "api";
  let motionEnabled = false,
    permissionToken = 0,
    lastShake = -Infinity;
  let previousAcceleration: { x: number; y: number; z: number; time: number } | null = null;
  let pointer: { id: number; x: number; y: number; time: number } | null = null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let shaderTime = 0;
  const animateShader = () => idleShaderSpeed > 0 && !reducedMotion.matches;
  const animating = () => physics.active || animateShader() || confetti?.active;
  const shaderClock = () => (idleShaderSpeed > 0 ? shaderTime : physics.elapsed);

  const report = (error: unknown) => {
    const e = error instanceof Error ? error : new Error(String(error));
    try {
      if (options.onError) options.onError(e);
      else console.error("[TriangleToss]", e);
    } catch (callbackError) {
      console.error("[TriangleToss] onError", callbackError);
    }
  };
  const callback = (fn: ((result: ThrowResult) => void) | undefined, result: ThrowResult) => {
    try {
      fn?.(result);
    } catch (error) {
      report(error);
    }
  };
  const setStatus = (title: string, hint: string) => {
    status.textContent = title;
    const small = document.createElement("span");
    small.className = "hint";
    small.textContent = hint;
    status.append(small);
  };
  const updateCounter = () => {
    counter.hidden = options.counter?.visible === false;
    counter.textContent = `Броски / ${String(count).padStart(2, "0")}`;
  };
  const canRun = () => !destroyed && !contextLost && sized && intersecting && !document.hidden;
  const vibrate = (pattern: number | number[]) => {
    if (
      options.motion?.vibration === false ||
      !motionEnabled ||
      !navigator.vibrate ||
      document.hidden
    )
      return;
    try {
      navigator.vibrate(pattern);
    } catch {
      /* Browser may deny haptics. */
    }
  };
  const draw = () => {
    if (contextLost || destroyed || !sized) return;
    renderer.draw(physics, shaderClock(), confetti);
    const grabSize = physics.radius + 16;
    grabTarget.style.width = grabTarget.style.height = `${grabSize * 2}px`;
    grabTarget.style.transform = `translate(${physics.x - grabSize}px,${physics.y - grabSize}px)`;
    grabTarget.style.pointerEvents = physics.active ? "none" : "auto";
    const points = vertices(physics.radius, physics.angle);
    // Left, bottom, right at initial orientation: Время, Стоимость, Качество.
    for (const [i, pair] of [
      [0, [2, 0]],
      [1, [1, 2]],
      [2, [0, 1]],
    ] as const) {
      const a = points[pair[0]],
        b = points[pair[1]];
      const mx = (a[0] + b[0]) / 2,
        my = (a[1] + b[1]) / 2;
      const length = Math.hypot(mx, my) || 1;
      const x = physics.x + mx + (mx / length) * 17;
      const y = physics.y + my + (my / length) * 17;
      let angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
      if (angle > Math.PI / 2) angle -= Math.PI;
      if (angle < -Math.PI / 2) angle += Math.PI;
      labels[i].style.transform =
        `translate(${x}px,${y}px) translate(-50%,-50%) rotate(${angle}rad)`;
    }
    shadow.style.transform = `translateX(${physics.x - 60}px) scaleX(${Math.max(0.4, 1 - (physics.floor - physics.y) / 600)})`;
  };
  const finish = () => {
    count++;
    updateCounter();
    button.disabled = false;
    const result: ThrowResult = { count, success: physics.success, source };
    setStatus(
      physics.success ? "Равновесие найдено ✦" : "Почти. Попробуем ещё?",
      physics.success
        ? "Время, стоимость и качество — в балансе."
        : "В этот раз треугольник выбрал грань.",
    );
    if (physics.success) vibrate([35, 60, 65]);
    if (physics.success && !reducedMotion.matches) confetti?.burst(physics);
    // Stable snapshot; host callbacks may destroy or start another throw.
    callback(physics.success ? options.onSuccess : options.onFailure, { ...result });
    if (milestones.has(result.count)) callback(options.onCount, { ...result });
  };
  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
  };
  const tick = (now: number) => {
    frame = 0;
    if (!canRun() || !animating()) {
      last = 0;
      return;
    }
    const delta = last ? Math.min((now - last) / 1000, 0.05) : STEP;
    last = now;
    if (idleShaderSpeed > 0 && !reducedMotion.matches)
      shaderTime += delta * (physics.active ? 1 : idleShaderSpeed);
    if (!physics.active && !confetti?.active) {
      // Only redraw the canvas at rest; labels, physics and counters stay untouched.
      renderer.draw(physics, shaderClock());
      frame = requestAnimationFrame(tick);
      return;
    }
    accumulator += delta;
    let impact = 0;
    const wasActive = physics.active;
    while (accumulator >= STEP) {
      impact = Math.max(impact, physics.step(STEP));
      confetti?.step(STEP, physics);
      accumulator -= STEP;
    }
    if (impact > 75 && now - lastVibration > 110) {
      vibrate(12);
      lastVibration = now;
    }
    draw();
    if (wasActive && !physics.active) finish();
    if (animating() && canRun() && !frame) frame = requestAnimationFrame(tick);
  };
  const wake = () => {
    button.disabled = physics.active || !canRun();
    if (reducedMotion.matches && confetti?.active) {
      confetti.clear();
      draw();
    }
    if (animating() && canRun() && !frame) {
      last = 0;
      frame = requestAnimationFrame(tick);
    } else if (!canRun() || !animating()) stop();
  };
  const toss = (via: ThrowResult["source"], horizontal = 0, power = 1) => {
    if (!canRun() || physics.active || count >= Number.MAX_SAFE_INTEGER) return false;
    source = via;
    physics.launch(chooseOutcome(rate), horizontal, power);
    confetti?.release(physics);
    accumulator = 0;
    setStatus("В поисках равновесия…", "У каждой стороны своя роль.");
    if (reducedMotion.matches) {
      physics.complete();
      draw();
      finish();
    } else wake();
    return true;
  };

  const onMotion = (event: DeviceMotionEvent) => {
    if (!motionEnabled || !canRun()) {
      previousAcceleration = null;
      return;
    }
    const a = event.accelerationIncludingGravity;
    if (a?.x == null || a.y == null || a.z == null) return;
    const now = performance.now();
    const previous = previousAcceleration;
    previousAcceleration = { x: a.x, y: a.y, z: a.z, time: now };
    if (!previous || now - previous.time > 300) return;
    const jerk = Math.hypot(a.x - previous.x, a.y - previous.y, a.z - previous.z);
    if (jerk > 13 && now - lastShake > 1300) {
      if (toss("shake", Math.max(-240, Math.min(240, a.x * 12)), Math.min(1.15, 0.9 + jerk / 100)))
        lastShake = now;
    }
  };
  const disableMotion = () => {
    permissionToken++;
    motionEnabled = false;
    previousAcceleration = null;
    window.removeEventListener("devicemotion", onMotion);
    motionButton.setAttribute("aria-pressed", "false");
    motionButton.textContent = "Тряска устройства";
    if (navigator.vibrate) {
      try {
        navigator.vibrate(0);
      } catch {
        /* Optional. */
      }
    }
  };
  const enableMotion = async () => {
    if (destroyed) return false;
    if (motionEnabled) return true;
    if (!window.isSecureContext || typeof window.DeviceMotionEvent === "undefined") {
      note.textContent = "Датчики недоступны. Нужны HTTPS и поддержка устройства.";
      return false;
    }
    const token = ++permissionToken;
    const ctor = window.DeviceMotionEvent as MotionConstructor;
    try {
      if (ctor.requestPermission && (await ctor.requestPermission()) !== "granted") {
        if (!destroyed && token === permissionToken)
          note.textContent = "Доступ к датчикам не разрешён. Кнопка и жест работают.";
        return false;
      }
      if (destroyed || token !== permissionToken) return false;
      motionEnabled = true;
      previousAcceleration = null;
      window.addEventListener("devicemotion", onMotion, { passive: true });
      motionButton.setAttribute("aria-pressed", "true");
      motionButton.textContent = "Тряска включена ✓";
      note.textContent = "Встряхните устройство · вибрация зависит от браузера";
      return true;
    } catch (error) {
      if (!destroyed && token === permissionToken) {
        note.textContent = "Не удалось включить датчики. Используйте кнопку.";
        report(error);
      }
      return false;
    }
  };

  button.addEventListener("click", () => toss("button"), { signal });
  motionButton.addEventListener(
    "click",
    () => {
      if (motionEnabled) {
        disableMotion();
        note.textContent = "Управляемая вероятность · не денежная игра";
      } else void enableMotion();
    },
    { signal },
  );
  scene.addEventListener(
    "keydown",
    (event) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        toss("button");
      }
    },
    { signal },
  );
  scene.addEventListener(
    "pointerdown",
    (event) => {
      if (physics.active || !event.isPrimary || event.button !== 0) return;
      const rect = scene.getBoundingClientRect();
      if (
        Math.hypot(event.clientX - rect.left - physics.x, event.clientY - rect.top - physics.y) >
        physics.radius + 35
      )
        return;
      pointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        time: performance.now(),
      };
      scene.setPointerCapture(event.pointerId);
    },
    { signal },
  );
  scene.addEventListener(
    "pointerup",
    (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const start = pointer;
      pointer = null;
      const dy = start.y - event.clientY;
      const duration = Math.max(80, performance.now() - start.time);
      if (dy > 18)
        toss(
          "gesture",
          Math.max(-300, Math.min(300, ((event.clientX - start.x) / duration) * 700)),
          Math.min(1.2, 0.85 + dy / duration),
        );
      else if (Math.hypot(dy, start.x - event.clientX) < 12) toss("gesture");
    },
    { signal },
  );
  scene.addEventListener(
    "pointercancel",
    () => {
      pointer = null;
    },
    { signal },
  );
  scene.addEventListener(
    "lostpointercapture",
    () => {
      pointer = null;
    },
    { signal },
  );
  document.addEventListener("visibilitychange", wake, { signal });
  reducedMotion.addEventListener("change", wake, { signal });
  canvas.addEventListener(
    "webglcontextlost",
    (event) => {
      event.preventDefault();
      contextLost = true;
      stop();
      button.disabled = true;
      setStatus("Графика временно недоступна", "Ожидаем восстановления WebGL.");
    },
    { signal },
  );
  canvas.addEventListener(
    "webglcontextrestored",
    () => {
      try {
        renderer.destroy();
        renderer = makeRenderer();
        contextLost = false;
        renderer.resize(scene.clientWidth, scene.clientHeight);
        setStatus(
          physics.active ? "В поисках равновесия…" : "Подбросьте. Найдите баланс.",
          "Нажмите кнопку или потяните треугольник вверх.",
        );
        draw();
        wake();
      } catch (error) {
        report(error);
      }
    },
    { signal },
  );
  const resize = new ResizeObserver(() => {
    if (destroyed) return;
    const width = scene.clientWidth,
      height = scene.clientHeight;
    sized = width >= 180 && height >= 220;
    if (sized) {
      physics.resize(width, height);
      renderer.resize(width, height);
      draw();
    }
    wake();
  });
  resize.observe(scene);
  const intersection = new IntersectionObserver(([entry]) => {
    intersecting = entry.isIntersecting;
    wake();
  });
  intersection.observe(host);
  updateCounter();
  setStatus("Подбросьте. Найдите баланс.", "Нажмите кнопку или потяните треугольник вверх.");
  button.disabled = true;
  if (options.motion?.enabled === false) motionButton.hidden = true;

  return {
    toss: () => toss("api"),
    enableMotion,
    disableMotion,
    setSuccessRate: (value) => {
      if (!destroyed) rate = validateRate(value);
    },
    get count() {
      return count;
    },
    get motionEnabled() {
      return motionEnabled;
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      stop();
      disableMotion();
      abort.abort();
      resize.disconnect();
      intersection.disconnect();
      renderer.destroy();
      confetti?.clear();
      host.remove();
    },
  };
}
