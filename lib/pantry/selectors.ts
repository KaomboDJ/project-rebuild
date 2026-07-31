// Canonical pantry-count selectors (UX Hardening release, docs/17_UX_AUDIT.md
// N2 - confirmed P1). Before this, the /nutrition dashboard counted every
// pantry_items row ("total registered", including items at quantity 0 that
// aren't really "in the pantry" anymore) while the Coach's system-prompt
// summary (lib/coach/pantry-context.ts's buildPantrySummary) and
// suggest_available_meal tool both filtered to quantity > 0 - two genuinely
// different concepts, shown with the same unlabeled "item(ns) registados"
// text, that happened to disagree. Per the release brief: don't force one
// number everywhere when the concepts differ - name them and keep each
// consumer on the selector that matches what it actually means. Pure and
// unit-tested so every caller (dashboard page, Coach) computes the same
// answer for the same input rather than re-deriving similar-but-not-quite
// filters independently.

export interface PantryCountable {
  quantity: number;
  expires_on: string | null;
}

/** Every row that exists in the pantry table, regardless of stock level -
 * "how many distinct items have I ever tracked here". */
export function countTotalRegistered(items: PantryCountable[]): number {
  return items.length;
}

/** Items with usable stock right now (quantity > 0) - the concept the Coach
 * must ground every recommendation in ("only currently usable stock", per
 * the release brief), and what a user means by "what do I actually have". */
export function countAvailable(items: PantryCountable[]): number {
  return items.filter((item) => Number(item.quantity) > 0).length;
}

/** Available items that are already expired or expire today (`today` as a
 * "YYYY-MM-DD" date key, same convention as lib/date/founder-now.ts) - a
 * distinct concept from "available", not a subset label of it, since an
 * expiring item is still counted in `countAvailable` until consumed. */
export function countExpiringSoon(items: PantryCountable[], today: string): number {
  return items.filter((item) => Number(item.quantity) > 0 && item.expires_on && item.expires_on <= today).length;
}
