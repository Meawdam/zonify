const security = [{ cookieAuth: [] }], ref = { $ref: "#/components/schemas/Booking" };
const json = (schema: object) => ({ "application/json": { schema } });
const id = [{ name: "id", in: "path", required: true, schema: { type: "string" } }];
const error = { $ref: "#/components/schemas/Error" };
const errors = Object.fromEntries([400, 401, 403, 404, 409, 413, 429, 503].map(code => [code, { description: ({ 400: "Invalid fields or image", 401: "Session required", 403: "Role or Origin denied", 404: "Owned booking or slip not found", 409: "State changed, expired, incorrect amount or reused payment", 413: "Image exceeds 5 MB", 429: "30 uploads per 15 minutes per backend peer IP", 503: "Receiving account not configured correctly" } as Record<number, string>)[code], content: json(error) }]));
const body = (schema: object) => ({ required: true, content: json(schema) });
const reference = { type: "string", minLength: 4, maxLength: 80, pattern: "^[A-Za-z0-9-]+$", description: "Normalized to uppercase" };
const bookingResponse = { 200: { description: "Updated booking including payment history", content: json(ref) }, ...errors };
export const paymentSchemas = {
  BookingPayment: { type: "object", properties: {
    recipient: { type: "object", nullable: true, properties: { id: { type: "string" }, name: { type: "string" } } },
    paidAt: { type: "string", format: "date-time", nullable: true }, approvedReference: { ...reference, nullable: true },
    refund: { type: "object", nullable: true, properties: { status: { type: "string", enum: ["pending", "refunded"] }, amount: { type: "number" }, reference,
      requestedAt: { type: "string", format: "date-time" }, completedAt: { type: "string", format: "date-time", nullable: true }, completedBy: { type: "string", nullable: true } } },
    attempts: { type: "array", items: { type: "object", properties: { id: { type: "string", format: "uuid" }, amount: { type: "number" }, transferredAt: { type: "string", format: "date-time" }, reference,
      submittedAt: { type: "string", format: "date-time" }, status: { type: "string", enum: ["review", "approved", "rejected"] }, reviewedAt: { type: "string", format: "date-time", nullable: true },
      reviewReason: { type: "string" }, verifiedReference: { type: "string" }, slipUrl: { type: "string", description: "Private authenticated same-origin image endpoint" } } } },
  } },
};
export const paymentPaths = {
  "/api/bookings/{id}/payment/qr": { post: { summary: "Create owned pending-payment PromptPay QR", security, parameters: id,
    description: "Price comes from the booking snapshot. Recipient is fixed on first QR issuance. Blank/invalid environment configuration returns 503. Does not extend the payment deadline or assert payment received. Positive amounts with two decimal places only.",
    requestBody: body({ type: "object", additionalProperties: false }), responses: { 200: { description: "THB QR", content: json({ type: "object", properties: { bookingId: { type: "string" }, amount: { type: "number" }, currency: { type: "string", enum: ["THB"] },
      recipient: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } }, expiresAt: { type: "string", format: "date-time" }, payload: { type: "string" }, qrDataUrl: { type: "string" } } }) }, ...errors } } },
  "/api/bookings/{id}/payment/slip": { post: { summary: "Upload one owned payment slip", security, parameters: id,
    description: "QR must have been issued. Exactly one PNG/JPEG up to 5 MB, decoded below 20 million pixels, stripped/reencoded as JPEG. Three fields only. At most 10 attempts per booking. One concurrent upload wins; state becomes payment_review, with no automatic expiry during manual review. This is not bank verification.",
    requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", additionalProperties: false, required: ["slip", "amount", "transferredAt", "reference"], properties: {
      slip: { type: "string", format: "binary" }, amount: { type: "string", pattern: "^\\d{1,7}(\\.\\d{1,2})?$" }, transferredAt: { type: "string", format: "date-time", description: "ISO timestamp with timezone; at most five minutes in the future" }, reference,
    } } } } }, responses: { 201: { description: "Slip awaiting manual review", content: json(ref) }, ...errors } } },
  "/api/bookings/{id}/payment/slips/{slipId}": { get: { summary: "Private slip image (owner of booking or manager/owner role)", security, parameters: [...id, { name: "slipId", in: "path", required: true, schema: { type: "string" } }],
    responses: { 200: { description: "Sanitized JPEG; private/no-store/nosniff", content: { "image/jpeg": { schema: { type: "string", format: "binary" } } } }, ...errors } } },
  "/api/admin/bookings/{id}/payment/review": { post: { summary: "Manually approve/reject latest slip (manager/owner)", security, parameters: id,
    description: "Manager must verify bank receipt separately. Only the current attempt in payment_review is accepted. Approval requires matching amount and a bank-verified reference; unique indexes prevent reusing a confirmed reference or image even after cancellation. Rejection keeps history and opens 30 minutes to correct the evidence.",
    requestBody: body({ oneOf: [
      { type: "object", additionalProperties: false, required: ["decision", "attemptId", "verifiedReference"], properties: { decision: { type: "string", enum: ["approve"] }, attemptId: { type: "string", format: "uuid" }, verifiedReference: reference } },
      { type: "object", additionalProperties: false, required: ["decision", "attemptId", "reason"], properties: { decision: { type: "string", enum: ["reject"] }, attemptId: { type: "string", format: "uuid" }, reason: { type: "string", minLength: 1, maxLength: 500 } } },
    ] }), responses: bookingResponse } },
  "/api/admin/bookings/{id}/payment/refund": { post: { summary: "Record a completed bank refund (manager/owner)", security, parameters: id,
    description: "Cancelling a paid confirmed booking creates a pending refund. This endpoint records the manually completed transfer; it never sends funds. Same-reference retries are idempotent; conflicting state returns 409.", requestBody: body({ type: "object", additionalProperties: false, required: ["reference"], properties: { reference } }), responses: bookingResponse } },
};
