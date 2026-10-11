"use client";
import { useState } from "react";
import { Icon } from "./icons";
import { statusLabels, type FloorPlan } from "../lib/catalog";
export function StallPlan({ plan, selected, onSelect }: { plan: FloorPlan; selected: string | null; onSelect: (id: string) => void }) {
  const [zoom, setZoom] = useState(100);
  const rows = [...new Set(plan.stalls.map(s => s.rowOrder))];
  const columns = Math.max(1, ...plan.stalls.map(s => s.column));
  return <div className="plan-card live-map">
    <div className="map-controls">
      <div className="zoom-control"><button disabled={zoom <= 80} onClick={() => setZoom(v => v - 10)} aria-label="ย่อผัง"><Icon name="minus"/></button><span>{zoom}%</span><button disabled={zoom >= 150} onClick={() => setZoom(v => v + 10)} aria-label="ขยายผัง"><Icon name="plus"/></button></div>
      <div className="legend">{(Object.keys(statusLabels) as Array<keyof typeof statusLabels>).map(status => <span key={status}><i className={status + "-dot"}/>{statusLabels[status]}</span>)}</div>
    </div>
    <div className="plan-canvas"><span className="canal-label">{plan.market.landmark}</span><div className="map-scroll" tabIndex={0} role="region" aria-label="ผังล็อก เลื่อนเพื่อดูพื้นที่ทั้งหมด"><div className="floor-grid" style={{ zoom: zoom / 100, minWidth: columns * 62 + 28 }}>
      {rows.map((rowOrder, index) => {
        const stalls = plan.stalls.filter(s => s.rowOrder === rowOrder);
        return <div className="map-row" key={rowOrder}>
          <div className="slot-row" style={{ gridTemplateColumns: `25px repeat(${columns}, minmax(48px, 1fr))` }}>
            <span className="row-label">{stalls[0]?.row}</span>
            {stalls.map(stall => <button key={stall.id} style={{ gridColumn: stall.column + 1 }}
              className={`slot ${stall.status}${selected === stall.id ? " selected" : ""}`}
              aria-label={`ล็อก ${stall.code} ${statusLabels[stall.status]}`} aria-pressed={selected === stall.id}
              onClick={() => onSelect(stall.id)}>
              {selected === stall.id && <Icon name="check"/>}<strong>{stall.code}</strong><small>{statusLabels[stall.status]}</small>
            </button>)}
          </div>
          {index < rows.length - 1 && <div className="walkway">ทางเดิน</div>}
        </div>;
      })}
      <div className="entrance"><Icon className="entrance-arrow"/>{plan.market.entrance}<Icon className="entrance-arrow"/></div>
    </div></div></div>
    <p className="map-hint">กดล็อกเพื่อดูขนาด ราคา และสถานะ • เลื่อนผังเพื่อดูพื้นที่ทั้งหมด</p>
  </div>;
}
