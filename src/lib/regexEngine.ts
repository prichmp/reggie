import type { MatchResult } from "../types";
import type {
  RegexRequestMessage,
  RegexResponseMessage,
} from "../workers/regex.worker";

export type EngineStatus = "idle" | "computing" | "too-slow";

export interface RegexRequest {
  pattern: string;
  flags: string;
  subject: string;
}

export interface EngineResult {
  ok: boolean;
  matches: MatchResult[];
  error: string | null;
}

/** Minimal surface of a Worker the engine relies on — keeps it test-injectable
 *  while staying assignable from a real DOM `Worker`. */
export interface WorkerLike {
  postMessage(message: RegexRequestMessage): void;
  terminate(): void;
  onmessage: ((ev: MessageEvent<RegexResponseMessage>) => void) | null;
}

export interface EngineCallbacks {
  onResult: (result: EngineResult) => void;
  onStatus: (status: EngineStatus) => void;
}

export interface EngineOptions {
  /** Abort a computation that runs longer than this many ms. */
  timeoutMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export const DEFAULT_TIMEOUT_MS = 4000;

/**
 * Owns a regex worker and serializes requests onto it.
 *
 * - Request ids let us drop results from a superseded computation (staleness).
 * - A new request that arrives mid-computation terminates the busy worker and
 *   spawns a fresh one, which aborts a runaway (catastrophic-backtracking) run.
 * - A hard timeout terminates a worker that never reports back and surfaces a
 *   "too-slow" status, since terminate-on-busy only fires while the user types.
 */
export class RegexEngine {
  private readonly createWorker: () => WorkerLike;
  private readonly callbacks: EngineCallbacks;
  private readonly timeoutMs: number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;

  private worker: WorkerLike;
  private currentId = 0;
  private busy = false;
  private timer: unknown = null;

  constructor(
    createWorker: () => WorkerLike,
    callbacks: EngineCallbacks,
    options: EngineOptions = {},
  ) {
    this.createWorker = createWorker;
    this.callbacks = callbacks;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = options.clearTimer ?? ((h) => clearTimeout(h as number));
    this.worker = this.spawn();
  }

  request(req: RegexRequest): void {
    // A new request supersedes whatever is in flight. If the worker is still
    // busy, kill it — that's the only way to abort a runaway regex.
    if (this.busy) {
      this.worker.terminate();
      this.worker = this.spawn();
    }
    this.clearTimer_();
    const id = ++this.currentId;
    this.busy = true;
    this.callbacks.onStatus("computing");
    this.timer = this.setTimer(() => this.onTimeout(id), this.timeoutMs);
    this.worker.postMessage({ id, ...req });
  }

  dispose(): void {
    this.clearTimer_();
    this.worker.terminate();
  }

  private spawn(): WorkerLike {
    const worker = this.createWorker();
    worker.onmessage = (ev) => this.handleMessage(ev.data);
    return worker;
  }

  private handleMessage(data: RegexResponseMessage): void {
    if (data.id !== this.currentId) return; // stale result, ignore
    this.busy = false;
    this.clearTimer_();
    this.callbacks.onStatus("idle");
    if (data.ok) {
      this.callbacks.onResult({ ok: true, matches: data.matches ?? [], error: null });
    } else {
      this.callbacks.onResult({
        ok: false,
        matches: [],
        error: data.error ?? "regex error",
      });
    }
  }

  private onTimeout(id: number): void {
    if (id !== this.currentId || !this.busy) return;
    this.worker.terminate();
    this.worker = this.spawn();
    this.busy = false;
    this.timer = null;
    // Invalidate the aborted id so a late message can never be accepted.
    this.currentId++;
    this.callbacks.onStatus("too-slow");
    this.callbacks.onResult({
      ok: false,
      matches: [],
      error: "Regex timed out",
    });
  }

  private clearTimer_(): void {
    if (this.timer !== null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
  }
}
