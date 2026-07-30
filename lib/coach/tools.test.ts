import { describe, expect, it } from "vitest";
import { buildToolCallProposal, isKnownTool } from "./tools";

describe("isKnownTool", () => {
  it("recognizes all 7 pantry/shopping tool names", () => {
    const names = [
      "get_inventory",
      "suggest_available_meal",
      "consume_item",
      "adjust_inventory",
      "add_to_shopping_list",
      "mark_item_purchased",
      "record_meal",
      "get_week_plan",
      "generate_week_plan",
      "replace_meal",
      "mark_meal_eaten",
    ];
    for (const name of names) expect(isKnownTool(name)).toBe(true);
  });

  it("rejects an unrecognized tool name", () => {
    expect(isKnownTool("delete_everything")).toBe(false);
  });
});

describe("buildToolCallProposal - read-only tools", () => {
  it("marks get_inventory as already executed (nothing for the user to confirm)", () => {
    const call = buildToolCallProposal({ id: "t1", name: "get_inventory", input: {} });
    expect(call.status).toBe("executed");
  });

  it("marks suggest_available_meal as already executed", () => {
    const call = buildToolCallProposal({ id: "t2", name: "suggest_available_meal", input: { day_type: "home" } });
    expect(call.status).toBe("executed");
  });
});

describe("buildToolCallProposal - mutating tools require confirmation", () => {
  it("marks consume_item as proposed, never executed directly", () => {
    const call = buildToolCallProposal({ id: "t3", name: "consume_item", input: { name: "bananas", quantity: 2 } });
    expect(call.status).toBe("proposed");
  });

  it("summarizes consume_item with the quantity and item name", () => {
    const call = buildToolCallProposal({ id: "t3", name: "consume_item", input: { name: "bananas", quantity: 2 } });
    expect(call.summary).toContain("2");
    expect(call.summary).toContain("bananas");
  });

  it("summarizes adjust_inventory with the target quantity", () => {
    const call = buildToolCallProposal({ id: "t4", name: "adjust_inventory", input: { name: "arroz", new_quantity: 3 } });
    expect(call.summary).toContain("arroz");
    expect(call.summary).toContain("3");
  });

  it("summarizes add_to_shopping_list with the item name", () => {
    const call = buildToolCallProposal({ id: "t5", name: "add_to_shopping_list", input: { name: "leite" } });
    expect(call.summary).toContain("leite");
  });

  it("summarizes mark_item_purchased with the item name", () => {
    const call = buildToolCallProposal({ id: "t6", name: "mark_item_purchased", input: { name: "ovos" } });
    expect(call.summary).toContain("ovos");
  });

  it("summarizes record_meal with the item count", () => {
    const call = buildToolCallProposal({
      id: "t7",
      name: "record_meal",
      input: { meal: "lunch", items: [{ name: "arroz", quantity: 1 }, { name: "frango", quantity: 1 }] },
    });
    expect(call.summary).toContain("2");
    expect(call.summary).toContain("lunch");
  });

  it("preserves the raw args on the proposal for later execution after confirmation", () => {
    const call = buildToolCallProposal({ id: "t8", name: "adjust_inventory", input: { pantry_item_id: "abc", new_quantity: 5 } });
    expect(call.args).toEqual({ pantry_item_id: "abc", new_quantity: 5 });
  });
});

describe("buildToolCallProposal - Milestone 12 nutrition-plan tools", () => {
  it("marks get_week_plan as already executed (read-only)", () => {
    const call = buildToolCallProposal({ id: "t9", name: "get_week_plan", input: {} });
    expect(call.status).toBe("executed");
  });

  it("marks generate_week_plan as proposed, never executed directly", () => {
    const call = buildToolCallProposal({ id: "t10", name: "generate_week_plan", input: {} });
    expect(call.status).toBe("proposed");
  });

  it("summarizes replace_meal with the day and slot", () => {
    const call = buildToolCallProposal({ id: "t11", name: "replace_meal", input: { day_date: "2026-08-03", meal_slot: "dinner" } });
    expect(call.summary).toContain("dinner");
    expect(call.summary).toContain("2026-08-03");
    expect(call.status).toBe("proposed");
  });

  it("summarizes mark_meal_eaten with the day and slot", () => {
    const call = buildToolCallProposal({ id: "t12", name: "mark_meal_eaten", input: { day_date: "2026-08-03", meal_slot: "lunch" } });
    expect(call.summary).toContain("lunch");
    expect(call.status).toBe("proposed");
  });
});
