/**
 * Seis ilustraciones SVG originales (una por demo), con la misma geometría simple y línea limpia.
 * `claro` = para fondos claros (trazo navy); `oscuro` = para fondos navy/teal (trazo marfil).
 */
const AM = '#F2BD55', TE = '#176B70', NA = '#102B40', SA = '#C9DFD6', MA = '#FCFBF8', HI = '#DCE7ED';

export interface PropsIlus { className?: string; tono?: 'claro' | 'oscuro' }
const paleta = (tono: 'claro' | 'oscuro' = 'claro') => tono === 'oscuro'
  ? { trazo: '#E8F0F2', papel: MA, tinta: NA, suelo: '#8FBDBE', sol: AM }
  : { trazo: NA, papel: MA, tinta: NA, suelo: '#79B1B3', sol: AM };

const Marco = ({ className, children }: { className?: string; children: React.ReactNode }) =>
  <svg aria-hidden="true" focusable="false" className={className} viewBox="0 0 420 300" fill="none" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;

function Torre({ x, y, c }: { x: number; y: number; c: string }) {
  return <path d={`m${x - 18} ${y} 18 -100 18 100M${x} ${y - 100}v-14M${x - 26} ${y - 82}h52M${x - 20} ${y - 58}h40M${x - 12} ${y - 34}l24 -24M${x + 12} ${y - 34}l-24 -24`} stroke={c} strokeWidth="2.6" />;
}
function Panel({ x, y, w = 62, fill = TE, c }: { x: number; y: number; w?: number; fill?: string; c: string }) {
  return <g><path d={`M${x} ${y} h${w} l-10 -34 h-${w} Z`} fill={fill} stroke={c} strokeWidth="2" />
    <path d={`M${x + w / 2 - 5} ${y} l-5 -34M${x + 9} ${y - 17} h${w - 14}`} stroke="#A8D6D2" strokeWidth="1.4" /></g>;
}

/** Demo 1 — formulario, identificación y lápiz. */
export function IlusCaptura({ className, tono }: PropsIlus) {
  const p = paleta(tono);
  return <Marco className={className}>
    <circle cx="322" cy="70" r="40" fill={p.sol} />
    <path d="M24 262h372" stroke={p.suelo} strokeOpacity=".5" strokeWidth="2" />
    <rect x="78" y="40" width="160" height="214" rx="14" fill={p.papel} stroke={p.trazo} strokeWidth="3" />
    <rect x="98" y="62" width="70" height="10" rx="5" fill={TE} />
    {[0, 1, 2, 3].map((i) => <g key={i}><rect x="98" y={92 + i * 38} width="120" height="8" rx="4" fill={p.tinta} opacity=".16" /><rect x="98" y={106 + i * 38} width="120" height="16" rx="5" stroke={p.tinta} strokeOpacity=".4" strokeWidth="2" /></g>)}
    <path d="M104 114l4 4 8-9M104 152h20" stroke={TE} strokeWidth="3" />
    <g transform="rotate(-6 290 200)"><rect x="196" y="170" width="170" height="108" rx="14" fill={HI} stroke={p.trazo} strokeWidth="3" />
      <circle cx="240" cy="212" r="17" fill={TE} /><path d="M214 256a26 24 0 0 1 52 0" fill={TE} />
      <path d="M284 196h62M284 214h50M284 232h58M284 250h34" stroke={p.tinta} strokeWidth="4" opacity=".55" /></g>
    <g transform="rotate(38 330 120)"><rect x="318" y="76" width="22" height="108" rx="5" fill={AM} stroke={p.trazo} strokeWidth="3" /><path d="M318 184l11 24 11-24Z" fill={MA} stroke={p.trazo} strokeWidth="3" /><path d="M326 202l3 8 3-8Z" fill={NA} /></g>
  </Marco>;
}

