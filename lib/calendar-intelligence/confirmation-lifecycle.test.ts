import { describe, expect, it } from "vitest";
import {
  applyInterventionEvent,
  initialInterventionState,
  isAwaitingExplicitConfirmation,
} from "./confirmation-lifecycle";

const ALT = { start: "2026-08-01T12:30:00.000Z", end: "2026-08-01T13:00:00.000Z", reason: "protege o tempo em família" };

describe("calendar intervention confirmation lifecycle", () => {
  it("walks the full happy path: planned -> conflict -> proposed -> awaiting -> accepted", () => {
    let state = initialInterventionState();
    expect(state.status).toBe("planned");

    state = applyInterventionEvent(state, { type: "conflict_found" });
    expect(state.status).toBe("conflict_detected");

    state = applyInterventionEvent(state, { type: "alternatives_ready", alternatives: [ALT] });
    expect(state.status).toBe("alternative_proposed");
    expect(state.alternatives).toEqual([ALT]);

    state = applyInterventionEvent(state, { type: "present_to_user" });
    expect(state.status).toBe("awaiting_confirmation");

    state = applyInterventionEvent(state, { type: "user_accepted", chosen: ALT });
    expect(state.status).toBe("accepted");
    expect(state.chosen).toEqual(ALT);
  });

  it("supports rejecting, keeping the original, and skipping from awaiting_confirmation", () => {
    const awaiting = { status: "awaiting_confirmation" as const, alternatives: [ALT] };

    expect(applyInterventionEvent(awaiting, { type: "user_rejected_all" }).status).toBe("rejected");
    expect(applyInterventionEvent(awaiting, { type: "user_kept_original" }).status).toBe("kept_original");
    expect(applyInterventionEvent(awaiting, { type: "user_skipped" }).status).toBe("skipped");
  });

  it("never allows skipping straight from conflict_detected to accepted without confirmation", () => {
    const conflicted = { status: "conflict_detected" as const, alternatives: [] };
    const result = applyInterventionEvent(conflicted, { type: "user_accepted", chosen: ALT });
    // Not an allowed transition from conflict_detected - must be a no-op.
    expect(result.status).toBe("conflict_detected");
  });

  it("never allows accepting straight from alternative_proposed (must pass through awaiting_confirmation)", () => {
    const proposed = { status: "alternative_proposed" as const, alternatives: [ALT] };
    const result = applyInterventionEvent(proposed, { type: "user_accepted", chosen: ALT });
    expect(result.status).toBe("alternative_proposed");
  });

  it("terminal states never transition further", () => {
    const accepted = { status: "accepted" as const, alternatives: [ALT], chosen: ALT };
    expect(applyInterventionEvent(accepted, { type: "conflict_found" })).toBe(accepted);
    expect(applyInterventionEvent(accepted, { type: "user_skipped" })).toBe(accepted);
  });

  it("isAwaitingExplicitConfirmation is true only for awaiting_confirmation", () => {
    expect(isAwaitingExplicitConfirmation("awaiting_confirmation")).toBe(true);
    expect(isAwaitingExplicitConfirmation("alternative_proposed")).toBe(false);
    expect(isAwaitingExplicitConfirmation("accepted")).toBe(false);
  });
});
