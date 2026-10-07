"use client";

import { useState } from "react";
import { Icon } from "./icons";
import { occupiedStalls, stallRows } from "./market-data";

export function StallPlan({ selected, onSelect }: { selected: string | null; onSelect: (code: string) => void }) {
  const [zoom, setZoom] = useState(100);
  return <div className="plan-card">
    <div className="map-controls"><div className="zoom-control"><button disabled={zoom <= 80} onClick={() => setZoom(value => value - 10)} aria-label="ย่อผัง"><Icon name="minus"/></button><span>{zoom}%</span><button disabled={zoom >= 120} onClick={() => setZoom(value => value + 10)} aria-label="ขยายผัง"><Icon name="plus"/></button></div>
      <div className="legend"><span><i className="available-dot"/>ว่าง</span><span><i className="occupied-dot"/>จองแล้ว</span><span><i className="selected-dot"/>เลือกอยู่</span></div>
    </div>
    <div className="plan-canvas"><span className="canal-label">คลอง</span><div className="map-scroll"><div className="floor-grid" style={{ transform: `scale(${zoom / 100})` }}>
      {stallRows.map((row, rowIndex) => <div className="map-row" key={row}><div className="slot-row"><span className="row-label">{row}</span>{Array.from({ length: 6 }, (_, index) => {
        const code = `${row}0${index + 1}`;
        const taken = occupiedStalls.has(code);
        return <button key={code} className={`slot${taken ? " occupied" : ""}${selected === code ? " selected" : ""}`} disabled={taken} aria-label={`ล็อก ${code} ${taken ? "จองแล้ว" : "ว่าง"}`} aria-pressed={selected === code} onClick={() => onSelect(code)}>{selected === code && <Icon name="check"/>}<strong>{code}</strong></button>;
      })}</div>{rowIndex < stallRows.length - 1 && <div className="walkway">ทางเดิน</div>}</div>)}
      <div className="entrance"><Icon className="entrance-arrow"/> ทางเข้า <Icon className="entrance-arrow"/></div>
    </div></div></div>
    <p className="map-hint">เลือกล็อกสีเขียวเพื่อดูรายละเอียด</p>
  </div>;
}