/** Demo 2 — carpeta documental, checklist y revisión. */
export function IlusDocumentos({ className, tono }: PropsIlus) {
  const p = paleta(tono);
  return <Marco className={className}>
    <circle cx="336" cy="66" r="36" fill={p.sol} />
    <path d="M24 262h372" stroke={p.suelo} strokeOpacity=".5" strokeWidth="2" />
    <path d="M50 120h74l16 18h140a14 14 0 0 1 14 14v100a14 14 0 0 1-14 14H64a14 14 0 0 1-14-14Z" fill={SA} stroke={p.trazo} strokeWidth="3" />
    {[0, 1, 2].map((i) => <rect key={i} x={72 + i * 22} y={78 - i * 4 + (i === 2 ? 20 : 0)} width="130" height="120" rx="8" fill={p.papel} stroke={p.trazo} strokeWidth="2.6" transform={`rotate(${-6 + i * 5} ${137 + i * 22} 160)`} />)}
    <path d="M50 170h294v82a14 14 0 0 1-14 14H64a14 14 0 0 1-14-14Z" fill={TE} stroke={p.trazo} strokeWidth="3" />
    <path d="M74 200h120M74 222h84" stroke={SA} strokeWidth="5" />
    <rect x="236" y="48" width="132" height="150" rx="12" fill={p.papel} stroke={p.trazo} strokeWidth="3" />
    {[0, 1, 2].map((i) => <g key={i}><rect x="252" y={68 + i * 38} width="22" height="22" rx="6" fill={i < 2 ? TE : AM} /><path d={i < 2 ? `m257 ${79 + i * 38} 5 5 8-10` : `M257 ${79 + i * 38}h12`} stroke={MA} strokeWidth="3" /><path d={`M284 ${74 + i * 38}h66M284 ${86 + i * 38}h46`} stroke={p.tinta} strokeWidth="4" opacity=".5" /></g>)}
    <circle cx="330" cy="212" r="30" fill={p.papel} stroke={p.trazo} strokeWidth="3.4" /><path d="m352 234 26 26" stroke={p.trazo} strokeWidth="7" /><path d="m318 212 9 9 17-19" stroke={TE} strokeWidth="4" />
  </Marco>;
}

/** Demo 3 — carpeta completa, calendario y verificación. */
export function IlusVisita({ className, tono }: PropsIlus) {
  const p = paleta(tono);
  return <Marco className={className}>
    <circle cx="96" cy="70" r="34" fill={p.sol} />
    <path d="M24 262h372" stroke={p.suelo} strokeOpacity=".5" strokeWidth="2" />
    <path d="M40 130h70l14 16h110a14 14 0 0 1 14 14v92a14 14 0 0 1-14 14H54a14 14 0 0 1-14-14Z" fill={SA} stroke={p.trazo} strokeWidth="3" />
    <rect x="62" y="96" width="120" height="110" rx="8" fill={p.papel} stroke={p.trazo} strokeWidth="2.6" /><path d="M80 124h84M80 144h64" stroke={TE} strokeWidth="4" />
    <path d="M40 176h262v76a14 14 0 0 1-14 14H54a14 14 0 0 1-14-14Z" fill={TE} stroke={p.trazo} strokeWidth="3" /><path d="M62 206h100M62 226h70" stroke={SA} strokeWidth="5" />
    <rect x="226" y="52" width="148" height="160" rx="16" fill={p.papel} stroke={p.trazo} strokeWidth="3" />
    <path d="M226 90h148" stroke={p.trazo} strokeWidth="3" /><path d="M242 68a16 16 0 0 1 16-16h100a16 16 0 0 1 16 16v22H242Z" fill={NA} /><path d="M262 40v24M338 40v24" stroke={AM} strokeWidth="6" />
    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <circle key={i} cx={252 + (i % 4) * 32} cy={118 + Math.floor(i / 4) * 34} r="5" fill={i === 5 ? 'transparent' : p.tinta} opacity={i === 5 ? 1 : 0.22} />)}
    <circle cx="316" cy="152" r="17" fill={TE} /><path d="m308 152 6 6 11-12" stroke={MA} strokeWidth="4" />
    <circle cx="352" cy="204" r="32" fill={AM} stroke={p.trazo} strokeWidth="3" /><path d="m337 204 11 11 20-23" stroke={NA} strokeWidth="5" />
  </Marco>;
}

