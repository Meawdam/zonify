import { catalogPaths, catalogSchemas } from "../modules/catalog/catalog.openapi.js";
const string = { type: "string" };
const user = { type: "object", required: ["id", "name", "email", "phone", "role"], properties: {
  id: string, name: string, email: { type: "string", format: "email" }, phone: string,
  role: { type: "string", enum: ["customer", "manager", "owner"] },
} };
const error = { type: "object", properties: { code: string, message: string, errors: { type: "array", items: { type: "object", properties: { path: { type: "array", items: string }, message: string } } } } };
const json = (schema: object) => ({ "application/json": { schema } });
const body = (properties: Record<string, object>, required = Object.keys(properties)) => ({
  required: true, content: json({ type: "object", additionalProperties: false, required, properties }),
});
const responses = (success: number, schema?: object) => Object.fromEntries([
  [success, { description: "Success", ...(schema ? { content: json(schema) } : {}) }],
  ...[400, 401, 403, 404, 409, 429].map(code => [code, { description: ({ 400: "Validation error", 401: "Authentication required or incorrect credentials", 403: "Role or Origin not permitted", 404: "User not found", 409: "Email exists or account changed", 429: "Rate limit exceeded" } as Record<number, string>)[code], content: json(error) }]),
]);
const security = [{ cookieAuth: [] }];
const password = { type: "string", format: "password", description: "8–72 UTF-8 bytes, whitespace preserved" };
const email = { type: "string", format: "email", description: "Trimmed and normalized to lowercase" };
const idParameters = [{ name: "id", in: "path", required: true, schema: string }];
export const swaggerSpec = {
  openapi: "3.0.0",
  info: { title: "Zonify API", version: "1.0.0", description: "Cookie sessions last one hour. All mutations require Origin equal to APP_ORIGIN. Use the frontend origin for browser requests; standalone API clients must explicitly send Origin. Login returns a User, never a bearer token. Password changes revoke all sessions. Rate limits: registration 10/hour; login and password changes share 20/15 minutes per backend peer IP (shared by the local Next proxy)." },
  servers: [{ url: "/" }],
  components: { schemas: { User: user, Error: error, ...catalogSchemas }, securitySchemes: { cookieAuth: { type: "apiKey", in: "cookie", name: "zonify_session" } } },
  paths: {
    ...catalogPaths,
    "/api/users": {
      post: { summary: "Register a customer (role fields rejected)", requestBody: body({ name: string, email, password }), responses: responses(201, user) },
      get: { summary: "List users (manager/owner)", security, responses: responses(200, { type: "array", items: user }) },
    },
    "/api/users/login": { post: { summary: "Login and set HttpOnly session cookie", requestBody: body({ email, password: { type: "string", format: "password" } }), responses: responses(200, user) } },
    "/api/users/logout": { post: { summary: "Revoke current session and clear cookie (idempotent)", responses: responses(204) } },
    "/api/users/me": {
      get: { summary: "Current user", security, responses: responses(200, user) },
      patch: { summary: "Edit own name and phone only", security, requestBody: body({ name: string, phone: string }), responses: responses(200, user) },
    },
    "/api/users/me/password": { patch: { summary: "Change password and revoke every session", security, requestBody: body({ currentPassword: { type: "string", format: "password" }, password }), responses: responses(204) } },
    "/api/users/{id}": {
      get: { summary: "Read a user (manager/owner)", security, parameters: idParameters, responses: responses(200, user) },
      delete: { summary: "Delete another user (owner only; no self-deletion)", security, parameters: idParameters, responses: responses(204) },
    },
  },
};
