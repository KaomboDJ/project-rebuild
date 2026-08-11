export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type ProfileObjective =
  "rebuild-fitness" | "lose-weight" | "train-consistently" | "improve-nutrition" | "improve-sleep";

type DecisionDomain = "training" | "nutrition" | "sleep" | "recovery" | "planning";
type DecisionImpact = "low" | "medium" | "high";
type DecisionSource = "rule" | "ai" | "hybrid";
type DecisionStatus = "proposed" | "accepted" | "edited" | "completed" | "skipped";
type DecisionTimingType = "calendar_slot" | "trigger_based" | "flexible";

type CoachMessageRole = "user" | "assistant";
type PantryCategory =
  "produce" | "protein" | "dairy" | "grain" | "pantry" | "frozen" | "beverage" | "other";
type PantryUnit = "unidade" | "g" | "kg" | "ml" | "l";
type InventoryEventType = "purchase" | "consume" | "adjust" | "waste";
type InventoryEventSource = "manual" | "coach" | "shopping";
type ShoppingListStatus = "open" | "completed";
type DayType = "home" | "office";
type DefaultDayType = "home" | "office" | "mixed";
type DayTypeSource = "check-in" | "profile" | "calendar-heuristic";

type NutritionGoal =
  "lose-weight" | "maintain-weight" | "build-muscle" | "manage-blood-sugar" | "improve-energy";
type DietStyle = "omnivore" | "vegetarian" | "vegan" | "pescatarian" | "low-carb" | "mediterranean" | "ketogenic";
type BudgetPreference = "low" | "medium" | "high";
type VarietyPreference = "low" | "medium" | "high";
type MacroSource = "system-estimate" | "user-provided" | "clinician-provided";
type MealType = "breakfast" | "lunch" | "dinner" | "snack";
type GrocerySection = PantryCategory;
type MealPlanMode = "decide-for-me" | "simple-rotation" | "flexible-week";
type MealPlanStatus = "active" | "archived";
type MealPlanItemStatus = "planned" | "eaten" | "skipped";

type TrainingCategoryId =
  | "calistenia" | "cardio_leve" | "cardio_pesado" | "hipertrofia"
  | "artes_marciais_strike" | "wrestling_grappling" | "mobilidade" | "parkour";
type TrainingLocation = "home" | "gym" | "outdoor" | "mixed";
type TrainingIntensity = "low" | "medium" | "high";
type TrainingVarietyPreference = "low" | "medium" | "high";
type TrainingPlanStatus = "active" | "archived";
type TrainingPlanItemStatus = "planned" | "done" | "skipped";
type HealthProvider = "apple_health" | "health_connect" | "xiaomi_mi_fitness" | "xiaomi_home" | "manual_import";
type HealthSourceStatus = "active" | "disconnected" | "error";
type HealthMetric =
  | "height_cm" | "weight_kg" | "body_fat_percent" | "visceral_fat_index"
  | "steps_count" | "sleep_minutes" | "resting_heart_rate_bpm" | "hrv_ms"
  | "workout_minutes" | "spo2_percent";
