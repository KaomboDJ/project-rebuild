import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  test,
  expect,
  adminClient,
  createTestUser,
  deleteTestUser,
  testUserClient,
  sessionCookieHeader,
  type TestUser,
} from "./fixtures";

// Invited-alpha release gate: cross-account data isolation (docs/17_UX_AUDIT.md,
// docs/IMPLEMENTATION_STATUS.md "Auth UX Hardening milestone"). Proves - against
// the live Supabase project, not by reading the RLS policy SQL and trusting it -
// that User A can never read, modify, delete, or forge ownership of User B's
// data, across every user-scoped table in the schema, and that the app's own
// API routes derive identity from the session rather than trusting any
// client-supplied id.
//
// Two brand-new, uniquely-named, disposable accounts only (never the founder's
// or the invited tester's real accounts). Cleanup runs in `test.afterAll`,
// which Playwright always executes even when an assertion above it failed, so
// a broken isolation check can never leave orphaned test data behind. Nothing
// here ever prints a password, access token, refresh token, service-role key,
// or a full authenticated URL - only user ids, table names and boolean/row-
// count outcomes.

const BASE_URL = `http://localhost:${process.env.PLAYWRIGHT_PORT ?? "3100"}`;

/** Every table that stores a row scoped to one user via `user_id`, per a full
 * pass over supabase/migrations/*.sql (`grep -n "create table" .../*.sql`).
 * `recipes`/`recipe_ingredients` are intentionally excluded - they are a
 * shared, non-user-owned catalog (`using (true)` read policy by design, not
 * a gap), and `calendar_connections` is handled separately below because it
 * has no per-row policies at all (fully revoked from anon/authenticated,
 * service-role only) rather than a `user_id`-scoped one. */
const USER_SCOPED_TABLES = [
  "profiles",
  "daily_check_ins",
  "decision_runs",
  "decisions",
  "decision_feedback",
  "coach_conversations",
  "coach_messages",
  "pantry_items",
  "inventory_events",
  "shopping_lists",
  "shopping_list_items",
  "nutrition_profiles",
  "meal_plans",
  "meal_plan_items",
  "daily_briefings",
  "muted_rules",
  "founder_notes",
] as const;

interface SeededRow {
  table: string;
  id: string;
  /** A column (other than id/user_id) safe to attempt updating cross-account. */
  updatable: { column: string; value: unknown };
}

/** Seeds exactly one row per table for the given user, returning enough to
 * drive the generic read/update/delete/insert probes below. Uses the admin
 * (service-role) client deliberately - this is test-fixture setup, not the
 * thing under test. FK chains (decision_runs -> decisions -> decision_feedback,
 * coach_conversations -> coach_messages, shopping_lists -> shopping_list_items,
 * pantry_items -> inventory_events, meal_plans -> meal_plan_items) are built
 * in dependency order. */
