"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, type FormEvent, type InputHTMLAttributes } from "react";
import { api, ApiError, passwordError, roleLabels, type User, type FieldErrors } from "../lib/auth";
function Field({ label, error, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { name: string; label: string; error?: string | undefined; hint?: string }) {
  return <div className="form-field"><label htmlFor={props.name}>{label}</label>
    <input {...props} id={props.name} aria-invalid={!!error} aria-describedby={error ? `${props.name}-error` : hint ? `${props.name}-hint` : undefined}/>
    {hint && <small id={`${props.name}-hint`}>{hint}</small>}
    {error && <p className="field-error" id={`${props.name}-error`}>{error}</p>}
  </div>;
}
function formValues(form: HTMLFormElement) { return Object.fromEntries(new FormData(form)) as Record<string, string>; }
function focusError(form: HTMLFormElement) {
  requestAnimationFrame(() => form.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
}
export function AuthForm({ mode, notice = "", nextPath = "/profile" }: { mode: "login" | "register"; notice?: string; nextPath?: string }) {
  const register = mode === "register";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formValues(form);
    const next: FieldErrors = {};
    if (register && !data.name.trim()) next.name = "กรุณากรอกชื่อ";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) next.email = "กรุณากรอกอีเมลให้ถูกต้อง";
    if (register && passwordError(data.password)) next.password = passwordError(data.password);
    if (!register && !data.password) next.password = "กรุณากรอกรหัสผ่าน";
    if (register && data.password !== data.confirmPassword) next.confirmPassword = "รหัสผ่านไม่ตรงกัน";
    setErrors(next); setMessage("");
    if (Object.keys(next).length) { focusError(form); return; }
    setBusy(true);
    try {
      await api<User>(register ? "" : "/login", { method: "POST", body: register ? { name: data.name, email: data.email, password: data.password } : { email: data.email, password: data.password } });
      router.replace(register ? "/login?notice=registered" + (nextPath !== "/profile" ? "&next=" + encodeURIComponent(nextPath) : "") : nextPath); router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ทำรายการไม่สำเร็จ");
      if (error instanceof ApiError) { setErrors(error.fields); focusError(form); }
    } finally { setBusy(false); }
  }
  return <form className="account-card" noValidate onSubmit={submit} aria-busy={busy}>
    {notice && <p className="form-notice" role="status">{notice}</p>}
    {message && <p className="form-alert" role="alert">{message}</p>}
    <fieldset disabled={busy}>
      {register && <Field name="name" label="ชื่อ" autoComplete="name" maxLength={100} required error={errors.name}/>}
      <Field name="email" label="อีเมล" type="email" autoComplete="email" maxLength={254} required error={errors.email}/>
      <Field name="password" label="รหัสผ่าน" type="password" autoComplete={register ? "new-password" : "current-password"} required error={errors.password} {...(register ? { hint: "8–72 ไบต์ ภาษาไทยใช้หลายไบต์ต่อตัวอักษร" } : {})}/>
      {register && <Field name="confirmPassword" label="ยืนยันรหัสผ่าน" type="password" autoComplete="new-password" required error={errors.confirmPassword}/>}
      <button className="button button-green form-submit" type="submit">{busy ? "กำลังดำเนินการ…" : register ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}</button>
    </fieldset>
    <p className="account-switch">{register ? "มีบัญชีแล้ว? " : "ยังไม่มีบัญชี? "}<Link href={(register ? "/login" : "/register") + (nextPath !== "/profile" ? "?next=" + encodeURIComponent(nextPath) : "")}>{register ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}</Link></p>
  </form>;
}
export function ProfileForms({ user }: { user: User }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"profile" | "password" | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [messages, setMessages] = useState({ profile: "", password: "" });
  const [success, setSuccess] = useState(false);
  const profileRef = useRef<HTMLFormElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>, kind: "profile" | "password") {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formValues(form);
    const next: FieldErrors = {};
    if (kind === "profile") {
      if (!data.name.trim()) next.name = "กรุณากรอกชื่อ";
      if (data.phone.trim() && !/^\+?[0-9 ()-]{6,25}$/.test(data.phone.trim())) next.phone = "กรุณากรอกเบอร์โทรให้ถูกต้อง";
    } else {
      if (!data.currentPassword) next.currentPassword = "กรุณากรอกรหัสผ่านเดิม";
      if (passwordError(data.password)) next.password = passwordError(data.password);
      if (data.password !== data.confirmPassword) next.confirmPassword = "รหัสผ่านไม่ตรงกัน";
    }
    setErrors(next); setMessages({ profile: "", password: "" }); setSuccess(false);
    if (Object.keys(next).length) { focusError(form); return; }
    setBusy(kind);
    try {
      if (kind === "profile") {
        const updated = await api<User>("/me", { method: "PATCH", body: { name: data.name, phone: data.phone } });
        const name = profileRef.current?.elements.namedItem("name") as HTMLInputElement | null;
        if (name) name.value = updated.name;
        setSuccess(true); setMessages({ profile: "บันทึกโปรไฟล์แล้ว", password: "" }); router.refresh();
      } else {
        await api("/me/password", { method: "PATCH", body: { currentPassword: data.currentPassword, password: data.password } });
        router.replace("/login?notice=password-changed"); router.refresh();
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) { router.replace("/login?notice=expired"); router.refresh(); return; }
      setMessages({ profile: "", password: "", [kind]: error instanceof Error ? error.message : "ทำรายการไม่สำเร็จ" });
      if (error instanceof ApiError) { setErrors(error.fields); focusError(form); }
    } finally { setBusy(null); }
  }
  return <div className="profile-grid">
    <form ref={profileRef} className="account-card" noValidate onSubmit={e => submit(e, "profile")} aria-busy={busy === "profile"}>
      <h2>ข้อมูลส่วนตัว</h2>
      {messages.profile && <p className={success ? "form-notice" : "form-alert"} role={success ? "status" : "alert"}>{messages.profile}</p>}
      <fieldset disabled={busy !== null}>
        <Field name="name" label="ชื่อ" autoComplete="name" defaultValue={user.name} maxLength={100} required error={errors.name}/>
        <Field name="phone" label="เบอร์โทร (ไม่บังคับ)" type="tel" autoComplete="tel" defaultValue={user.phone} maxLength={25} error={errors.phone}/>
        <Field name="email" label="อีเมล" type="email" value={user.email} readOnly/>
        <Field name="role" label="บทบาท" value={roleLabels[user.role]} readOnly/>
        <button className="button button-green form-submit" type="submit">{busy === "profile" ? "กำลังบันทึก…" : "บันทึกโปรไฟล์"}</button>
      </fieldset>
    </form>
    <form className="account-card" noValidate onSubmit={e => submit(e, "password")} aria-busy={busy === "password"}>
      <h2>เปลี่ยนรหัสผ่าน</h2><p className="form-description">เมื่อเปลี่ยนรหัสผ่าน ทุกอุปกรณ์จะออกจากระบบ</p>
      {messages.password && <p className="form-alert" role="alert">{messages.password}</p>}
      <fieldset disabled={busy !== null}>
        <Field name="currentPassword" label="รหัสผ่านเดิม" type="password" autoComplete="current-password" required error={errors.currentPassword}/>
        <Field name="password" label="รหัสผ่านใหม่" type="password" autoComplete="new-password" required hint="8–72 ไบต์ ภาษาไทยใช้หลายไบต์ต่อตัวอักษร" error={errors.password}/>
        <Field name="confirmPassword" label="ยืนยันรหัสผ่านใหม่" type="password" autoComplete="new-password" required error={errors.confirmPassword}/>
        <button className="button button-green form-submit" type="submit">{busy === "password" ? "กำลังเปลี่ยน…" : "เปลี่ยนรหัสผ่าน"}</button>
      </fieldset>
    </form>
  </div>;
}