type HealthSyncStatus = "running" | "completed" | "failed";

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
          target_wake_time: string;
          weekend_sleep_time: string | null;
          weekend_wake_time: string | null;
          wind_down_minutes: number;
          sleep_schedule_type: "regular" | "shift";
          working_hours: Json;
          current_constraints: string;
          intervention_tone: string;
          onboarding_completed: boolean;
          default_day_type: DefaultDayType | null;
          privacy_consent_at: string | null;
          terms_accepted_at: string | null;
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
          target_wake_time?: string;
          weekend_sleep_time?: string | null;
          weekend_wake_time?: string | null;
          wind_down_minutes?: number;
          sleep_schedule_type?: "regular" | "shift";
          working_hours?: Json;
          current_constraints?: string;
          intervention_tone?: string;
          onboarding_completed?: boolean;
          default_day_type?: DefaultDayType | null;
          privacy_consent_at?: string | null;
          terms_accepted_at?: string | null;
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
      calendar_sources: {
        Row: {
          id: string;
          user_id: string;
          connection_id: string;
          external_calendar_id: string;
          name: string;
          color: string | null;
          is_read_only: boolean;
          can_write: boolean;
          selected_for_context: boolean;
          visible_in_workspace: boolean;
          is_default_destination: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          connection_id: string;
          external_calendar_id: string;
          name: string;
          color?: string | null;
          is_read_only?: boolean;
          can_write?: boolean;
          selected_for_context?: boolean;
          visible_in_workspace?: boolean;
          is_default_destination?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["calendar_sources"]["Insert"]>;
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
          plan_confirmed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          context_snapshot?: Json;
          engine_version?: string;
          generated_at?: string;
          plan_confirmed_at?: string | null;
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
          calendar_connection_id: string | null;
          completed_at: string | null;
          skipped_reason: string | null;
          related_pantry_item: string | null;
          rule_id: string | null;
          timing_type: DecisionTimingType;
          trigger_label: string | null;
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
          rule_id?: string | null;
          timing_type?: DecisionTimingType;
          trigger_label?: string | null;
          calendar_event_id?: string | null;
          calendar_connection_id?: string | null;
          completed_at?: string | null;
          skipped_reason?: string | null;
          related_pantry_item?: string | null;
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
          meal_plan_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string;
          status?: ShoppingListStatus;
          meal_plan_id?: string | null;
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
          source: "manual" | "meal_plan" | "coach";
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
          source?: "manual" | "meal_plan" | "coach";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shopping_list_items"]["Insert"]>;
        Relationships: [];
      };
      nutrition_profiles: {
        Row: {
          id: string;
          user_id: string;
          goal: NutritionGoal;
          diet_style: DietStyle;
          allergies: string[];
          exclusions: string[];
          medical_constraints: string;
          meals_per_day: number;
          include_snack: boolean;
          people_count: number;
          cooking_time_minutes: number;
          budget_preference: BudgetPreference;
          variety_preference: VarietyPreference;
          target_calories: number | null;
          target_protein_g: number | null;
          target_carbs_g: number | null;
          target_fat_g: number | null;
          macro_source: MacroSource;
          preferred_plan_mode: MealPlanMode;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          goal?: NutritionGoal;
          diet_style?: DietStyle;
          allergies?: string[];
          exclusions?: string[];
          medical_constraints?: string;
          meals_per_day?: number;
          include_snack?: boolean;
          people_count?: number;
          cooking_time_minutes?: number;
          budget_preference?: BudgetPreference;
          variety_preference?: VarietyPreference;
          target_calories?: number | null;
          target_protein_g?: number | null;
          target_carbs_g?: number | null;
          target_fat_g?: number | null;
          macro_source?: MacroSource;
          preferred_plan_mode?: MealPlanMode;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["nutrition_profiles"]["Insert"]>;
        Relationships: [];
      };
      recipes: {
        Row: {
          id: string;
          name: string;
          meal_type: MealType;
          diet_tags: string[];
          allergens: string[];
          prep_minutes: number;
          servings: number;
          calories_per_serving: number;
          protein_g_per_serving: number;
          carbs_g_per_serving: number;
          fat_g_per_serving: number;
          fiber_g_per_serving: number;
          budget_tier: BudgetPreference;
          glycemic_note: string;
          instructions: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          meal_type: MealType;
          diet_tags?: string[];
          allergens?: string[];
          prep_minutes: number;
          servings?: number;
          calories_per_serving: number;
          protein_g_per_serving: number;
          carbs_g_per_serving: number;
          fat_g_per_serving: number;
          fiber_g_per_serving?: number;
          budget_tier?: BudgetPreference;
          glycemic_note?: string;
          instructions?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recipes"]["Insert"]>;
        Relationships: [];
      };
      recipe_ingredients: {
        Row: {
          id: string;
          recipe_id: string;
          name: string;
          quantity: number;
          unit: PantryUnit;
          optional: boolean;
          grocery_section: GrocerySection;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          name: string;
          quantity: number;
          unit?: PantryUnit;
          optional?: boolean;
          grocery_section?: GrocerySection;
        };
        Update: Partial<Database["public"]["Tables"]["recipe_ingredients"]["Insert"]>;
        Relationships: [];
      };
      meal_plans: {
        Row: {
          id: string;
          user_id: string;
          week_start: string;
          mode: MealPlanMode;
          status: MealPlanStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_start: string;
          mode?: MealPlanMode;
          status?: MealPlanStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["meal_plans"]["Insert"]>;
        Relationships: [];
      };
      muted_rules: {
        Row: {
          id: string;
          user_id: string;
          rule_id: string;
          muted_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          rule_id: string;
          muted_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["muted_rules"]["Insert"]>;
        Relationships: [];
      };
      founder_notes: {
        Row: {
          id: string;
          user_id: string;
          rule_id: string | null;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          rule_id?: string | null;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["founder_notes"]["Insert"]>;
        Relationships: [];
      };
      daily_briefings: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          generated_at: string;
          event_count: number;
          free_minutes: number;
          decisions_generated: boolean;
          decisions_stale: boolean;
          summary: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          generated_at?: string;
          event_count?: number;
          free_minutes?: number;
          decisions_generated?: boolean;
          decisions_stale?: boolean;
          summary?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["daily_briefings"]["Insert"]>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          enabled: boolean;
          failure_count: number;
          last_success_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          enabled?: boolean;
          failure_count?: number;
          last_success_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["push_subscriptions"]["Insert"]>;
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          user_id: string;
          enabled: boolean;
          daily_briefing: boolean;
          decision_reminders: boolean;
          nutrition_reminders: boolean;
          briefing_time: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          enabled?: boolean;
          daily_briefing?: boolean;
          decision_reminders?: boolean;
          nutrition_reminders?: boolean;
          briefing_time?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notification_preferences"]["Insert"]>;
        Relationships: [];
      };
      notification_deliveries: {
        Row: {
          id: string;
          user_id: string;
          notification_key: string;
          delivered_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          notification_key: string;
          delivered_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notification_deliveries"]["Insert"]>;
        Relationships: [];
      };
      meal_plan_items: {
        Row: {
          id: string;
          user_id: string;
          meal_plan_id: string;
          day_date: string;
          meal_slot: MealType;
          recipe_id: string;
          servings: number;
          status: MealPlanItemStatus;
          eaten_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          meal_plan_id: string;
          day_date: string;
          meal_slot: MealType;
          recipe_id: string;
          servings?: number;
          status?: MealPlanItemStatus;
          eaten_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["meal_plan_items"]["Insert"]>;
        Relationships: [];
      };
      health_sources: {
        Row: {
          id: string;
          user_id: string;
          source_key: string;
          provider: HealthProvider;
          label: string;
          device_name: string | null;
          authorized_metrics: string[];
          use_for_coaching: boolean;
          status: HealthSourceStatus;
          last_sync_at: string | null;
          last_error_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_key: string;
          provider: HealthProvider;
          label: string;
          device_name?: string | null;
          authorized_metrics?: string[];
          use_for_coaching?: boolean;
          status?: HealthSourceStatus;
          last_sync_at?: string | null;
          last_error_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["health_sources"]["Insert"]>;
        Relationships: [];
      };
      health_observations: {
        Row: {
          id: string;
          user_id: string;
          health_source_id: string;
          metric: HealthMetric;
          value: number;
          unit: string;
          recorded_at: string;
          external_record_id: string;
          origin_name: string | null;
          device_name: string | null;
          metadata: Json;
          imported_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          health_source_id: string;
          metric: HealthMetric;
          value: number;
          unit: string;
          recorded_at: string;
          external_record_id: string;
          origin_name?: string | null;
          device_name?: string | null;
          metadata?: Json;
          imported_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["health_observations"]["Insert"]>;
        Relationships: [];
      };
      health_sync_runs: {
        Row: {
          id: string;
          user_id: string;
          health_source_id: string;
          status: HealthSyncStatus;
          records_read: number;
          records_imported: number;
          error_code: string | null;
          started_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          health_source_id: string;
          status: HealthSyncStatus;
          records_read?: number;
          records_imported?: number;
          error_code?: string | null;
          started_at?: string;
          finished_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["health_sync_runs"]["Insert"]>;
        Relationships: [];
      };
      training_profiles: {
        Row: {
          id: string;
          user_id: string;
          preferred_categories: string[];
          session_duration_minutes: number;
          location: TrainingLocation;
          intensity_preference: TrainingIntensity;
          variety_preference: TrainingVarietyPreference;
          physical_limitations: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          preferred_categories?: string[];
          session_duration_minutes?: number;
          location?: TrainingLocation;
          intensity_preference?: TrainingIntensity;
          variety_preference?: TrainingVarietyPreference;
          physical_limitations?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["training_profiles"]["Insert"]>;
        Relationships: [];
      };
      workout_sessions: {
        Row: {
          id: string;
          name: string;
          workout_type_id: TrainingCategoryId;
          duration_minutes: number;
          location: TrainingLocation;
          intensity: TrainingIntensity;
          equipment: string[];
          structure: string;
          safety_note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          workout_type_id: TrainingCategoryId;
          duration_minutes: number;
          location?: TrainingLocation;
          intensity?: TrainingIntensity;
          equipment?: string[];
          structure?: string;
          safety_note?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workout_sessions"]["Insert"]>;
        Relationships: [];
      };
      training_plans: {
        Row: {
          id: string;
          user_id: string;
          week_start: string;
          status: TrainingPlanStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_start: string;
          status?: TrainingPlanStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["training_plans"]["Insert"]>;
        Relationships: [];
      };
      training_plan_items: {
        Row: {
          id: string;
          user_id: string;
          training_plan_id: string;
          day_date: string;
          session_id: string;
          status: TrainingPlanItemStatus;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          training_plan_id: string;
          day_date: string;
          session_id: string;
          status?: TrainingPlanItemStatus;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["training_plan_items"]["Insert"]>;
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
      set_meal_plan_item_status: {
        Args: {
          p_meal_plan_item_id: string;
          p_status: MealPlanItemStatus;
        };
        Returns: Database["public"]["Tables"]["meal_plan_items"]["Row"];
      };
      set_training_plan_item_status: {
        Args: {
          p_training_plan_item_id: string;
          p_status: TrainingPlanItemStatus;
        };
        Returns: Database["public"]["Tables"]["training_plan_items"]["Row"];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
