export interface ThrowResult {
  /** Completed throws, including counter.initial. */
  count: number;
  success: boolean;
  source: "button" | "gesture" | "shake" | "api";
}

export interface GameOptions {
  /** Independent probability for each throw, not a quota. Default 0.3. */
  successRate?: number;
  counter?: { initial?: number; visible?: boolean; milestones?: number[] };
  labels?: readonly [string, string, string];
  style?: {
    color?: string;
    strokeColor?: string;
    background?: string;
    /** WebGL 1 GLSL: precision, u_color, u_time, v_local; returns gl_FragColor. */
    fragmentShader?: string;
    /** Opt-in continuous shader time; idle speed relative to a toss (0–1). */
    idleShaderSpeed?: number;
  };
  motion?: { enabled?: boolean; vibration?: boolean };
  onSuccess?: (result: ThrowResult) => void;
  onFailure?: (result: ThrowResult) => void;
  onCount?: (result: ThrowResult) => void;
  onError?: (error: Error) => void;
}

export interface Game {
  /** Returns false when busy, hidden, too small, or destroyed. */
  toss: () => boolean;
  /** Must be called from a user gesture (iOS permission). */
  enableMotion: () => Promise<boolean>;
  disableMotion: () => void;
  setSuccessRate: (rate: number) => void;
  readonly count: number;
  readonly motionEnabled: boolean;
  destroy: () => void;
}
