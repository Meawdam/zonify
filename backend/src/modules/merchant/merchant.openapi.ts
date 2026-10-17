const text = { type: "string" }, security = [{ cookieAuth: [] }];
const fields = { name: { ...text, minLength: 1, maxLength: 100 }, categoryId: text, description: { ...text, maxLength: 2000 }, hours: { ...text, maxLength: 100 }, phone: { ...text, maxLength: 30 }, contactUrl: { ...text, maxLength: 500, description: "Empty or HTTP(S) URL" } };
const shop = { type: "object", properties: { id: text, version: { type: "integer" }, marketId: text, ...fields, active: { type: "boolean" }, photoUrl: { ...text, nullable: true } } };
const json = (schema: object) => ({ "application/json": { schema } });
const responses = (schema: object, status = 200) => ({ [status]: { description: "Success; private no-store", content: json(schema) }, ...Object.fromEntries([400, 401, 403, 404, 409, 413, 429].map(code => [code, { description: "Validation, session/origin, ownership, version conflict, upload size or rate limit error" }])) });
const id = [{ name: "id", in: "path", required: true, schema: text }];
export const merchantPaths = {
  "/api/merchant/shops": {
    get: { tags: ["Merchant"], security, summary: "All shops owned by the signed-in account; includes moderated shops", responses: responses({ type: "object", properties: { items: { type: "array", items: shop } } }) },
    post: { tags: ["Merchant"], security, summary: "Create a shop; ownership comes from session", requestBody: { required: true, content: json({ type: "object", additionalProperties: false, required: ["name", "marketId", "categoryId"], properties: { ...fields, marketId: text } }) }, responses: responses(shop, 201) },
  },
  "/api/merchant/shops/{id}": {
    get: { tags: ["Merchant"], security, parameters: id, summary: "Read own shop; other owners and legacy unowned shops return 404", responses: responses(shop) },
    patch: { tags: ["Merchant"], security, parameters: id, summary: "Edit supplied fields only; market and owner immutable; version conflicts return 409", requestBody: { required: true, content: json({ type: "object", additionalProperties: false, required: ["version"], properties: { ...fields, version: { type: "integer", minimum: 0 } } }) }, responses: responses(shop) },
  },
  "/api/merchant/shops/{id}/photo": { post: {
    tags: ["Merchant"], security, parameters: id,
    summary: "Replace own shop photo; PNG/JPEG up to 5 MB, 20 million pixels, re-encoded JPEG; increments version",
    requestBody: { required: true, content: { "multipart/form-data": { schema: {
      type: "object", required: ["photo", "version"],
      properties: { photo: { type: "string", format: "binary" }, version: { type: "integer", minimum: 0 } },
    } } } }, responses: responses(shop),
  } },
  "/api/shops/{id}/photo": { get: { tags: ["Catalog"], parameters: id, summary: "Current public shop photo; hidden when shop, market or category inactive", responses: { 200: { description: "Sanitized JPEG; no-store", content: { "image/jpeg": { schema: { type: "string", format: "binary" } } } }, 404: { description: "Photo unavailable" } } } },
  "/api/merchant/overview": { get: { tags: ["Merchant"], security, summary: "Exact own shop/booking counts, outstanding amount and six soonest actions", description: "Expired holds are updated first. History includes cancelled/expired and confirmed bookings before today in Asia/Bangkok. actionRequired includes held/pending_payment; amountDue includes pending_payment only.", responses: responses({ type: "object", properties: { counts: { type: "object", properties: Object.fromEntries(["shops", "current", "history", "actionRequired", "review"].map(key => [key, { type: "integer" }])) }, amountDue: { type: "number" }, actions: { type: "array", items: { $ref: "#/components/schemas/Booking" } } } }) } },
};
