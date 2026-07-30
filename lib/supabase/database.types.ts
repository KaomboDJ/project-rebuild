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

type CoachMessageRole = "user" | "assistant";
type PantryCategory = "produce" | "protein" | "dairy" | "grain" | "pantry" | "frozen" | "beverage" | "other";
type PantryUnit = "unidade" | "g" | "kg" | "ml" | "l";
type InventoryEventType = "purchase" | "consume" | "adjust" | "waste";
type InventoryEventSource = "manual" | "coach" | "shopping";
type ShoppingListStatus = "open" | "completed";
type DayType = "home" | "office";
type DefaultDayType = "home" | "office" | "mixed";
type DayTypeSource = "check-in" | "profile" | "calendar-heuristic";

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
          default_day_type: DefaultDayType | null;
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
          default_day_type?: DefaultDayType | null;
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
          google_account_email: string | null;
          label: string | null;
          is_primary: boolean;
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
          google_account_email?: string | null;
          label?: string | null;
          is_primary?: boolean;
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
          day_type: DayType | null;
          day_type_source: DayTypeSource | null;
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
          day_type?: DayType | null;
          day_type_source?: DayTypeSource | null;
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
      coach_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          started_at: string;
          last_message_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          started_at?: string;
          last_message_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["coach_conversations"]["Insert"]>;
        Relationships: [];
      };
      coach_messages: {
        Row: {
          id: string;
          user_id: string;
          conversation_id: string;
          role: CoachMessageRole;
          content: string;
          tool_calls: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          conversation_id: string;
          role: CoachMessageRole;
          content: string;
          tool_calls?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["coach_messages"]["Insert"]>;
        Relationships: [];
      };
      pantry_items: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          category: PantryCategory;
          unit: PantryUnit;
          quantity: number;
          portable: boolean;
          perishable: boolean;
          expires_on: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          category?: PantryCategory;
          unit?: PantryUnit;
          quantity?: number;
          portable?: boolean;
          perishable?: boolean;
          expires_on?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pantry_items"]["Insert"]>;
        Relationships: [];
      };
      inventory_events: {
        Row: {
          id: string;
          user_id: string;
          pantry_item_id: string;
          event_type: InventoryEventType;
          quantity_delta: number;
          resulting_quantity: number;
          source: InventoryEventSource;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          pantry_item_id: string;
          event_type: InventoryEventType;
          quantity_delta: number;
          resulting_quantity: number;
          source?: InventoryEventSource;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["inventory_events"]["Insert"]>;
        Relationships: [];
      };
      shopping_lists: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          status: ShoppingListStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string;
          status?: ShoppingListStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shopping_lists"]["Insert"]>;
        Relationships: [];
      };
      shopping_list_items: {
        Row: {
          id: string;
          user_id: string;
          shopping_list_id: string;
          pantry_item_id: string | null;
          name: string;
          quantity: number;
          unit: PantryUnit;
          purchased: boolean;
          purchased_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          shopping_list_id: string;
          pantry_item_id?: string | null;
          name: string;
          quantity?: number;
          unit?: PantryUnit;
          purchased?: boolean;
          purchased_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shopping_list_items"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      apply_inventory_event: {
        Args: {
          p_pantry_item_id: string;
          p_event_type: InventoryEventType;
          p_quantity_delta: number;
          p_source?: InventoryEventSource;
          p_note?: string | null;
        };
        Returns: Database["public"]["Tables"]["inventory_events"]["Row"];
      };
      mark_shopping_item_purchased: {
        Args: {
          p_shopping_list_item_id: string;
          p_actual_quantity?: number | null;
        };
        Returns: Database["public"]["Tables"]["shopping_list_items"]["Row"];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
