/** Ilustraciones SVG originales de los demos 4–6 (paleta Solar Editorial: navy, petróleo, ámbar, salvia). */
const N = '#102B40', T = '#176B70', A = '#F2BD55', S = '#CDE1D9', M = '#FCFBF8', G = '#79B1B3';

function Panel({ x, y, w = 56 }: { x: number; y: number; w?: number }) {
  return <g><path d={`M${x} ${y} h${w} l-9 -30 h-${w} Z`} fill={T} stroke={N} strokeWidth="1.6" strokeLinejoin="round" />
    <path d={`M${x + w / 2 - 4} ${y} l-5 -30 M${x + 8} ${y - 15} h${w - 12}`} stroke="#8CC9C5" strokeWidth="1.2" /></g>;
}
function Torre({ x, y }: { x: number; y: number }) {
  return <g stroke={N} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"><path d={`m${x - 16} ${y} 16 -86 16 86M${x} ${y - 86}v-12M${x - 22} ${y - 70}h44M${x - 17} ${y - 50}h34M${x - 10} ${y - 30}l20 -20M${x + 10} ${y - 30}l-20 -20`} /></g>;
}

/** Demo 4 — resolución aprobada y contratos. */
export function IlustracionAprobada({ className }: { className?: string }) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 360 240" fill="none">
    <circle cx="280" cy="62" r="38" fill={A} />
    <path d="M18 206h324M40 218h280" stroke={G} strokeOpacity=".4" strokeWidth="1.5" />
    <Torre x={312} y={206} />
    <g transform="rotate(-5 120 120)">
      <rect x="64" y="44" width="120" height="156" rx="10" fill={M} stroke={N} strokeWidth="2.4" />
      <path d="M84 76h60M84 92h80M84 108h52M84 124h70" stroke={T} strokeWidth="3" strokeLinecap="round" />
      <path d="M84 166h46" stroke={N} strokeWidth="2.4" strokeLinecap="round" /><path d="M88 160c6-14 12 6 18-4s8 8 20-2" stroke="#1D3FA0" strokeWidth="2" strokeLinecap="round" />
      <circle cx="168" cy="184" r="26" fill={S} stroke={T} strokeWidth="2.4" />
      <path d="m156 184 9 9 17-19" stroke={T} strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    <Panel x={206} y={190} w={52} /><Panel x={262} y={190} w={52} />
    <path d="M230 160c20-20 40-18 60-6" stroke={A} strokeWidth="2" strokeDasharray="4 6" strokeLinecap="round" />
    <circle cx="86" cy="36" r="4" fill={A} /><circle cx="206" cy="26" r="3" fill={S} />
  </svg>;
}

/** Demo 5 — medidor bidireccional con flechas de intercambio. */
export function IlustracionMedidor({ className }: { className?: string }) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 360 240" fill="none">
    <circle cx="288" cy="54" r="34" fill={A} />
    <path d="M18 212h324M44 224h272" stroke={G} strokeOpacity=".4" strokeWidth="1.5" />
    <rect x="112" y="40" width="136" height="168" rx="22" fill={M} stroke={N} strokeWidth="2.6" />
    <rect x="128" y="58" width="104" height="42" rx="8" fill={N} />
    <path d="M142 80h12m6 0h12m6 0h12m6 0h12m6 0h12" stroke={A} strokeWidth="5" strokeLinecap="round" />
    <circle cx="180" cy="140" r="34" fill={S} stroke={T} strokeWidth="2.4" />
    <path d="M180 140 160 124M180 108v-6M148 140h-6M212 140h6" stroke={N} strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="180" cy="140" r="5" fill={N} />
    <path d="M132 188h96" stroke={G} strokeWidth="3" strokeLinecap="round" />
    <g strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M52 112h40m0 0-10-10m10 10-10 10" stroke={T} /><path d="M268 140h-40m0 0 10-10m-10 10 10 10" stroke={A} />
      <path d="M52 156h40m-40 0 10-10m-10 10 10 10" stroke={A} /><path d="M268 96h40m0 0-10-10m10 10-10 10" stroke={T} />
    </g>
    <Torre x={326} y={208} />
    <path d="M20 192 36 168l16 24v20H20Z" fill={S} stroke={N} strokeWidth="2" strokeLinejoin="round" />
  </svg>;
}

/** Demo 6 — sistema fotovoltaico interconectado a la red. */
export function IlustracionInterconectada({ className }: { className?: string }) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 360 240" fill="none">
    <circle cx="86" cy="52" r="36" fill={A} />
    <path d="M18 214h324M44 226h272" stroke={G} strokeOpacity=".4" strokeWidth="1.5" />
    <path d="M40 206v-70l76-44 76 44v70Z" fill={M} stroke={N} strokeWidth="2.4" strokeLinejoin="round" />
    <rect x="90" y="156" width="26" height="50" rx="3" fill={S} stroke={N} strokeWidth="2" />
    <rect x="130" y="152" width="34" height="28" rx="3" fill={S} stroke={N} strokeWidth="2" />
    <Panel x={62} y={128} w={46} /><Panel x={112} y={128} w={46} />
    <Torre x={300} y={214} />
    <path d="M192 168c36 0 54-30 84-52" stroke={T} strokeWidth="2.6" strokeLinecap="round" /><path d="M192 168c36 0 54-30 84-52" stroke={A} strokeWidth="2.6" strokeLinecap="round" strokeDasharray="2 12" />
    <circle cx="192" cy="168" r="6" fill={T} /><circle cx="276" cy="116" r="6" fill={A} />
    <path d="m246 30 6-12 6 12 12 6-12 6-6 12-6-12-12-6Z" fill={A} /><path d="m208 70 3-6 3 6 6 3-6 3-3 6-3-6-6-3Z" fill={S} />
  </svg>;
}
