const text = { type: "string" }, date = { type: "string", format: "date" }, version = { type: "integer", minimum: 0 };
const json = (schema: object) => ({ "application/json": { schema } });
const object = (properties: Record<string, object>, required = Object.keys(properties)) => ({ type: "object", additionalProperties: false, required, properties });
const body = (properties: Record<string, object>) => ({ required: true, content: json(object(properties)) });
const security = [{ cookieAuth: [] }];
const marketId = { name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$" } };
const reason = { type: "string", maxLength: 500, description: "Trimmed reason" };
const openWeekdays = { type: "array", maxItems: 7, uniqueItems: true, items: { type: "integer", minimum: 0, maximum: 6 }, description: "Bangkok weekdays, Sunday=0 through Saturday=6. Empty means closed every regular day. Defaults to all seven days." };
const exceptions = { type: "array", maxItems: 366, items: object({ date, open: { type: "boolean" }, reason }), description: "Unique dates. Each exception overrides the weekly opening rule." };
const closure = object({ id: text, stallId: text, startsOn: date, endsOn: date, reason: { ...reason, minLength: 1 }, version });
const conflict = object({ id: text, date, status: { type: "string", enum: ["held", "pending_payment", "payment_review", "confirmed"] }, stallId: text, stallCode: text, shopName: text });
export const scheduleSchemas = {
  MarketSchedule: object({ marketId: text, version, openWeekdays, exceptions, closures: { type: "array", maxItems: 500, items: closure } }),
  ScheduleConflict: object({ code: { type: "string", enum: ["SCHEDULE_BOOKING_CONFLICT"] }, message: text, conflicts: { type: "array", maxItems: 100, items: conflict }, total: { type: "integer", minimum: 0, description: "Total affected bookings; conflicts contains at most the first 100." } }),
  WorkQueue: object({ paymentReview: { type: "integer", minimum: 0 }, pendingPayment: { type: "integer", minimum: 0 }, pendingRefund: { type: "integer", minimum: 0 } }),
};
const errors = {
  400: { description: "Invalid body/date, duplicate weekday/exception date, stall in another market, or closure limit reached", content: json({ $ref: "#/components/schemas/Error" }) },
  401: { description: "Session required" }, 403: { description: "Manager/owner required; mutation Origin must equal APP_ORIGIN" }, 404: { description: "Market or closure not found" },
  409: { description: "SCHEDULE_CHANGED (stale version), SCHEDULE_BUSY (concurrent booking), CLOSURE_OVERLAP, or SCHEDULE_BOOKING_CONFLICT. No requested changes are saved. Preserve draft and explicitly reload/reconcile before retrying.", content: json({ oneOf: [{ $ref: "#/components/schemas/ScheduleConflict" }, { $ref: "#/components/schemas/Error" }] }) },
};
const result = (status = 200) => ({ [status]: { description: "Current complete market schedule; private, no-store", content: json({ $ref: "#/components/schemas/MarketSchedule" }) }, ...errors });
export const schedulePaths = {
  "/api/admin/markets/{id}/schedule": {
    get: { tags: ["Schedule"], summary: "Read market opening calendar and stall closures (manager/owner)", security, parameters: [marketId], responses: result() },
    put: { tags: ["Schedule"], summary: "Replace weekly opening days and date exceptions", description: "Preserves stall closures. Requires current schedule version. Rejects closing a day with active holds, pending payments, payment reviews, or confirmed bookings; never cancels bookings automatically.", security, parameters: [marketId], requestBody: body({ version, openWeekdays, exceptions }), responses: result() },
  },
  "/api/admin/markets/{id}/closures": { post: { tags: ["Schedule"], summary: "Close one stall for an inclusive date range", description: "Requires current schedule version and a stall in this market. Date ranges must not overlap existing closures for the stall. The end date must be on or after the start date. Rejects affected active bookings.", security, parameters: [marketId], requestBody: body({ version, stallId: text, startsOn: date, endsOn: date, reason: { ...reason, minLength: 1 } }), responses: result(201) } },
  "/api/admin/markets/{id}/closures/{closureId}": { delete: { tags: ["Schedule"], summary: "Remove a stall closure", security, parameters: [marketId, { name: "closureId", in: "path", required: true, schema: text }], requestBody: body({ version }), responses: result() } },
  "/api/admin/work-queue": { get: { tags: ["Schedule"], summary: "Count payment reviews, pending payments and pending refunds (manager/owner)", description: "Expires overdue holds/payments before counting. Counts cover all markets. Follow through to admin booking filters status=payment_review, status=pending_payment, or refund=pending.", security, responses: { 200: { description: "Current operational counts; private, no-store", content: json({ $ref: "#/components/schemas/WorkQueue" }) }, 401: errors[401], 403: errors[403] } } },
};
