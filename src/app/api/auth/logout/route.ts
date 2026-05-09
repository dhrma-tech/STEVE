import { dataResponse } from "@/lib/api/responses";
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST() {
  await clearSessionCookie();
  return dataResponse({ ok: true });
}

