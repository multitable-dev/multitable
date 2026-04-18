import {
  insertCostRecord,
  getSessionCostAggregate,
  getCostRecordsBySession,
} from '../db/store.js';

export function recordCost(
  sessionId: string,
  tokensIn: number,
  tokensOut: number,
  costUsd: number,
  model?: string
): void {
  insertCostRecord({ sessionId, tokensIn, tokensOut, costUsd, model });
}

export function getSessionCost(
  sessionId: string
): { tokensIn: number; tokensOut: number; costUsd: number } {
  return getSessionCostAggregate(sessionId);
}

export function getSessionCostHistory(sessionId: string): Array<{
  id: string;
  timestamp: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  model: string | null;
}> {
  const rows = getCostRecordsBySession(sessionId);
  return rows.map((r: any) => ({
    id: r.id,
    timestamp: r.timestamp,
    tokensIn: r.tokens_in,
    tokensOut: r.tokens_out,
    costUsd: r.cost_usd,
    model: r.model,
  }));
}
