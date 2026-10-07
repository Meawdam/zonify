export const markets = [
  { id: "canal", name: "กาดริมคลอง", location: "เชียงใหม่", category: "craft", description: "ตลาดริมน้ำ บรรยากาศร่มรื่น\nของกิน ของทำมือ และงานคราฟต์", price: 150, photo: "canal" },
  { id: "community", name: "ตลาดชุมชน", location: "เชียงใหม่", category: "food", description: "ตลาดของคนในชุมชน\nอาหารพื้นเมือง สินค้าท้องถิ่น", price: 150, photo: "community" },
  { id: "sunday", name: "กาดวันอาทิตย์", location: "เชียงใหม่", category: "craft", description: "ตลาดคนเดินกลางเมือง\nงานคราฟต์ ศิลปะ และของสะสม", price: 150, photo: "sunday" },
] as const;

export const occupiedStalls = new Set(["A03", "B03", "B06", "C02", "D02"]);
export const stallRows = ["A", "B", "C", "D"];
export type Market = (typeof markets)[number];
