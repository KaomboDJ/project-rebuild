export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type ProfileObjective =
  | "rebuild-fitness"
  | "lose-weight"
  | "train-consistently"
  | "improve-nutrition"
  | "improve-sleep";

type DecisionDomain = "training" | "nutrition" | "sleep" | "recovery" | "planning";
type DecisionImpact = "low" | "medium" | "high";
type DecisionSource = "rule" | "ai" | "hybrid";
type DecisionStatus = "proposed" | "accepted" | "edited" | "completed" | "skipped";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          preferred_name: string;
          timezone: string;
          current_identity: string;
          desired_identity: string;
          primary_objective: ProfileObjective;
          preferred_training_days: string[];
          preferred_training_time: string;
          typical_dinner_time: string;
          target_sleep_time: string;
          working_hours: Json;
          current_constraints: string;
          intervention_tone: string;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          preferred_name?: string;
          timezone?: string;
          current_identity?: string;
          desired_identity?: string;
          primary_objective?: ProfileObjective;
          preferred_training_days?: string[];
          preferred_training_time?: string;
          typical_dinner_time?: string;
          target_sleep_time?: string;
          working_hours?: Json;
          current_constraints?: string;
          intervention_tone?: string;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      calendar_connections: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          encrypted_access_token: string;
          encrypted_refresh_token: string | null;
          expires_at: string | null;
          scopes: string[];
          calendar_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider?: string;
          encrypted_access_token: string;
          encrypted_refresh_token?: string | null;
          expires_at?: string | null;
          scopes?: string[];
          calendar_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["calendar_connections"]["Insert"]>;
        Relationships: [];
      };
      daily_check_ins: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          sleep_quality: number | null;
          energy_level: number | null;
          stress_level: number | null;
          physical_limitation: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          sleep_quality?: number | null;
          energy_level?: number | null;
          stress_level?: number | null;
          physical_limitation?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["daily_check_ins"]["Insert"]>;
        Relationships: [];
      };
      decision_runs: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          context_snapshot: Json;
          engine_version: string;
          generated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          context_snapshot?: Json;
          engine_version?: string;
          generated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["decision_runs"]["Insert"]>;
        Relationships: [];
      };
      decisions: {
        Row: {
          id: string;
          user_id: string;
          decision_run_id: string;
          date: string;
          title: string;
          reason: string;
          recommended_action: string;
          recommended_start: string | null;
          recommended_end: string | null;
          domain: DecisionDomain;
          impact: DecisionImpact;
          confidence: number;
          source: DecisionSource;
          status: DecisionStatus;
          calendar_event_id: string | null;
          completed_at: string | null;
          skipped_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          decision_run_id: string;
          date: string;
          title: string;
          reason: string;
          recommended_action: string;
          recommended_start?: string | null;
          recommended_end?: string | null;
          domain: DecisionDomain;
          impact: DecisionImpact;
          confidence?: number;
          source?: DecisionSource;
          status?: DecisionStatus;
          calendar_event_id?: string | null;
          completed_at?: string | null;
          skipped_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["decisions"]["Insert"]>;
        Relationships: [];
      };
      decision_feedback: {
        Row: {
          id: string;
          user_id: string;
          decision_id: string;
          useful: boolean | null;
          feedback: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          decision_id: string;
          useful?: boolean | null;
          feedback?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["decision_feedback"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
