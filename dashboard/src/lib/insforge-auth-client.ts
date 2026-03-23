import { createInsforgeAuthClient } from "./insforge-client";

export const insforgeAuthClient = createInsforgeAuthClient();

let currentSessionInFlight: Promise<any> | null = null;

export async function getCurrentInsforgeSession() {
  if (currentSessionInFlight) return currentSessionInFlight;
  currentSessionInFlight = insforgeAuthClient.auth
    .getCurrentSession()
    .then(({ data }: any) => data?.session ?? null)
    .catch(() => null)
    .finally(() => {
      currentSessionInFlight = null;
    });
  return currentSessionInFlight;
}
