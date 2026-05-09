import { dataResponse } from "@/lib/api/responses";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  return dataResponse(await getSession());
}

