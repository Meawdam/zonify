import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";

const thai = localFont({ src: "./fonts/NotoSansThai-Variable.ttf", weight: "100 900", variable: "--font-thai", display: "swap" });
export const metadata: Metadata = {
  title: "Zonify — จองล็อกตลาดนัด เห็นผังจริงก่อนเลือก",
  description: "เลือกตลาด ดูตำแหน่งล็อก และวางแผนพื้นที่ขายของคุณกับ Zonify",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="th" data-scroll-behavior="smooth" className={thai.variable}><body>{process.env.ZONIFY_DEMO_MODE === "1" && <aside className="demo-banner" aria-label="โหมดเดโม">โหมดเดโม · ไม่มีการรับหรือโอนเงินจริง <Link href="/demo">บัญชีทดสอบและวิธีใช้</Link></aside>}{children}</body></html>;
}
