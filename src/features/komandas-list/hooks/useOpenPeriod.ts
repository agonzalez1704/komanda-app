import { useQuery } from '@tanstack/react-query';
import { fetchOpenPeriod } from '@/insforge/queries/auditPeriods';
import type { AuditPeriodRowT } from '@/insforge/schemas';

/**
 * Currently open audit period for the org. "Today's revenue" and "today's
 * komandas" used to be clock-based (calendar day), which broke when a shift
 * ran past midnight — closed-at-12:30am komandas dropped out of the day's
 * totals before the user had a chance to reconcile cash. Period_id on the
 * komanda row is the source of truth for "this shift" instead.
 *
 * Returns null while the period is loading or absent, so callers can defer
 * stats rather than render bogus zeros.
 */
export function useOpenPeriod(orgId: string | null | undefined): {
  period: AuditPeriodRowT | null;
  isLoading: boolean;
} {
  const q = useQuery({
    queryKey: ['auditPeriod', 'open', orgId],
    queryFn: () => fetchOpenPeriod(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 60,
  });
  return { period: q.data ?? null, isLoading: q.isLoading };
}
