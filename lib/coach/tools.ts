import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { MUTATING_TOOLS, READ_ONLY_TOOLS, type ToolCall, type ToolName } from "./types";
import { pluralizePt } from "@/lib/format/pluralize";
import { getFounderNow } from "@/lib/date/founder-now";
import { getWeekRange } from "@/lib/date/ranges";
import { generateWeekPlan, suggestReplacement } from "@/lib/nutrition/planner";
import {
  completeMealPlanItem,
  getNutritionProfile,
  getPantryStockLines,
  getPreferredTrainingDays,
  getWeekPlan,
  listRecipesWithIngredients,
  replaceMealPlanItem,
  saveWeekPlan,
  toPlanResponse,
  type MealPlanItemRow,
} from "@/lib/nutrition/queries";
import { generateWeekTrainingPlan, suggestTrainingReplacement } from "@/lib/training/planner";
import {
  completeTrainingPlanItem,
  getTrainingCategoryByDateForWeek,
  getTrainingProfile,
  getWeekTrainingPlan,
  listWorkoutSessions,
  replaceTrainingPlanItem,
  saveWeekTrainingPlan,
  toTrainingPlanResponse,
  type TrainingPlanItemRow,
} from "@/lib/training/queries";

type Supabase = SupabaseClient<Database>;
type PantryItem = Database["public"]["Tables"]["pantry_items"]["Row"];

/**
 * Anthropic tool definitions for the 7 pantry/shopping actions the founder
 * specified (Part 3). Kept in one place so lib/ai/provider.ts doesn't need
 * to know the pantry schema, and so app/api/coach/tools/confirm/route.ts and
 * this file share the same argument contracts.
 */
