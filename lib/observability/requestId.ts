import { headers } from "next/headers";

const REQUEST_ID_HEADER = "x-request-id";

/**
 * Get or generate a request-scoped ID for log correlation.
 * Uses the x-request-id header if present (set by middleware or load balancer),
 * otherwise generates a new one.
 */
export async function getRequestId(): Promise<string> {
  const headerStore = await headers();
  return headerStore.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();
}
