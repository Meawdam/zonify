// The deadline includes downloading/parsing the body. Writes are never retried.
export class RequestTimeoutError extends Error {}
export async function requestJSON(url: string, options: RequestInit = {}, timeoutMs = 15000) {
  const deadline = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
  try {
    const response = await fetch(url, { ...options, signal });
    const data = response.status === 204 ? null : await response.json().catch(error => {
      if (error instanceof SyntaxError) return null;
      throw error;
    });
    return { response, data };
  } catch (error) {
    if (deadline.aborted && !options.signal?.aborted) {
      const write = options.method && !["GET", "HEAD"].includes(options.method.toUpperCase());
      throw new RequestTimeoutError(write
        ? "ใช้เวลานานเกินไป ยังไม่ทราบผลรายการ กรุณาโหลดข้อมูลล่าสุดก่อนส่งซ้ำ"
        : "โหลดข้อมูลนานเกินไป กรุณาลองโหลดอีกครั้ง");
    }
    throw error;
  }
}
