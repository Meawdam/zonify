import { z } from "zod";
const name = z.string().trim().min(1, "กรุณากรอกชื่อ").max(100, "ชื่อยาวเกินไป");
const email = z.string().trim().toLowerCase().email("กรุณากรอกอีเมลให้ถูกต้อง").max(254);
export const passwordDto = z.string().refine(value => {
  const size = Buffer.byteLength(value, "utf8");
  return size >= 8 && size <= 72;
}, "รหัสผ่านต้องมีความยาว 8–72 ไบต์ (ภาษาไทยใช้หลายไบต์ต่อตัวอักษร)");
export const createUserDto = z.object({ name, email, password: passwordDto }).strict();
export const loginUserDto = z.object({ email, password: z.string().min(1).max(1024) }).strict();
export const profileDto = z.object({
  name,
  phone: z.string().trim().max(25).refine(v => v === "" || /^\+?[0-9 ()-]{6,25}$/.test(v), "กรุณากรอกเบอร์โทรให้ถูกต้อง"),
}).strict();
export const changePasswordDto = z.object({ currentPassword: z.string().min(1).max(1024), password: passwordDto }).strict();
export type CreateUserDto = z.infer<typeof createUserDto>;
export type LoginUserDto = z.infer<typeof loginUserDto>;
