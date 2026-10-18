import { notificationTypes } from "./notification.event.js";
const security = [{ cookieAuth: [] }];
const json = (schema: object) => ({ "application/json": { schema } });
const errors = Object.fromEntries([400, 401, 403, 404].map(code => [code, { description: ({ 400: "Invalid fields", 401: "Session required", 403: "Origin denied", 404: "Owned notification not found" } as Record<number, string>)[code] }]));
const empty = { required: true, content: json({ type: "object", additionalProperties: false }) };
const written = { 200: { description: "Read state saved idempotently", content: json({ type: "object", properties: { ok: { type: "boolean" } } }) }, ...errors };
export const notificationSchemas = {
  Notification: { type: "object", properties: { id: { type: "string" }, bookingId: { type: "string" }, type: { type: "string", enum: notificationTypes },
    message: { type: "string" }, createdAt: { type: "string", format: "date-time" }, readAt: { type: "string", format: "date-time", nullable: true } } },
};
export const notificationPaths = {
  "/api/notifications": { get: { summary: "List current user's persistent notifications", security,
    description: "Includes unread count across all pages. Stale payment reminders are suppressed. Clients poll every 30 seconds while visible and on focus.",
    parameters: [{ name: "page", in: "query", schema: { type: "integer", minimum: 1, maximum: 10000, default: 1 } }, { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } }],
    responses: { 200: { description: "Private notification page", content: json({ type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/Notification" } }, total: { type: "integer" }, page: { type: "integer" }, pages: { type: "integer" }, unreadCount: { type: "integer" } } }) }, ...errors } } },
  "/api/notifications/read-all": { post: { summary: "Mark own notifications read", security, requestBody: empty, responses: written } },
  "/api/notifications/{id}/read": { post: { summary: "Mark one owned notification read", security, requestBody: empty,
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: written } },
};
