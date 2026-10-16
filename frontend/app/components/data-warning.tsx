export function DataWarning({ error, retry }: { error: string; retry: () => void }) {
  if (!error) return null;
  return <p className="form-alert" role="status">อัปเดตข้อมูลไม่สำเร็จ กำลังแสดงข้อมูลล่าสุดที่โหลดได้: {error} <button className="text-link" onClick={retry}>ลองโหลดอีกครั้ง</button></p>;
}
