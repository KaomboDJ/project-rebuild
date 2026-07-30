import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { MUTATING_TOOLS, READ_ONLY_TOOLS, type ToolCall, type ToolName } from "./types";

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

// --- Read-only tools: executed immediately, result fed back to the model. ---

export async function executeReadOnlyTool(
  supabase: Supabase,
  userId: string,
  name: ToolName,
  args: Record<string, unknown>
): Promise<unknown> {
  if (name === "get_inventory") {
    const category = typeof args.category === "string" ? args.category : undefined;
    let query = supabase.from("pantry_items").select("*").eq("user_id", userId).order("name");
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
    case "record_meal":
      return `Registar refeição${args.meal ? ` (${args.meal})` : ""} com ${Array.isArray(args.items) ? args.items.length : 0} item(ns)`;
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

  throw new Error(`Tool ${name} não implementada.`);
}
