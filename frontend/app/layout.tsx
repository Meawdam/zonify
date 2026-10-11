import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const thai = Noto_Sans_Thai({ subsets: ["thai", "latin"], variable: "--font-thai", display: "swap" });
export const metadata: Metadata = {
  title: "Zonify — จองล็อกตลาดนัด เห็นผังจริงก่อนเลือก",
  description: "เลือกตลาด ดูตำแหน่งล็อก และวางแผนพื้นที่ขายของคุณกับ Zonify",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="th" data-scroll-behavior="smooth" className={thai.variable}><body>{children}</body></html>;
}