/** Demo 4 — documento grande con marca de verificación teal y círculo solar ámbar (aprobación de CFE). */
export function IlusAprobada({ className, tono }: PropsIlus) {
  const p = paleta(tono);
  return <Marco className={className}>
    <circle cx="316" cy="84" r="62" fill={p.sol} />
    <path d="M24 270h372" stroke={p.suelo} strokeOpacity=".55" strokeWidth="2" />
    <Torre x={366} y={270} c={p.trazo} />
    <g transform="rotate(-4 160 150)">
      <rect x="62" y="26" width="196" height="240" rx="16" fill={p.papel} stroke={p.trazo} strokeWidth="3.4" />
      <rect x="86" y="52" width="82" height="12" rx="6" fill={TE} />
      <path d="M86 90h148M86 112h148M86 134h110" stroke={p.tinta} strokeWidth="6" opacity=".22" />
      <path d="M86 170h60" stroke={p.tinta} strokeWidth="4" opacity=".45" /><path d="M92 164c9-22 17 8 27-6s12 12 28-3" stroke="#1D3FA0" strokeWidth="2.6" />
      <circle cx="226" cy="232" r="52" fill={TE} stroke={p.papel} strokeWidth="6" />
      <path d="m200 232 20 20 36-40" stroke={MA} strokeWidth="9" />
    </g>
    <path d="M270 214c18-18 40-18 62-4" stroke={AM} strokeWidth="2.6" strokeDasharray="2 10" />
    <Panel x={286} y={250} w={58} c={p.trazo} />
  </Marco>;
}

/** Demo 5 — medidor bidireccional con flechas de intercambio. */
export function IlusMedidor({ className, tono }: PropsIlus) {
  const p = paleta(tono);
  return <Marco className={className}>
    <circle cx="332" cy="70" r="40" fill={p.sol} />
    <path d="M24 270h372" stroke={p.suelo} strokeOpacity=".5" strokeWidth="2" />
    <rect x="120" y="36" width="170" height="218" rx="26" fill={p.papel} stroke={p.trazo} strokeWidth="3.4" />
    <rect x="140" y="58" width="130" height="52" rx="10" fill={NA} />
    <path d="M156 84h14m8 0h14m8 0h14m8 0h14m8 0h14" stroke={AM} strokeWidth="6" />
    <circle cx="205" cy="168" r="42" fill={SA} stroke={TE} strokeWidth="3" /><path d="m205 168-20-20" stroke={p.tinta} strokeWidth="3.4" /><circle cx="205" cy="168" r="6" fill={p.tinta} />
    <path d="M148 226h114" stroke={p.suelo} strokeWidth="4" />
    <g strokeWidth="4.4"><path d="M44 110h52m0 0-13-13m13 13-13 13" stroke={AM} /><path d="M96 152H44m0 0 13-13m-13 13 13 13" stroke={p.trazo === NA ? TE : '#8FD0CB'} />
      <path d="M314 170h52m0 0-13-13m13 13-13 13" stroke={p.trazo === NA ? TE : '#8FD0CB'} /><path d="M366 212h-52m0 0 13-13m-13 13 13 13" stroke={AM} /></g>
    <path d="M30 232 52 196l22 36v36H30Z" fill={SA} stroke={p.trazo} strokeWidth="2.6" /><Torre x={384} y={270} c={p.trazo} />
  </Marco>;
}

/** Demo 6 — instalación solar conectada con marca de verificación. */
export function IlusConectada({ className, tono }: PropsIlus) {
  const p = paleta(tono);
  return <Marco className={className}>
    <circle cx="100" cy="70" r="40" fill={p.sol} />
    <path d="M24 270h372" stroke={p.suelo} strokeOpacity=".6" strokeWidth="2" />
    <path d="M52 262v-96l100-58 100 58v96Z" fill={p.papel} stroke={p.trazo} strokeWidth="3.4" />
    <rect x="112" y="196" width="36" height="66" rx="4" fill={SA} stroke={p.tinta} strokeWidth="2.6" /><rect x="168" y="188" width="50" height="40" rx="4" fill={SA} stroke={p.tinta} strokeWidth="2.6" />
    <Panel x={84} y={150} w={58} c={p.tinta} /><Panel x={148} y={150} w={58} c={p.tinta} />
    <Torre x={352} y={270} c={p.trazo} />
    <path d="M252 214c46 0 70-40 98-72" stroke={p.trazo === NA ? TE : '#8FD0CB'} strokeWidth="3" /><path d="M252 214c46 0 70-40 98-72" stroke={AM} strokeWidth="3" strokeDasharray="2 14" />
    <circle cx="252" cy="214" r="7" fill={AM} /><circle cx="350" cy="142" r="7" fill={AM} />
    <circle cx="296" cy="72" r="34" fill={AM} stroke={p.trazo} strokeWidth="3" /><path d="m280 72 12 12 22-26" stroke={NA} strokeWidth="6" />
    <path d="m214 44 6-14 6 14 14 6-14 6-6 14-6-14-14-6Z" fill={AM} /><path d="m376 214 4-9 4 9 9 4-9 4-4 9-4-9-9-4Z" fill={SA} />
  </Marco>;
}