export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "get_inventory",
    description:
      "Lista os itens da despensa do utilizador, com quantidade atual, unidade, se é portátil (bom para levar para o trabalho) e se está perto de expirar. Usa antes de sugerir refeições ou responder a perguntas sobre o que existe em casa.",
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["produce", "protein", "dairy", "grain", "pantry", "frozen", "beverage", "other"],
          description: "Filtra por categoria. Omite para listar tudo.",
        },
      },
    },
  },
  {
    name: "suggest_available_meal",
    description:
      "Devolve os itens da despensa mais adequados para uma refeição, tendo em conta se o dia é de trabalho em casa ou fora, e priorizando itens perto de expirar. Não decide a refeição por ti — devolve candidatos para tu reconheceres a melhor combinação na tua resposta.",
    input_schema: {
      type: "object",
      properties: {
        day_type: { type: "string", enum: ["home", "office"] },
        meal: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
      },
    },
  },
  {
    name: "consume_item",
    description:
      "PROPÕE registar que uma certa quantidade de um item foi consumida (não vai para o lixo). Nunca executes sem confirmação explícita do utilizador — isto só cria uma proposta que o utilizador tem de confirmar na interface.",
    input_schema: {
      type: "object",
      properties: {
        pantry_item_id: { type: "string" },
        name: { type: "string", description: "Nome do item, se não souberes o id (ex.: 'bananas')." },
        quantity: { type: "number", description: "Quantidade consumida, sempre positiva." },
      },
      required: ["quantity"],
    },
  },
  {
    name: "adjust_inventory",
    description:
      "PROPÕE corrigir a quantidade registada de um item para o valor real observado pelo utilizador (ex.: 'só tenho 2 bananas, não 5'). Requer confirmação explícita.",
    input_schema: {
      type: "object",
      properties: {
        pantry_item_id: { type: "string" },
        name: { type: "string" },
        new_quantity: { type: "number", description: "Nova quantidade total, >= 0." },
      },
      required: ["new_quantity"],
    },
  },
  {
    name: "add_to_shopping_list",
    description: "PROPÕE adicionar um item à lista de compras aberta. Requer confirmação explícita.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        quantity: { type: "number" },
        unit: { type: "string", enum: ["unidade", "g", "kg", "ml", "l"] },
      },
      required: ["name"],
    },
  },
  {
    name: "mark_item_purchased",
    description:
      "PROPÕE marcar um item da lista de compras como comprado, o que o adiciona (ou soma) à despensa. Requer confirmação explícita.",
    input_schema: {
      type: "object",
      properties: {
        shopping_list_item_id: { type: "string" },
        name: { type: "string" },
        actual_quantity: { type: "number" },
      },
    },
  },
  {
    name: "record_meal",
    description:
      "PROPÕE registar que uma refeição foi feita, consumindo vários itens da despensa de uma vez. Requer confirmação explícita.",
    input_schema: {
      type: "object",
      properties: {
        meal: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              pantry_item_id: { type: "string" },
              name: { type: "string" },
              quantity: { type: "number" },
            },
            required: ["quantity"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "get_week_plan",
    description:
      "Lista o plano de refeições da semana atual do utilizador (Milestone 12 — Nutrition Toolkit), com receitas, macros estimadas e estado (planeado/comido/saltado). Usa antes de responder a perguntas como 'o que é que tenho para o jantar hoje' ou 'qual é o plano desta semana'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "generate_week_plan",
    description:
      "PROPÕE gerar (ou substituir) o plano de refeições das próximas 7 dias com base no perfil de alimentação do utilizador (objetivo, estilo alimentar, alergias, tempo de cozinha, etc.). Substitui qualquer plano já existente para essa semana. Requer confirmação explícita.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "replace_meal",
    description:
      "PROPÕE substituir uma refeição planeada por uma alternativa da mesma categoria (mesmo tipo de refeição, calorias semelhantes). Identifica a refeição por data e tipo de refeição. Requer confirmação explícita.",
    input_schema: {
      type: "object",
      properties: {
        day_date: { type: "string", description: "Data no formato YYYY-MM-DD." },
        meal_slot: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
      },
      required: ["day_date", "meal_slot"],
    },
  },
  {
    name: "mark_meal_eaten",
    description:
      "PROPÕE marcar uma refeição planeada como feita, o que consome automaticamente os ingredientes correspondentes da despensa quando existirem. Requer confirmação explícita.",
    input_schema: {
      type: "object",
      properties: {
        day_date: { type: "string", description: "Data no formato YYYY-MM-DD." },
        meal_slot: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
      },
      required: ["day_date", "meal_slot"],
    },
  },
  {
    name: "get_week_training_plan",
    description:
      "Lista o plano de treino da semana atual do utilizador (Training Toolkit), com sessões, categoria, duração e estado (planeado/feito/saltado). Usa antes de responder a perguntas como 'o que é que tenho para treinar hoje' ou 'qual é o plano de treino desta semana'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "generate_week_training_plan",
    description:
      "PROPÕE gerar (ou substituir) o plano de treino das próximas 7 dias com base no perfil de treino do utilizador (categorias preferidas, duração da sessão, local, intensidade) e nos dias de treino habituais já configurados. Substitui qualquer plano já existente para essa semana. Requer confirmação explícita.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "replace_session",
    description:
      "PROPÕE substituir uma sessão de treino planeada por uma alternativa que respeite o perfil de treino do utilizador. Identifica a sessão pela data. Requer confirmação explícita.",
    input_schema: {
      type: "object",
      properties: {
        day_date: { type: "string", description: "Data no formato YYYY-MM-DD." },
      },
      required: ["day_date"],
    },
  },
  {
    name: "mark_session_done",
    description:
      "PROPÕE marcar uma sessão de treino planeada como feita ou saltada. Requer confirmação explícita.",
    input_schema: {
      type: "object",
      properties: {
        day_date: { type: "string", description: "Data no formato YYYY-MM-DD." },
        status: { type: "string", enum: ["done", "skipped"] },
      },
      required: ["day_date", "status"],
    },
  },
  {
    name: "update_profile_notes",
    description:
      "PROPÕE guardar no perfil (Definições) informação pessoal que o utilizador partilhou na conversa e que ainda não está guardada - identidade atual, restrições/responsabilidades da vida, ou tom de comunicação preferido. Usa isto quando o utilizador contar algo relevante espontaneamente, para não teres de lhe perguntar outra vez da próxima vez. Nunca interrogues o utilizador sobre estes campos sem ele tocar no assunto primeiro, e nunca proponhas isto mais do que uma vez por conversa. Requer confirmação explícita. Só inclui os campos que o utilizador realmente partilhou - nunca inventes ou completes os outros.",
    input_schema: {
      type: "object",
      properties: {
        current_identity: { type: "string", description: "Ex.: 'ex-atleta, rotina interrompida, sono irregular'." },
        current_constraints: { type: "string", description: "Ex.: 'trabalho exigente, filho pequeno, sono interrompido'." },
        intervention_tone: { type: "string", description: "Ex.: 'direto, sem lição de moral'." },
      },
    },
  },
];

export function isKnownTool(name: string): name is ToolName {
  return READ_ONLY_TOOLS.has(name as ToolName) || MUTATING_TOOLS.has(name as ToolName);
}

async function resolvePantryItem(
  supabase: Supabase,
  args: { pantry_item_id?: unknown; name?: unknown }
): Promise<PantryItem> {
  if (typeof args.pantry_item_id === "string" && args.pantry_item_id) {
    const { data } = await supabase.from("pantry_items").select("*").eq("id", args.pantry_item_id).maybeSingle();
    if (!data) throw new Error(`Item com id ${args.pantry_item_id} não encontrado na despensa.`);
    return data;
  }
  if (typeof args.name === "string" && args.name.trim()) {
    const { data } = await supabase.from("pantry_items").select("*").ilike("name", `%${args.name.trim()}%`);
    if (!data || data.length === 0) throw new Error(`Não encontrei "${args.name}" na despensa.`);
    if (data.length > 1) {
      const names = data.map((item) => item.name).join(", ");
      throw new Error(`Encontrei mais do que um item para "${args.name}": ${names}. Pede ao utilizador para especificar.`);
    }
    return data[0];
  }
  throw new Error("É necessário indicar pantry_item_id ou name.");
}

/** Resolves a meal_plan_items row from the (day_date, meal_slot) pair the
 * model supplies — there's no id for it to reference, unlike pantry items,
 * since the founder never sees raw ids for plan slots either. */
async function resolveMealPlanItem(
  supabase: Supabase,
  userId: string,
  args: { day_date?: unknown; meal_slot?: unknown }
): Promise<MealPlanItemRow> {
  const dayDate = typeof args.day_date === "string" ? args.day_date : undefined;
  const mealSlot = typeof args.meal_slot === "string" ? args.meal_slot : undefined;
  if (!dayDate || !mealSlot) throw new Error("É necessário indicar day_date e meal_slot.");

  const { data, error } = await supabase
    .from("meal_plan_items")
    .select("*")
    .eq("user_id", userId)
    .eq("day_date", dayDate)
    .eq("meal_slot", mealSlot as MealPlanItemRow["meal_slot"])
    .maybeSingle();
  if (error) throw new Error("Falha ao ler o plano de refeições.");
  if (!data) throw new Error(`Não encontrei nenhuma refeição planeada para ${mealSlot} em ${dayDate}.`);
  return data;
}

/** Resolves a training_plan_items row from the day_date the model supplies
 * — one planned session per day, so unlike meals there's no second key
 * needed (mirrors resolveMealPlanItem above). */
async function resolveTrainingPlanItem(
  supabase: Supabase,
  userId: string,
  args: { day_date?: unknown }
): Promise<TrainingPlanItemRow> {
  const dayDate = typeof args.day_date === "string" ? args.day_date : undefined;
  if (!dayDate) throw new Error("É necessário indicar day_date.");

  const { data, error } = await supabase
    .from("training_plan_items")
    .select("*")
    .eq("user_id", userId)
    .eq("day_date", dayDate)
    .maybeSingle();
  if (error) throw new Error("Falha ao ler o plano de treino.");
  if (!data) throw new Error(`Não encontrei nenhuma sessão de treino planeada para ${dayDate}.`);
  return data;
}

// --- Read-only tools: executed immediately, result fed back to the model. ---

export async function executeReadOnlyTool(
  supabase: Supabase,
  userId: string,
  name: ToolName,
  args: Record<string, unknown>
): Promise<unknown> {
  if (name === "get_inventory") {
    // UX Hardening release (docs/17_UX_AUDIT.md, N2 - confirmed P1): this
    // previously returned every pantry_items row including ones at quantity
    // 0, while buildPantrySummary (the system-prompt context) and
    // suggest_available_meal below both already filtered to quantity > 0 -
    // so the model could call this tool and describe a zero-stock item as
    // "in the pantry". The Coach must only ever ground recommendations in
    // currently usable stock (lib/pantry/selectors.ts's countAvailable is
    // the same selector), so this now matches the other two read paths.
    const category = typeof args.category === "string" ? args.category : undefined;
    let query = supabase.from("pantry_items").select("*").eq("user_id", userId).gt("quantity", 0).order("name");
    if (category) query = query.eq("category", category as PantryItem["category"]);
    const { data, error } = await query;
    if (error) throw new Error("Falha ao ler a despensa.");
    return { items: data ?? [] };
  }

  if (name === "suggest_available_meal") {
    const dayType = args.day_type === "office" ? "office" : args.day_type === "home" ? "home" : undefined;
    const { data, error } = await supabase
      .from("pantry_items")
      .select("*")
      .eq("user_id", userId)
      .gt("quantity", 0)
      .order("expires_on", { ascending: true, nullsFirst: false });
    if (error) throw new Error("Falha ao ler a despensa.");
    const items = (data ?? []).filter((item) => (dayType === "office" ? item.portable : true));
    return { day_type: dayType ?? "unknown", candidates: items };
  }

  if (name === "get_week_plan") {
    const { date } = await getFounderNow(supabase, userId);
    const weekStart = getWeekRange(date).start;
    const planWithItems = await getWeekPlan(supabase, userId, weekStart);
    const response = await toPlanResponse(supabase, planWithItems);
    return { weekStart, ...response };
  }

  if (name === "get_week_training_plan") {
    const { date } = await getFounderNow(supabase, userId);
    const weekStart = getWeekRange(date).start;
    const planWithItems = await getWeekTrainingPlan(supabase, userId, weekStart);
    const response = await toTrainingPlanResponse(supabase, planWithItems);
    return { weekStart, ...response };
  }

  throw new Error(`${name} não é uma tool de leitura.`);
}

// --- Proposal builders: turn a model tool_use block into a ToolCall the
// user must confirm, without touching the database. ---

const quantitySchema = z.coerce.number().positive();

function summarize(name: ToolName, args: Record<string, unknown>): string {
  switch (name) {
    case "consume_item":
      return `Registar consumo de ${args.quantity ?? "?"} ${args.name ? `de ${args.name}` : "do item"}`;
    case "adjust_inventory":
      return `Corrigir quantidade${args.name ? ` de ${args.name}` : ""} para ${args.new_quantity ?? "?"}`;
    case "add_to_shopping_list":
      return `Adicionar "${args.name ?? "item"}" à lista de compras`;
    case "mark_item_purchased":
      return `Marcar "${args.name ?? "item"}" como comprado`;
    case "record_meal": {
      const count = Array.isArray(args.items) ? args.items.length : 0;
      return `Registar refeição${args.meal ? ` (${args.meal})` : ""} com ${pluralizePt(count, "item", "itens")}`;
    }
    case "generate_week_plan":
      return "Gerar (ou substituir) o plano de refeições da semana";
    case "replace_meal":
      return `Substituir ${args.meal_slot ?? "refeição"} de ${args.day_date ?? "?"} por uma alternativa`;
    case "mark_meal_eaten":
      return `Marcar ${args.meal_slot ?? "refeição"} de ${args.day_date ?? "?"} como feita`;
    case "generate_week_training_plan":
      return "Gerar (ou substituir) o plano de treino da semana";
    case "replace_session":
      return `Substituir a sessão de treino de ${args.day_date ?? "?"} por uma alternativa`;
    case "mark_session_done":
      return `Marcar a sessão de treino de ${args.day_date ?? "?"} como ${args.status === "skipped" ? "saltada" : "feita"}`;
    case "update_profile_notes":
      return "Guardar no perfil o que partilhaste agora (Definições)";
    default:
      return `Executar ${name}`;
  }
}

export function buildToolCallProposal(block: { id: string; name: string; input: unknown }): ToolCall {
  const name = block.name as ToolName;
  const args = (block.input && typeof block.input === "object" ? block.input : {}) as Record<string, unknown>;
  return {
    id: block.id,
    name,
    args,
    status: READ_ONLY_TOOLS.has(name) ? "executed" : "proposed",
    summary: summarize(name, args),
  };
}

// --- Mutating tools: only ever called from
// app/api/coach/tools/confirm/route.ts after explicit user confirmation. ---

export async function executeMutatingTool(
  supabase: Supabase,
  userId: string,
  name: ToolName,
  args: Record<string, unknown>
): Promise<unknown> {
  if (!MUTATING_TOOLS.has(name)) {
    throw new Error(`${name} não é uma tool mutável.`);
  }

  if (name === "consume_item") {
    const quantity = quantitySchema.parse(args.quantity);
    const item = await resolvePantryItem(supabase, args);
    const { data, error } = await supabase.rpc("apply_inventory_event", {
      p_pantry_item_id: item.id,
      p_event_type: "consume",
      p_quantity_delta: -quantity,
      p_source: "coach",
      p_note: "Consumo registado via Coach",
    });
    if (error) throw new Error(error.message);
    return { item: item.name, event: data };
  }

  if (name === "adjust_inventory") {
    const newQuantity = z.coerce.number().min(0).parse(args.new_quantity);
    const item = await resolvePantryItem(supabase, args);
    const delta = newQuantity - Number(item.quantity);
    if (delta === 0) return { item: item.name, unchanged: true };
    const { data, error } = await supabase.rpc("apply_inventory_event", {
      p_pantry_item_id: item.id,
      p_event_type: "adjust",
      p_quantity_delta: delta,
      p_source: "coach",
      p_note: "Ajuste registado via Coach",
    });
    if (error) throw new Error(error.message);
    return { item: item.name, event: data };
  }

  if (name === "add_to_shopping_list") {
    const nameArg = z.string().min(1).parse(args.name);
    const quantity = args.quantity !== undefined ? quantitySchema.parse(args.quantity) : 1;
    const unit = typeof args.unit === "string" ? args.unit : "unidade";

    let { data: list } = await supabase
      .from("shopping_lists")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!list) {
      const { data: created, error: createError } = await supabase
        .from("shopping_lists")
        .insert({ user_id: userId })
        .select("id")
        .single();
      if (createError || !created) throw new Error("Falha ao criar lista de compras.");
      list = created;
    }

    const { data, error } = await supabase
      .from("shopping_list_items")
      .insert({
        user_id: userId,
        shopping_list_id: list.id,
        name: nameArg,
        quantity,
        unit: unit as PantryItem["unit"],
        // Coach-added lines are never touched by
        // generateShoppingListForPlan's delete-before-reinsert (scoped to
        // source = 'meal_plan' only) - same protection manual additions get.
        source: "coach",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { item: data };
  }

  if (name === "mark_item_purchased") {
    let itemId = typeof args.shopping_list_item_id === "string" ? args.shopping_list_item_id : undefined;
    if (!itemId && typeof args.name === "string") {
      const { data } = await supabase
        .from("shopping_list_items")
        .select("id")
        .eq("user_id", userId)
        .eq("purchased", false)
        .ilike("name", `%${args.name}%`)
        .limit(1)
        .maybeSingle();
      itemId = data?.id;
    }
    if (!itemId) throw new Error("Não encontrei esse item na lista de compras.");

    const actualQuantity = args.actual_quantity !== undefined ? quantitySchema.parse(args.actual_quantity) : null;
    const { data, error } = await supabase.rpc("mark_shopping_item_purchased", {
      p_shopping_list_item_id: itemId,
      p_actual_quantity: actualQuantity,
    });
    if (error) throw new Error(error.message);
    return { item: data };
  }

  if (name === "record_meal") {
    const items = z
      .array(
        z.object({
          pantry_item_id: z.string().optional(),
          name: z.string().optional(),
          quantity: z.coerce.number().positive(),
        })
      )
      .min(1)
      .parse(args.items);

    const results: unknown[] = [];
    for (const line of items) {
      const item = await resolvePantryItem(supabase, line);
      const { data, error } = await supabase.rpc("apply_inventory_event", {
        p_pantry_item_id: item.id,
        p_event_type: "consume",
        p_quantity_delta: -line.quantity,
        p_source: "coach",
        p_note: typeof args.meal === "string" ? `Refeição: ${args.meal}` : "Refeição registada via Coach",
      });
      if (error) throw new Error(error.message);
      results.push({ item: item.name, event: data });
    }
    return { meal: args.meal ?? null, consumed: results };
  }

  if (name === "generate_week_plan") {
    const { date } = await getFounderNow(supabase, userId);
    const weekStart = getWeekRange(date).start;
    const [profile, recipes, trainingDaysOfWeek, pantryStock, trainingCategoryByDate] = await Promise.all([
      getNutritionProfile(supabase, userId),
      listRecipesWithIngredients(supabase),
      getPreferredTrainingDays(supabase, userId),
      getPantryStockLines(supabase, userId),
      getTrainingCategoryByDateForWeek(supabase, userId, weekStart),
    ]);
    const result = generateWeekPlan({ weekStart, profile, recipes, trainingDaysOfWeek, pantryStock, trainingCategoryByDate });
    const planWithItems = await saveWeekPlan(supabase, userId, result);
    const response = await toPlanResponse(supabase, planWithItems, {
      profile,
      trainingDaysOfWeek,
      pantryStock,
      trainingCategoryByDate,
    });
    return { weekStart, limitedVariety: result.limitedVariety, ...response };
  }

  if (name === "replace_meal") {
    const current = await resolveMealPlanItem(supabase, userId, args);
    const [profile, recipes] = await Promise.all([getNutritionProfile(supabase, userId), listRecipesWithIngredients(supabase)]);
    const suggestion = suggestReplacement(recipes, current.meal_slot, profile, current.recipe_id);
    if (!suggestion) throw new Error("Não encontrei nenhuma alternativa adequada na biblioteca de receitas.");
    const item = await replaceMealPlanItem(supabase, userId, current.id, suggestion.id);
    return { item, newRecipe: suggestion.name };
  }

  if (name === "mark_meal_eaten") {
    const current = await resolveMealPlanItem(supabase, userId, args);
    const result = await completeMealPlanItem(supabase, userId, current.id, "eaten");
    return { item: result.item, consumedIngredients: result.consumedIngredients };
  }

  if (name === "generate_week_training_plan") {
    const { date } = await getFounderNow(supabase, userId);
    const weekStart = getWeekRange(date).start;
    const [profile, sessions, trainingDaysOfWeek, existing] = await Promise.all([
      getTrainingProfile(supabase, userId),
      listWorkoutSessions(supabase),
      getPreferredTrainingDays(supabase, userId),
      getWeekTrainingPlan(supabase, userId, weekStart),
    ]);
    const carryOverSessionIds = (existing?.items ?? []).map((i) => i.session_id);
    const result = generateWeekTrainingPlan({ weekStart, profile, sessions, trainingDaysOfWeek, carryOverSessionIds });
    if (result.blockedByPhysicalLimitations) {
      throw new Error("A geração automática está pausada porque existe uma limitação física no perfil. Revê-a com um profissional antes de gerar um plano.");
    }
    const planWithItems = await saveWeekTrainingPlan(supabase, userId, result);
    const response = await toTrainingPlanResponse(supabase, planWithItems, { profile });
    return { weekStart, limitedVariety: result.limitedVariety, ...response };
  }

  if (name === "replace_session") {
    const current = await resolveTrainingPlanItem(supabase, userId, args);
    const [profile, sessions] = await Promise.all([getTrainingProfile(supabase, userId), listWorkoutSessions(supabase)]);
    const suggestion = suggestTrainingReplacement(sessions, profile, current.session_id);
    if (!suggestion) throw new Error("Não encontrei nenhuma alternativa adequada na biblioteca de sessões.");
    const item = await replaceTrainingPlanItem(supabase, userId, current.id, suggestion.id);
    return { item, newSession: suggestion.name };
  }

  if (name === "mark_session_done") {
    const current = await resolveTrainingPlanItem(supabase, userId, args);
    const status = args.status === "skipped" ? "skipped" : "done";
    const item = await completeTrainingPlanItem(supabase, userId, current.id, status);
    return { item };
  }

  if (name === "update_profile_notes") {
    const update: { current_identity?: string; current_constraints?: string; intervention_tone?: string } = {};
    if (typeof args.current_identity === "string" && args.current_identity.trim()) {
      update.current_identity = args.current_identity.trim().slice(0, 500);
    }
    if (typeof args.current_constraints === "string" && args.current_constraints.trim()) {
      update.current_constraints = args.current_constraints.trim().slice(0, 1000);
    }
    if (typeof args.intervention_tone === "string" && args.intervention_tone.trim()) {
      update.intervention_tone = args.intervention_tone.trim().slice(0, 300);
    }
    if (Object.keys(update).length === 0) {
      throw new Error("Nada para guardar - indica pelo menos um campo.");
    }
    const { data, error } = await supabase.from("profiles").update(update).eq("user_id", userId).select("*").single();
    if (error || !data) throw new Error(error?.message ?? "Falha ao guardar o perfil.");
    return { updatedFields: Object.keys(update) };
  }

  throw new Error(`Tool ${name} não implementada.`);
}
