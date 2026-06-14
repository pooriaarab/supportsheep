import "server-only";
import { WriterWorker, type CanvasState, type WriterWorkerOptions } from "./writer-worker";
import { clearSessionState } from "./tools";

const REGISTRY = new Map<string, WriterWorker>();

export function getOrCreateWorker(
  opts: WriterWorkerOptions & { hydrateFrom?: CanvasState | null },
): WriterWorker {
  const existing = REGISTRY.get(opts.interviewId);
  if (existing) return existing;
  const worker = new WriterWorker(opts);
  // Cold lambda: seed the newly minted worker with the cross-instance
  // canvas snapshot so tool batches landing here see prior sections and
  // paragraphs instead of dropping `insert_paragraph` into an implicit
  // "Untitled section". The snapshot is written by the events route
  // after every batch (see /events/route.ts) so successive batches stay
  // coherent regardless of which lambda picks them up.
  if (opts.hydrateFrom) {
    worker.hydrateFromCanvas(opts.hydrateFrom);
  }
  REGISTRY.set(opts.interviewId, worker);
  return worker;
}

export function getWorker(interviewId: string): WriterWorker | null {
  return REGISTRY.get(interviewId) ?? null;
}

export function disposeWorker(interviewId: string): void {
  const w = REGISTRY.get(interviewId);
  if (w) {
    w.removeAllListeners();
    REGISTRY.delete(interviewId);
  }
  clearSessionState(interviewId);
}
