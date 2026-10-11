import "dotenv/config";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import { MarketModel, CategoryModel, ZoneModel, StallModel, StallDayStateModel, ShopModel, ensureCatalogIndexes } from "../modules/catalog/catalog.schema.js";
import { bangkokDate, dateQuery } from "../modules/catalog/catalog.service.js";
import { BookingModel, activeBookingStatuses } from "../modules/bookings/booking.schema.js";
export async function seedCatalog(date = bangkokDate()) {
  dateQuery.parse(date);
  await ensureCatalogIndexes();
  const markets = [
    { _id: "canal", name: "กาดริมคลอง", location: "เชียงใหม่", description: "ตลาดริมน้ำ ของกิน ของทำมือ และงานคราฟต์", photo: "canal", landmark: "คลอง", entrance: "ทางเข้าริมคลอง" },
    { _id: "community", name: "ตลาดชุมชน", location: "เชียงใหม่", description: "อาหารพื้นเมืองและสินค้าท้องถิ่นจากคนในชุมชน", photo: "community", landmark: "สวน", entrance: "ทางเข้าฝั่งสวน" },
    { _id: "sunday", name: "กาดวันอาทิตย์", location: "เชียงใหม่", description: "งานคราฟต์ ศิลปะ เสื้อผ้า และของสะสม", photo: "sunday", landmark: "ถนน", entrance: "ทางเข้าตลาด" },
  ];
  const categories = [{ _id: "food", name: "อาหารและเครื่องดื่ม" }, { _id: "craft", name: "งานคราฟต์และของทำมือ" }, { _id: "fashion", name: "เสื้อผ้าและเครื่องประดับ" }, { _id: "plants", name: "ต้นไม้และดอกไม้" }];
  for (const [order, category] of categories.entries()) await CategoryModel.updateOne({ _id: category._id }, { $setOnInsert: { ...category, order, active: true } }, { upsert: true });
  for (const [order, market] of markets.entries()) {
    await MarketModel.updateOne({ _id: market._id }, { $setOnInsert: { ...market, order, active: true } }, { upsert: true });
    const rows = market._id === "community" ? ["A", "B", "C"] : ["A", "B", "C", "D"];
    for (const [rowOrder, row] of rows.entries()) {
      const zoneId = market._id + "-zone-" + row;
      await ZoneModel.updateOne({ _id: zoneId }, { $setOnInsert: { marketId: market._id, name: row === "A" ? "โซนทางเข้า" : "โซน " + row, description: "", order: rowOrder, active: true } }, { upsert: true });
      for (let column = 1; column <= 6; column++) {
      const code = row + String(column).padStart(2, "0");
      const _id = market._id + "-" + code;
      await StallModel.updateOne({ _id }, { $setOnInsert: { _id, marketId: market._id, zoneId, code, row, rowOrder, column, width: row === "A" ? 3 : 2, depth: 2, pricePerDay: 120 + order * 30 + (row === "A" ? 60 : 0), description: row === "A" ? "โซนใกล้ทางเข้า" : "พื้นที่ขายทั่วไป", enabled: code !== "C06" } }, { upsert: true });
      }
    }
  }
  const shops = [
    ["canal-coffee", "canal", "food", "A03", "กาแฟริมคลอง", "กาแฟคั่วเชียงใหม่และเครื่องดื่มเย็น", "08:00–18:00"],
    ["canal-clay", "canal", "craft", "B03", "ดินปั้นบ้านเรา", "เซรามิกทำมือ ถ้วย จาน และของแต่งบ้าน", "10:00–19:00"],
    ["canal-flowers", "canal", "plants", "C02", "ดอกไม้ริมคลอง", "ช่อดอกไม้สดและต้นไม้กระถาง", "09:00–18:00"],
    ["canal-cotton", "canal", "fashion", "D02", "ฝ้ายเมืองเหนือ", "เสื้อผ้าฝ้ายและกระเป๋าผ้าทอ", "10:00–19:00"],
    ["community-noodles", "community", "food", "A02", "ข้าวซอยป้าดา", "ข้าวซอยและอาหารพื้นเมือง", "09:00–16:00"],
    ["community-bamboo", "community", "craft", "B02", "จักสานบ้านสวน", "ตะกร้าและของใช้จากไม้ไผ่", "08:00–17:00"],
    ["community-plants", "community", "plants", "C03", "สวนเล็กในบ้าน", "ไม้ใบและกระถางตกแต่ง", "08:00–17:00"],
    ["sunday-silver", "sunday", "fashion", "A04", "เครื่องเงินวันอาทิตย์", "เครื่องประดับเงินและงานออกแบบท้องถิ่น", "16:00–22:00"],
    ["sunday-art", "sunday", "craft", "B01", "ภาพวาดของเรา", "ภาพวาด โปสการ์ด และงานศิลปะ", "16:00–22:00"],
    ["sunday-dessert", "sunday", "food", "C04", "ขนมบ้านอุ่น", "ขนมไทยและเบเกอรีอบใหม่", "16:00–22:00"],
    ["sunday-tea", "sunday", "food", "D03", "ชาจากดอย", "ชาท้องถิ่น ชาร้อน และชาเย็น", "16:00–22:00"],
    ["canal-bread", "canal", "food", "D04", "ขนมปังเช้า", "ขนมปังอบสดและแซนด์วิช", "07:00–15:00"],
    ["community-textile", "community", "fashion", "B05", "ผ้าทอชุมชน", "ผ้าทอมือและผ้าพันคอ", "09:00–17:00"],
  ];
  for (const entry of shops) {
    const [_id, marketId, categoryId, code, name, description, hours] = entry as [string, string, string, string, string, string, string];
    const stallId = marketId + "-" + code;
    await ShopModel.updateOne({ _id }, { $setOnInsert: { _id, marketId, categoryId, stallId, name, description, hours, active: true } }, { upsert: true });
    if (!await BookingModel.exists({ stallId, date, status: { $in: [...activeBookingStatuses] } }))
      await StallDayStateModel.updateOne({ stallId, date }, { $setOnInsert: { stallId, date, status: "booked" } }, { upsert: true });
  }
  // Deterministic day-end sample hold; re-running the seed does not extend or overwrite it.
  if (!await BookingModel.exists({ stallId: "canal-B06", date, status: { $in: [...activeBookingStatuses] } }))
    await StallDayStateModel.updateOne({ stallId: "canal-B06", date }, { $setOnInsert: { stallId: "canal-B06", date, status: "held", expiresAt: new Date(date + "T23:59:59+07:00") } }, { upsert: true });
  console.log(`Catalog sample data ready for ${date}; existing records preserved.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
    await mongoose.connect(process.env.MONGO_URI);
    await seedCatalog(process.env.SEED_DATE ?? bangkokDate());
  } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
  finally { await mongoose.disconnect(); }
}
