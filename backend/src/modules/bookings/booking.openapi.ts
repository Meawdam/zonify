import { bookingStatuses } from "./booking.schema.js";
const json = (schema: object) => ({ "application/json": { schema } });
const ref = { $ref: "#/components/schemas/Booking" }, security = [{ cookieAuth: [] }];
const errors = Object.fromEntries([400, 401, 403, 404, 409].map(code => [code, { description: ({ 400: "Invalid dates, body or query", 401: "Session required", 403: "Role or Origin not permitted", 404: "Stall/booking not found; another customer's booking is not visible", 409: "Stall taken/closed, hold expired or booking changed" } as Record<number, string>)[code], content: json({ $ref: "#/components/schemas/Error" }) }]));
const body = (schema: object) => ({ required: true, content: json(schema) });
const reason = { type: "object", required: ["reason"], additionalProperties: false, properties: { reason: { type: "string", minLength: 1, maxLength: 500, description: "Trimmed, non-blank cancellation/release reason" } } };
const id = [{ name: "id", in: "path", required: true, schema: { type: "string" } }];
const filter = [
  { name: "status", in: "query", schema: { type: "string", enum: [...bookingStatuses] } },
  { name: "date", in: "query", schema: { type: "string", format: "date" } },
  { name: "market", in: "query", schema: { type: "string" } },
  { name: "page", in: "query", schema: { type: "integer", minimum: 1, maximum: 10000, default: 1 } },
  { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 12 } },
];
const list = { type: "object", required: ["items", "total", "page", "pages"], properties: { items: { type: "array", items: ref }, total: { type: "integer" }, page: { type: "integer" }, pages: { type: "integer" } } };
const result = { 200: { description: "Current reservation data", content: json(ref) }, ...errors };
export const bookingSchemas = {
  Booking: { type: "object", required: ["id", "date", "status", "price", "customer", "stall", "expiresAt", "createdAt", "updatedAt", "cancelledAt", "cancelReason"], properties: {
    id: { type: "string" }, date: { type: "string", format: "date" }, status: { type: "string", enum: [...bookingStatuses] }, price: { type: "number", minimum: 0, description: "Daily price snapshot at hold creation, never supplied by client" },
    createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }, expiresAt: { type: "string", format: "date-time", nullable: true }, cancelledAt: { type: "string", format: "date-time", nullable: true }, cancelReason: { type: "string" },
    customer: { $ref: "#/components/schemas/User" },
    stall: { type: "object", properties: { id: { type: "string" }, marketId: { type: "string" }, code: { type: "string" }, width: { type: "number" }, depth: { type: "number" }, marketName: { type: "string" }, zoneName: { type: "string" } } },
  } },
};
export const bookingPaths = {
  "/api/bookings/holds": { post: { summary: "Hold exactly one stall for one day for 10 minutes", description: "Dates from today through 365 days in Asia/Bangkok. Unique active stall/day claim prevents concurrent double booking. A same-user retry returns the same hold without changing expiry or price. Expired history is retained.", security,
    requestBody: body({ type: "object", required: ["stallId", "date"], additionalProperties: false, properties: { stallId: { type: "string" }, date: { type: "string", format: "date" } } }),
    responses: { 201: { description: "Hold acquired or same-owner active hold returned", content: json(ref) }, ...errors } } },
  "/api/bookings/me": { get: { summary: "Own booking/hold history only", security, parameters: filter, responses: { 200: { description: "Paginated own records", content: json(list) }, ...errors } } },
  "/api/bookings/{id}": { get: { summary: "Read own reservation", security, parameters: id, responses: result } },
  "/api/bookings/{id}/confirm": { post: { summary: "Convert own active hold to pending_payment for 30 minutes", description: "Uses the stored daily price and checks current market/zone/stall availability. This does not claim payment received. An already pending-payment retry does not extend its deadline.", security, parameters: id, requestBody: body({ type: "object", additionalProperties: false }), responses: result } },
  "/api/bookings/{id}/cancel": { post: { summary: "Cancel own held/pending-payment reservation", description: "History and reason retained. Financial review/confirmed states require manager control.", security, parameters: id, requestBody: body(reason), responses: result } },
  "/api/admin/bookings": { get: { summary: "All booking records (manager/owner)", security, parameters: filter, responses: { 200: { description: "Paginated booking records including customer contact snapshots", content: json(list) }, ...errors } } },
  "/api/admin/bookings/{id}/cancel": { post: { summary: "Cancel active reservation with reason (manager/owner)", security, parameters: id, requestBody: body(reason), responses: result } },
  "/api/admin/holds": { get: { summary: "Active temporary holds only (manager/owner)", security, parameters: filter.filter(p => p.name !== "status"), responses: { 200: { description: "Active holds; overdue holds expire automatically", content: json(list) }, ...errors } } },
  "/api/admin/holds/{id}/release": { post: { summary: "Release an unexpired temporary hold (manager/owner)", description: "A hold that has already changed to pending payment cannot be released through this endpoint.", security, parameters: id, requestBody: body(reason), responses: result } },
};
