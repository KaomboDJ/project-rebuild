import { CORE_DECISIONS } from "./seed";
import type { CheckIn, Decision, DecisionInstance, DayType, OperatingState } from "./types";

export function deriveOperatingState(checkIn: CheckIn): OperatingState {
  if (checkIn.dayType === "recovery") return "recovery";
  if (checkIn.sleepHours < 5.5 || checkIn.stress >= 4 || checkIn.energy <= 2) return "survival";
  if (checkIn.sleepHours >= 6.5 && checkIn.energy >= 4 && checkIn.stress <= 2) return "performer";
  return "consistent";
}

function canTrainAtLunch(dayType: DayType, state: OperatingState): boolean {
  return dayType === "remote" && state !== "recovery";
}

export function prioritizeDecisions(dayType: DayType, state: OperatingState): Decision[] {
  return CORE_DECISIONS.filter((decision) => {
    if (!decision.appliesToStates.includes(state)) return false;
    if (decision.requiresRemoteDay && !canTrainAtLunch(dayType, state)) return false;
    return true;
  })
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);
}

// In survival, the reduced action becomes the decision itself rather than a
// footnote on the full-intensity version — the user should never have to
// mentally downgrade the action shown.
export function buildDecisionInstances(dayType: DayType, state: OperatingState, date: string): DecisionInstance[] {
  return prioritizeDecisions(dayType, state).map((decision) => {
    const useReduced = state === "survival" && decision.reducedAction;
    return {
      ...decision,
      title: useReduced ? decision.reducedAction!.title : decision.title,
      trigger: useReduced ? decision.reducedAction!.trigger : decision.trigger,
      fallback: useReduced ? undefined : decision.fallback,
      date,
      status: "pending",
    };
  });
}
