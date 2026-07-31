// UX Hardening release (docs/17_UX_AUDIT.md, Portuguese copy findings):
// several places wrote counts as a literal "item(ns)"/"decisão(ões)"
// bracket instead of real singular/plural Portuguese - grammatically wrong
// regardless of the count, and the kind of small papercut that undercuts an
// otherwise calm, premium-feeling product. One tiny helper, reused
// everywhere a count needs a plural noun, so the same mistake can't
// reappear in a fourth place later.

/** Returns `${count} ${singular}` for count === 1, `${count} ${plural}`
 * otherwise. Portuguese (like English) is singular only at exactly 1,
 * including 0 ("0 itens", not "0 item"). */
export function pluralizePt(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
