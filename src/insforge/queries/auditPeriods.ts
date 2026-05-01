import { z } from 'zod';
import { insforge } from '@/insforge/client';
import { AuditPeriodRow, type AuditPeriodRowT } from '@/insforge/schemas';

const List = z.array(AuditPeriodRow);

export async function fetchOpenPeriod(orgId: string): Promise<AuditPeriodRowT> {
  const { data, error } = await insforge.database
    .from('audit_periods')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'open')
    .single();
  if (error) throw error;
  return AuditPeriodRow.parse(data);
}

export async function fetchPeriod(id: string): Promise<AuditPeriodRowT> {
  const { data, error } = await insforge.database
    .from('audit_periods')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return AuditPeriodRow.parse(data);
}

export async function listClosedPeriods(orgId: string): Promise<AuditPeriodRowT[]> {
  const { data, error } = await insforge.database
    .from('audit_periods')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'closed')
    .order('closed_at', { ascending: false });
  if (error) throw error;
  return List.parse(data ?? []);
}

// RPCs return SETOF audit_periods; the SDK may surface that as a single row or
// a single-element array. Mirror lookupInvitation's unwrap so both shapes parse.
function unwrapRpcRow(data: unknown): unknown {
  if (Array.isArray(data)) return data[0];
  return data;
}

export async function closeDay(orgId: string): Promise<AuditPeriodRowT> {
  const { data, error } = await insforge.database.rpc('close_day', { p_org_id: orgId });
  if (error) throw error;
  return AuditPeriodRow.parse(unwrapRpcRow(data));
}

export async function reopenPeriod(periodId: string, reason: string): Promise<AuditPeriodRowT> {
  const { data, error } = await insforge.database.rpc('reopen_period', {
    p_period_id: periodId,
    p_reason: reason,
  });
  if (error) throw error;
  return AuditPeriodRow.parse(unwrapRpcRow(data));
}