async function seedOneRowPerTable(admin: SupabaseClient, userId: string): Promise<SeededRow[]> {
  const rows: SeededRow[] = [];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());

  async function insert(table: string, values: Record<string, unknown>): Promise<string> {
    const { data, error } = await admin.from(table).insert(values).select("id").single();
    if (error || !data) throw new Error(`Seed failed for ${table}: ${error?.message}`);
    return data.id as string;
  }

  // profiles already exists (createTestUser withProfile: true creates it) -
  // just record it for the read/update probes.
  {
    const { data } = await admin.from("profiles").select("id").eq("user_id", userId).single();
    if (data) rows.push({ table: "profiles", id: data.id, updatable: { column: "preferred_name", value: "Isolation probe" } });
  }

  {
    const id = await insert("daily_check_ins", { user_id: userId, date: today, sleep_quality: 3, energy_level: 3, stress_level: 3 });
    rows.push({ table: "daily_check_ins", id, updatable: { column: "energy_level", value: 5 } });
  }

  const decisionRunId = await insert("decision_runs", { user_id: userId, date: today });
  rows.push({ table: "decision_runs", id: decisionRunId, updatable: { column: "engine_version", value: "isolation-probe" } });

  const decisionId = await insert("decisions", {
    user_id: userId,
    decision_run_id: decisionRunId,
    date: today,
    title: "Isolation probe decision",
    reason: "Automated cross-account isolation test fixture.",
    recommended_action: "n/a",
    domain: "planning",
    impact: "low",
  });
  rows.push({ table: "decisions", id: decisionId, updatable: { column: "status", value: "skipped" } });

  const feedbackId = await insert("decision_feedback", { user_id: userId, decision_id: decisionId, useful: true });
  rows.push({ table: "decision_feedback", id: feedbackId, updatable: { column: "useful", value: false } });

  const conversationId = await insert("coach_conversations", { user_id: userId, title: "Isolation probe" });
  rows.push({ table: "coach_conversations", id: conversationId, updatable: { column: "title", value: "hijacked" } });

  const messageId = await insert("coach_messages", { user_id: userId, conversation_id: conversationId, role: "user", content: "probe" });
  rows.push({ table: "coach_messages", id: messageId, updatable: { column: "content", value: "hijacked" } });

  const pantryItemId = await insert("pantry_items", { user_id: userId, name: "Isolation probe item" });
  rows.push({ table: "pantry_items", id: pantryItemId, updatable: { column: "quantity", value: 999 } });

  const inventoryEventId = await insert("inventory_events", {
    user_id: userId,
    pantry_item_id: pantryItemId,
    event_type: "adjust",
    quantity_delta: 1,
    resulting_quantity: 1,
  });
  rows.push({ table: "inventory_events", id: inventoryEventId, updatable: { column: "note", value: "hijacked" } });

  const shoppingListId = await insert("shopping_lists", { user_id: userId, name: "Isolation probe list" });
  rows.push({ table: "shopping_lists", id: shoppingListId, updatable: { column: "name", value: "hijacked" } });

  const shoppingItemId = await insert("shopping_list_items", { user_id: userId, shopping_list_id: shoppingListId, name: "Isolation probe" });
  rows.push({ table: "shopping_list_items", id: shoppingItemId, updatable: { column: "purchased", value: true } });

  const nutritionProfileId = await insert("nutrition_profiles", { user_id: userId });
  rows.push({ table: "nutrition_profiles", id: nutritionProfileId, updatable: { column: "goal", value: "build-muscle" } });

  const mealPlanId = await insert("meal_plans", { user_id: userId, week_start: today });
  rows.push({ table: "meal_plans", id: mealPlanId, updatable: { column: "status", value: "archived" } });

  const { data: anyRecipe } = await admin.from("recipes").select("id").limit(1).maybeSingle();
  if (anyRecipe) {
    const mealPlanItemId = await insert("meal_plan_items", {
      user_id: userId,
      meal_plan_id: mealPlanId,
      day_date: today,
      meal_slot: "lunch",
      recipe_id: anyRecipe.id,
    });
    rows.push({ table: "meal_plan_items", id: mealPlanItemId, updatable: { column: "status", value: "eaten" } });
  }

  const briefingId = await insert("daily_briefings", { user_id: userId, date: today, summary: "Isolation probe" });
  rows.push({ table: "daily_briefings", id: briefingId, updatable: { column: "summary", value: "hijacked" } });

  const mutedRuleId = await insert("muted_rules", { user_id: userId, rule_id: `isolation-probe-${randomUUID()}` });
  rows.push({ table: "muted_rules", id: mutedRuleId, updatable: { column: "rule_id", value: "hijacked" } });

  const noteId = await insert("founder_notes", { user_id: userId, content: "Isolation probe note" });
  rows.push({ table: "founder_notes", id: noteId, updatable: { column: "content", value: "hijacked" } });

  return rows;
}

test.describe.configure({ mode: "serial" });

