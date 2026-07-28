import type { DecisionInstance } from "./types";

export function computeDecisionScore(instances: DecisionInstance[]): number {
  return instances
    .filter((instance) => instance.status === "completed")
    .reduce((total, instance) => total + instance.scoreValue, 0);
}

export function maxPossibleScore(instances: DecisionInstance[]): number {
  return instances.reduce((total, instance) => total + instance.scoreValue, 0);
}
