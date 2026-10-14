const game = TriangleToss.create("#triangle", {
  successRate: 0.3,
  counter: { initial: 0, visible: true, milestones: [5, 10] },
  labels: ["Время", "Стоимость", "Качество"],
  style: { color: "#79d6a4", strokeColor: "#294c38", background: "#f6f8f3" },
  motion: { enabled: true, vibration: true },
  onSuccess: ({ count }) => console.log("На вершине!", count),
  onFailure: ({ count }) => console.log("На грани", count),
  onCount: ({ count }) => console.log("Достигнут рубеж", count),
  onError: (error) => console.error(error),
});

// When removing the widget or leaving an SPA page: game.destroy().
// Programmatic throw: game.toss(). Live probability: game.setSuccessRate(1).
