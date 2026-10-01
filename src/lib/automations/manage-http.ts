import { errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { ChannelError } from "./channels";
import { ScheduleError } from "./schedules";
import { TriggerError } from "./triggers";

/** Errors from the automation settings routes: validation problems are 422, the rest go through routeError. */
export function automationError(error: unknown) {
  if (error instanceof ScheduleError || error instanceof TriggerError || error instanceof ChannelError) {
    return errorResponse("VALIDATION_ERROR", error.message, 422);
  }
  return routeError(error);
}
