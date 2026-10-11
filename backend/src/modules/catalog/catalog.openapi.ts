const text = { type: "string" };
const number = { type: "number" };
const category = { type: "object", properties: { id: text, name: text } };
const market = { type: "object", properties: { id: text, name: text, location: text, description: text, photo: { type: "string", enum: ["canal", "community", "sunday"] }, landmark: text, entrance: text, minPrice: { type: "number", nullable: true } } };
const stall = { type: "object", properties: { id: text, code: text, row: text, rowOrder: number, column: number, width: number, depth: number, pricePerDay: number, description: text, status: { type: "string", enum: ["available", "booked", "held", "unavailable"] }, holdExpiresAt: { type: "string", format: "date-time", nullable: true } } };
const shop = { type: "object", properties: { id: text, name: text, description: text, hours: text, market: { type: "object", properties: { id: text, name: text, location: text } }, category, stall: { type: "object", nullable: true, properties: { id: text, code: text } } } };
const items = (schema: object) => ({ type: "object", properties: { items: { type: "array", items: schema } } });
const response = (schema: object) => ({ "200": { description: "Public live database data; Cache-Control: no-store", content: { "application/json": { schema } } }, "400": { description: "Invalid query or identifier" }, "404": { description: "Market or shop unavailable" } });
const pathId = { name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$" } };
export const catalogSchemas = { Market: market, Category: category, Stall: stall, Shop: shop };
export const catalogPaths = {
  "/api/markets": { get: { tags: ["Catalog"], summary: "List active markets and minimum enabled-stall price", responses: response(items(market)) } },
  "/api/categories": { get: { tags: ["Catalog"], summary: "List active shop categories", responses: response(items(category)) } },
  "/api/markets/{id}/floor-plan": { get: { tags: ["Catalog"], summary: "Floor plan and availability for a Bangkok calendar date", description: "Defaults to today in Asia/Bangkok. Disabled stalls take priority. Expired holds appear available even before cleanup. This API only reads states, does not create reservations or holds. The browser polls every 15 seconds.", parameters: [pathId, { name: "date", in: "query", schema: { type: "string", format: "date" } }], responses: response({ type: "object", properties: { market, date: { type: "string", format: "date" }, updatedAt: { type: "string", format: "date-time" }, counts: { type: "object", properties: { available: number, booked: number, held: number, unavailable: number } }, stalls: { type: "array", items: stall } } }) } },
  "/api/shops": { get: { tags: ["Catalog"], summary: "Search active shops by name/description, market and category", description: "q is a literal substring, not a regular expression. Filters are combined. Stable order by name then id. Only shops in active markets/categories are visible.", parameters: [
    { name: "q", in: "query", schema: { type: "string", maxLength: 100 } }, { name: "market", in: "query", schema: text }, { name: "category", in: "query", schema: text },
    { name: "page", in: "query", schema: { type: "integer", minimum: 1, maximum: 10000, default: 1 } },
    { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 48, default: 12 } },
  ], responses: response({ type: "object", properties: { items: { type: "array", items: shop }, total: number, page: number, limit: number, pages: number } }) } },
  "/api/shops/{id}": { get: { tags: ["Catalog"], summary: "Public shop details and verified floor-plan location", parameters: [pathId], responses: response(shop) } },
};
