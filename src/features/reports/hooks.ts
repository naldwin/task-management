import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { MonthlyReport } from '../../lib/database.types';

export function monthDate(key: string): string {
  // key: YYYY-MM -> first day ISO
  return `${key}-01`;
}

export function useReports(spaceId: string | undefined) {
  return useQuery({
    queryKey: ['reports', spaceId],
    enabled: !!spaceId,
    queryFn: async (): Promise<MonthlyReport[]> => {
      const { data, error } = await supabase
        .from('monthly_reports')
        .select('*')
        .eq('space_id', spaceId)
        .order('month_start', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MonthlyReport[];
    },
  });
}

export function useReport(spaceId: string | undefined, monthKey: string | undefined) {
  return useQuery({
    queryKey: ['report', spaceId, monthKey],
    enabled: !!spaceId && !!monthKey,
    queryFn: async (): Promise<MonthlyReport | null> => {
      const { data, error } = await supabase
        .from('monthly_reports')
        .select('*')
        .eq('space_id', spaceId)
        .eq('month_start', monthDate(monthKey!))
        .maybeSingle();
      if (error) throw error;
      return (data as MonthlyReport) ?? null;
    },
  });
}

export function useGenerateReport(spaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (month: string) => {
      const { error } = await supabase.rpc('generate_monthly_report', {
        p_space_id: spaceId, p_month: monthDate(month),
      });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reports', spaceId] }),
  });
}
