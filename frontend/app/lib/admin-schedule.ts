import { requestJSON } from "./request";
import { ApiError } from './auth';
export type MarketSchedule = { marketId: string; version: number; openWeekdays: number[]; exceptions: { date: string; open: boolean; reason: string }[]; closures: { id: string; stallId: string; startsOn: string; endsOn: string; reason: string; version: number }[] };
export type ScheduleConflict = { id: string; date: string; status: string; stallId: string; stallCode: string; shopName: string };
export class ScheduleError extends ApiError {
  conflicts: ScheduleConflict[]; total: number;
  constructor(status: number, data: { code?: string; message?: string; conflicts?: ScheduleConflict[]; total?: number }) {
    super(status, data.code ?? 'SERVER_ERROR', data.message ?? 'บันทึกไม่สำเร็จ');
    this.conflicts = data.conflicts ?? []; this.total = data.total ?? this.conflicts.length;
  }
}
export async function scheduleRequest(path: string, method = 'GET', body?: unknown): Promise<MarketSchedule> {
  const { response, data } = await requestJSON('/api/admin/markets/' + path, { method, credentials: 'same-origin', cache: 'no-store', ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });

  if (!response.ok) throw new ScheduleError(response.status, data ?? {});
  return data;
}