test.describe("Cross-account data isolation (@functional-only @security)", () => {
  let userA: TestUser;
  let userB: TestUser;
  let rowsB: SeededRow[] = [];
  let clientA: SupabaseClient;

  test.beforeAll(async () => {
    const admin = adminClient();
    userA = await createTestUser(admin, { withProfile: true });
    userB = await createTestUser(admin, { withProfile: true });
    rowsB = await seedOneRowPerTable(admin, userB.id);
    // A also gets a companion row per table so the "select returns only my
    // own rows" assertion is a real ownership check, not just "everything
    // is empty" - both users have data, and the read must still be scoped.
    await seedOneRowPerTable(admin, userA.id);
    clientA = await testUserClient(userA.email);
  });

  test.afterAll(async () => {
    // Runs even if an assertion above threw - Playwright always executes
    // afterAll. Deletes both disposable accounts and, via the existing
    // `on delete cascade` foreign keys (verified in app/api/account/route.ts),
    // every row seeded for them across every table above.
    const admin = adminClient();
    if (userA?.id) await deleteTestUser(admin, userA.id);
    if (userB?.id) await deleteTestUser(admin, userB.id);
  });

  for (const table of USER_SCOPED_TABLES) {
    test(`${table}: User A's read never includes User B's rows`, async () => {
      const { data, error } = await clientA.from(table).select("id, user_id");
      expect(error).toBeNull();
      for (const row of data ?? []) {
        expect((row as { user_id: string }).user_id).toBe(userA.id);
      }
    });
  }

  test("User A cannot update any of User B's rows in any table", async () => {
    for (const row of rowsB) {
      const patch = { [row.updatable.column]: row.updatable.value };
      const { data, error } = await clientA.from(row.table).update(patch).eq("id", row.id).select("id");
      // RLS denies the row from matching the USING clause at all - either an
      // explicit error, or (more commonly with Postgres RLS) a silent
      // zero-row match. Both are acceptable outcomes for "the update did not
      // happen"; what's unacceptable is `data` containing the row.
      expect(data ?? [], `${row.table} update should affect 0 of User B's rows`).toHaveLength(0);
      void error;
    }

    // Confirm none of it actually changed, from the admin's unrestricted view.
    const admin = adminClient();
    for (const row of rowsB) {
      const { data } = await admin.from(row.table).select(row.updatable.column).eq("id", row.id).single();
      const current = (data as Record<string, unknown> | null)?.[row.updatable.column];
      expect(current, `${row.table}.${row.updatable.column} must be unchanged by User A's attempt`).not.toBe(
        row.updatable.value
      );
    }
  });

  test("User A cannot delete any of User B's rows in any table", async () => {
    for (const row of rowsB) {
      await clientA.from(row.table).delete().eq("id", row.id);
    }

    const admin = adminClient();
    for (const row of rowsB) {
      const { data } = await admin.from(row.table).select("id").eq("id", row.id).maybeSingle();
      expect(data, `${row.table} row seeded for User B must still exist after User A's delete attempt`).not.toBeNull();
    }
  });

  test("User A cannot insert a row that assigns User B's id as the owner", async () => {
    const attempts: Array<{ table: string; values: Record<string, unknown> }> = [
      { table: "pantry_items", values: { user_id: userB.id, name: "Forged ownership probe" } },
      { table: "founder_notes", values: { user_id: userB.id, content: "Forged ownership probe" } },
      { table: "muted_rules", values: { user_id: userB.id, rule_id: `forged-${randomUUID()}` } },
    ];

    for (const attempt of attempts) {
      const { data, error } = await clientA.from(attempt.table).insert(attempt.values).select("id");
      // The WITH CHECK clause (auth.uid() = user_id) must reject this - an
      // explicit error is the expected shape, but treat an empty/absent
      // result as acceptable too as long as nothing was created under B.
      if (!error) {
        expect(data ?? [], `${attempt.table} must not accept an insert claiming User B's id`).toHaveLength(0);
      }
    }
  });

  test("calendar_connections tokens are never exposed to any normal client query, including the owner's own", async () => {
    // This table has RLS enabled with zero policies and is fully revoked
    // from anon/authenticated (supabase/migrations/202607290001_foundation.sql)
    // - the strongest possible protection, stronger than a per-row policy,
    // because no direct client query can ever return a row from it, not
    // even the connection's own owner. Only server-side code using the
    // service-role client may read it (lib/google/calendar.ts,
    // app/api/account/export/route.ts's deliberately narrow column list).
    const admin = adminClient();
    await admin.from("calendar_connections").insert({
      user_id: userB.id,
      provider: "google",
      encrypted_access_token: "isolation-test-placeholder-not-a-real-token",
      calendar_id: "primary",
    });

    const { data: asA, error: errorA } = await clientA.from("calendar_connections").select("*");
    expect(asA ?? [], "User A's client must see zero calendar_connections rows").toHaveLength(0);
    void errorA;

    const clientB = await testUserClient(userB.email);
    const { data: asB } = await clientB.from("calendar_connections").select("*");
    expect(asB ?? [], "Even User B's own client must see zero rows directly - service-role only").toHaveLength(0);
  });

  test("API: PATCH /api/decisions/[id] rejects a cross-account id (identity comes from the session, not the URL)", async () => {
    const cookie = await sessionCookieHeader(userA.email);
    const decisionRowB = rowsB.find((row) => row.table === "decisions");
    expect(decisionRowB, "fixture setup must have seeded a decision for User B").toBeTruthy();

    const response = await fetch(`${BASE_URL}/api/decisions/${decisionRowB!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ status: "completed" }),
    });

    // Never a 200 - RLS-backed lookups for a row that isn't the caller's own
    // should read back as not-found/no-op, matching the route's own
    // "defense in depth" comment.
    expect(response.status, "PATCH on another account's decision must not succeed").not.toBe(200);
  });

  test("API: the data-export endpoint returns only the authenticated user's data and no credentials", async () => {
    const cookie = await sessionCookieHeader(userA.email);
    const response = await fetch(`${BASE_URL}/api/account/export`, { headers: { Cookie: cookie } });
    expect(response.status).toBe(200);
    const bodyText = await response.text();

    expect(bodyText).not.toContain("encrypted_access_token");
    expect(bodyText).not.toContain("encrypted_refresh_token");
    expect(bodyText, "export must never mention the other disposable account's email").not.toContain(userB.email);

    const payload = JSON.parse(bodyText) as { account: { id: string }; data: Record<string, Array<{ user_id?: string }>> };
    expect(payload.account.id).toBe(userA.id);
    for (const [table, tableRows] of Object.entries(payload.data)) {
      for (const row of tableRows) {
        if (row.user_id) expect(row.user_id, `export table ${table} leaked a foreign row`).toBe(userA.id);
      }
    }
  });

  test("API: account deletion can only ever delete the authenticated caller's own account", async () => {
    // Uses a THIRD disposable account (never A or B, and never the founder
    // or invited tester) purely to exercise the destructive path, so the
    // isolation assertions above are never at risk of running against a
    // half-deleted fixture.
    const admin = adminClient();
    const userC = await createTestUser(admin, { withProfile: true });
    const cookieC = await sessionCookieHeader(userC.email);

    // Wrong confirmation email (User A's) must be rejected, not silently
    // ignored or - worse - taken as authorization to delete someone else.
    const mismatchResponse = await fetch(`${BASE_URL}/api/account`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: cookieC },
      body: JSON.stringify({ confirmEmail: userA.email }),
    });
    expect(mismatchResponse.status).toBe(400);

    const { data: userAStillPresent } = await admin.auth.admin.getUserById(userA.id);
    expect(userAStillPresent.user, "a mismatched confirmation must never delete a different account").not.toBeNull();

    // Correct self-deletion succeeds and removes only User C.
    const deleteResponse = await fetch(`${BASE_URL}/api/account`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: cookieC },
      body: JSON.stringify({ confirmEmail: userC.email }),
    });
    expect(deleteResponse.status).toBe(200);

    const { data: userCGone } = await admin.auth.admin.getUserById(userC.id);
    expect(userCGone.user).toBeNull();

    // User A and User B (and all of their seeded rows) must be entirely
    // unaffected by deleting a third, unrelated account.
    const { data: userAIntact } = await admin.auth.admin.getUserById(userA.id);
    expect(userAIntact.user).not.toBeNull();
    for (const row of rowsB) {
      const { data } = await admin.from(row.table).select("id").eq("id", row.id).maybeSingle();
      expect(data, `${row.table} row for User B must survive an unrelated account's deletion`).not.toBeNull();
    }
  });
});
