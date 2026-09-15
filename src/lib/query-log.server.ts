/** Query history logging removed — each chat turn is standalone. */
export type QueryLogRow = {
  query: string;
  intent?: string | null;
  refused?: boolean;
  pin?: string | null;
  latency_ms?: number | null;
};

export function logQuery(_row: QueryLogRow): void {
  /* no-op */
}
