export type OperatingState = "performer" | "consistent" | "survival" | "recovery";

export type DayType = "remote" | "office" | "weekend" | "recovery";

export interface CheckIn {
  date: string;
  sleepHours: number;
  energy: 1 | 2 | 3 | 4 | 5;
  stress: 1 | 2 | 3 | 4 | 5;
  dayType: DayType;
}

export type DecisionStatus = "pending" | "completed" | "skipped";

export interface ReducedAction {
  title: string;
  trigger: string;
}

export interface Decision {
  id: string;
  title: string;
  trigger: string;
  scoreValue: number;
  priority: number;
  appliesToStates: OperatingState[];
  fallback?: string;
  reminderTime?: string;
  reminderWindowMinutes?: number;
  requiresRemoteDay?: boolean;
  reducedAction?: ReducedAction;
}

export interface DecisionInstance extends Decision {
  date: string;
  status: DecisionStatus;
  skipReason?: string;
}

export interface OnboardingProfile {
  bestSelf: string;
  currentSelf: string;
  wantToBecome: string;
  constraints: string;
  derailingDecisions: string;
  tonePreference: string;
  completedAt: string;
}
