import { z } from "zod";
import { resourceFields } from "./admin.dto.js";
const security = [{ cookieAuth: [] }];
const json = (schema: object) => ({ "application/json": { schema } });
const failure = Object.fromEntries([400, 401, 403, 404, 409].map(status => [status, { description: ({ 400: "Invalid fields or foreign references", 401: "Session required", 403: "Manager/owner role and matching Origin required", 404: "Resource not found", 409: "Duplicate ID/code/position or stale version" } as Record<number, string>)[status], content: json({ $ref: "#/components/schemas/Error" }) }]));
export const adminPaths: Record<string, object> = {
  "/api/admin/references": { get: { summary: "All catalog references, including inactive records (manager/owner)", security, responses: { 200: { description: "markets, categories, zones and stalls arrays; each row has id and version" }, ...failure } } },
};
for (const [kind, fields] of Object.entries(resourceFields)) {
  const schema = z.toJSONSchema(fields);
  const { $schema, ...base } = schema;
  const properties = base.properties ?? {};
  const create = { ...base, properties: { ...properties, id: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$", description: "Optional immutable ID; generated if absent" } }, additionalProperties: false };
  const mutable = Object.fromEntries(Object.entries(properties).filter(([key]) => key !== "marketId"));
  const patch = { type: "object", properties: { ...mutable, version: { type: "integer", minimum: 0 } }, required: ["version"], minProperties: 2, additionalProperties: false };
  const output = { type: "object", properties: { ...properties, id: { type: "string" }, version: { type: "integer", minimum: 0 } } };
  adminPaths["/api/admin/" + kind] = {
    get: { summary: "List " + kind + " including inactive records (manager/owner)", security,
      parameters: [{ name: "q", in: "query", schema: { type: "string", maxLength: 100 } }, { name: "market", in: "query", schema: { type: "string" } }, { name: "page", in: "query", schema: { type: "integer", minimum: 1, maximum: 10000, default: 1 } }, { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 12 } }],
      responses: { 200: { description: "Paginated rows", content: json({ type: "object", properties: { items: { type: "array", items: output }, total: { type: "integer" }, page: { type: "integer" }, pages: { type: "integer" } } }) }, ...failure } },
    post: { summary: "Create " + kind + " (manager/owner)", security, requestBody: { required: true, content: json(create) }, responses: { 201: { description: "Created", content: json(output) }, ...failure } },
  };
  adminPaths["/api/admin/" + kind + "/{id}"] = {
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
    patch: { summary: "Edit " + kind + " with optimistic version; marketId and id immutable", security, requestBody: { required: true, content: json(patch) }, responses: { 200: { description: "Updated with incremented version", content: json(output) }, ...failure } },
    delete: { summary: "Deactivate " + kind + " without deleting referenced records", security, requestBody: { required: true, content: json({ type: "object", required: ["version"], properties: { version: { type: "integer", minimum: 0 } }, additionalProperties: false }) }, responses: { 200: { description: "Disabled, record preserved; reactivate using PATCH", content: json(output) }, ...failure } },
  };
}
