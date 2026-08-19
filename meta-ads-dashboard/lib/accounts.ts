export interface AccountMeta {
  id: string;
  name: string;
  business: string;
  currency: string;
}

/** The two Slow Burn Method ad accounts this dashboard reports on. */
export const TRACKED_ACCOUNTS: AccountMeta[] = [
  { id: "1002719109265256", name: "SBM 2", business: "Slow Burn Method", currency: "INR" },
  { id: "1204405088105936", name: "Slow burn Method Meta", business: "Slow Burn Method", currency: "INR" },
];
