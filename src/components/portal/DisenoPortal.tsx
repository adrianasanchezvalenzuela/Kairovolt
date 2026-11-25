import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, SunMedium, Zap } from 'lucide-react';

export function MarcaPortal() {
  return <div className="kv-cliente-marca">
    <span className="kv-cliente-marca__sello"><Zap size={20} aria-hidden="true" /></span>
    <div><strong>KairóVolt</strong><small>IDC Sistemas Eléctricos</small></div>
  </div>;
}

export function EnergiaPortal({ className }: { className?: string }) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 440 280" fill="none">
    <circle cx="316" cy="79" r="47" fill="#F2BD55" />
    <path d="M34 220h371M48 232h338M63 243h305" stroke="#79B1B3" strokeOpacity=".32" />
    <path d="m47 188 91-53h91l-57 53H47Zm139 0 60-53h98l-25 53H186Z" fill="#176B70" stroke="#8CC9C5" strokeWidth="2" strokeLinejoin="round" />
    <path d="m74 172 118-1m-88-16h107m-123 33 79-53m-39 53 69-53m13 37h116m-96-17h104m-105 33 52-53m-15 53 42-53M76 189v23m78-23v23m59-23v23m87-23v23" stroke="#8CC9C5" strokeWidth="1.6" strokeLinecap="round" />
    <path d="m360 219 18-110 19 110m-19-110V79m-23 55h46m-38 22h31m-31 10 31 29m0-29-31 29m-6 0h43" stroke="#B9D9DC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M37 201 17 190v-59l40-23h74m86 87v24h135m-2-85c-67 0-82-32-128-32h-45" stroke="#7CB9BB" strokeWidth="1.6" strokeDasharray="4 6" strokeLinecap="round" />
    <circle cx="131" cy="108" r="4" fill="#F2BD55"/><circle cx="176" cy="102" r="4" fill="#E3EFED"/>
    <circle cx="351" cy="219" r="4" fill="#F2BD55"/>
  </svg>;
}

export function IlustracionExpediente({ variante }: { variante: 'identidad' | 'documentos' | 'validacion' | 'visita' }) {
  if (variante === 'visita') return <IlustracionVisita className="kv-cliente-ilustracion" />;
  return <svg aria-hidden="true" className="kv-cliente-ilustracion" viewBox="0 0 138 92" fill="none">
    <circle cx="100" cy="30" r="24" fill="#F2BD55" />
    <path d="M14 68h107M25 78h86" stroke="#176B70" strokeOpacity=".35" />
    <path d="M30 27h63l9 9v34H30z" fill="#FCFBF8" stroke="#102B40" strokeWidth="2" strokeLinejoin="round" />
    {variante === 'identidad' ? <>
      <circle cx="47" cy="43" r="6" fill="#176B70" /><path d="M37 60a10 9 0 0 1 20 0m10-15h21m-21 9h15" stroke="#176B70" strokeWidth="2" strokeLinecap="round" />
    </> : variante === 'validacion' ? <>
      <circle cx="65" cy="48" r="14" fill="#CDE1D9" /><path d="m57 48 6 6 11-12" stroke="#176B70" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </> : <path d="M43 42h34M43 50h39M43 58h25m21-29v9h11" stroke="#176B70" strokeWidth="2" strokeLinecap="round" />}
    <path d="M14 60V20h46m50 29h14" stroke="#176B70" strokeDasharray="3 5" strokeLinecap="round" />
  </svg>;
}

/** Ilustración SVG de carpeta documental y calendario coherente con Solar Editorial Premium. */
export function IlustracionVisita({ className }: { className?: string }) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 210 140" fill="none">
    <circle cx="158" cy="42" r="30" fill="#F2BD55" />
    <path d="M18 118h174M34 127h142" stroke="#79B1B3" strokeOpacity=".4" strokeWidth="1.5" />
    {/* Carpeta documental */}
    <path d="M26 44h36l10 10h54a8 8 0 0 1 8 8v50a6 6 0 0 1-6 6H32a6 6 0 0 1-6-6V44Z" fill="#C9DED5" stroke="#102B40" strokeWidth="2" strokeLinejoin="round" />
    <rect x="38" y="34" width="66" height="46" rx="5" fill="#FCFBF8" stroke="#102B40" strokeWidth="1.8" />
    <path d="M49 48h34M49 58h44M49 68h26" stroke="#176B70" strokeWidth="2" strokeLinecap="round" />
    <path d="M26 62h108v49a6 6 0 0 1-6 6H32a6 6 0 0 1-6-6V62Z" fill="#176B70" stroke="#102B40" strokeWidth="2" strokeLinejoin="round" />
    <path d="M42 78h46M42 90h30" stroke="#CDE1D9" strokeWidth="2" strokeLinecap="round" />
    {/* Calendario superpuesto */}
    <rect x="114" y="48" width="70" height="68" rx="10" fill="#FCFBF8" stroke="#102B40" strokeWidth="2" />
    <path d="M114 66h70" stroke="#102B40" strokeWidth="2" />
    <path d="M114 58a10 10 0 0 1 10-10h50a10 10 0 0 1 10 10v8h-70v-8Z" fill="#102B40" />
    <path d="M132 42v12M166 42v12" stroke="#F2BD55" strokeWidth="3" strokeLinecap="round" />
    <circle cx="131" cy="80" r="3.5" fill="#DCE5E8" />
    <circle cx="149" cy="80" r="3.5" fill="#DCE5E8" />
    <circle cx="167" cy="80" r="3.5" fill="#DCE5E8" />
    <circle cx="131" cy="96" r="3.5" fill="#DCE5E8" />
    <circle cx="149" cy="96" r="7.5" fill="#176B70" />
    <path d="m145.5 96 2.5 2.5 4.8-5" stroke="#FCFBF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="167" cy="96" r="3.5" fill="#F2BD55" />
  </svg>;
}

/** Ejemplo ilustrativo de croquis de ubicación (calles, instalación, referencias y Norte). NO es un formato oficial. */
export function IlustracionCroquis() {
  return <figure className="kv-guia-visual">
    <svg role="img" aria-label="Ejemplo ilustrativo de croquis con calles, ubicación de la instalación, referencias cercanas y orientación al Norte" viewBox="0 0 420 220" fill="none">
      <rect width="420" height="220" rx="14" fill="#FCFBF8" stroke="#D2DEE3" />
      {/* Manzanas */}
      <rect x="20" y="22" width="110" height="62" rx="6" fill="#F4F1E8" />
      <rect x="166" y="22" width="128" height="62" rx="6" fill="#F4F1E8" />
      <rect x="330" y="22" width="70" height="62" rx="6" fill="#DCE5E8" />
      <rect x="20" y="122" width="110" height="76" rx="6" fill="#F4F1E8" />
      <rect x="166" y="122" width="128" height="76" rx="6" fill="#C9DED5" stroke="#176B70" strokeWidth="1.5" />
      <rect x="330" y="122" width="70" height="76" rx="6" fill="#F4F1E8" />
      {/* Calles */}
      <path d="M14 103h392" stroke="#102B40" strokeWidth="24" strokeOpacity=".08" />
      <path d="M148 14v192M312 14v192" stroke="#102B40" strokeWidth="20" strokeOpacity=".08" />
      <path d="M18 103h384" stroke="#526778" strokeDasharray="5 5" strokeWidth="1.2" />
      {/* Etiquetas de calles */}
      <rect x="166" y="95" width="142" height="16" rx="4" fill="#FCFBF8" />
      <text x="172" y="107" fill="#102B40" fontSize="11" fontWeight="700" fontFamily="sans-serif">Blvd. Principal (ejemplo)</text>
      <text x="143" y="185" fill="#526778" fontSize="10" fontWeight="600" fontFamily="sans-serif" transform="rotate(-90 143 185)">Calle Poniente</text>
      <text x="307" y="185" fill="#526778" fontSize="10" fontWeight="600" fontFamily="sans-serif" transform="rotate(-90 307 185)">Calle Oriente</text>
      {/* Ubicación de instalación */}
      <circle cx="228" cy="156" r="14" fill="#176B70" />
      <path d="m222 157 6-7 6 7h-12Z" fill="#F2BD55" />
      <text x="178" y="186" fill="#102B40" fontSize="10.5" fontWeight="700" fontFamily="sans-serif">Tu instalación FV</text>
      {/* Referencia cercana */}
      <rect x="342" y="34" width="46" height="24" rx="4" fill="#FCFBF8" stroke="#526778" strokeWidth="1.2" />
      <text x="346" y="49" fill="#102B40" fontSize="8.5" fontWeight="700" fontFamily="sans-serif">Ref. / Plaza</text>
      <text x="336" y="75" fill="#526778" fontSize="9" fontFamily="sans-serif">Referencia</text>
      {/* Rosa de los vientos / Norte */}
      <g transform="translate(56 53)">
        <circle cx="0" cy="0" r="18" fill="#FCFBF8" stroke="#102B40" strokeWidth="1.5" />
        <path d="m0-11 4.5 11H-4.5L0-11Z" fill="#176B70" />
        <path d="m0 11 4.5-11H-4.5L0 11Z" fill="#DCE5E8" />
        <text x="-3.5" y="-13" fill="#102B40" fontSize="9" fontWeight="800" fontFamily="sans-serif">N</text>
      </g>
    </svg>
    <figcaption>Ejemplo ilustrativo orientativo (no es un formato oficial). Incluye calles, tu instalación, referencias visibles y el Norte.</figcaption>
  </figure>;
}

/** Guía visual ilustrativa para tomar fotografías claras del sistema fotovoltaico. */
export function IlustracionFotosSistema() {
  const cuadros = [
    {
      titulo: '1. Vista general',
      detalle: 'Encuadra el inmueble y el área donde se ubica el sistema.',
      svg: <>
        <rect x="12" y="14" width="96" height="58" rx="6" fill="#DCE5E8" />
        <circle cx="92" cy="26" r="8" fill="#F2BD55" />
        <path d="M24 58h72V40l-36-13-36 13v18Z" fill="#FCFBF8" stroke="#102B40" strokeWidth="1.6" />
        <path d="m42 36 18-6 18 6-6 9H48l-6-9Z" fill="#176B70" />
      </>,
    },
    {
      titulo: '2. Paneles solares',
      detalle: 'Muestra los módulos montados con buena iluminación.',
      svg: <>
        <rect x="12" y="14" width="96" height="58" rx="6" fill="#E3EFED" />
        <path d="m22 58 18-30h58L80 58H22Z" fill="#176B70" stroke="#102B40" strokeWidth="1.6" />
        <path d="M36 44h54M48 28 36 58M68 28 56 58" stroke="#C9DED5" strokeWidth="1.4" />
      </>,
    },
    {
      titulo: '3. Inversores',
      detalle: 'Enfoca el inversor en operación y su placa visible.',
      svg: <>
        <rect x="12" y="14" width="96" height="58" rx="6" fill="#F4F1E8" />
        <rect x="38" y="21" width="44" height="44" rx="5" fill="#FCFBF8" stroke="#102B40" strokeWidth="1.8" />
        <rect x="47" y="29" width="26" height="11" rx="2" fill="#102B40" />
        <circle cx="51" cy="50" r="3" fill="#176B70" />
        <path d="M58 50h14" stroke="#526778" strokeWidth="2" strokeLinecap="round" />
      </>,
    },
    {
      titulo: '4. Tablero / medidor',
      detalle: 'Agrega protecciones o medidor cuando IDC lo solicite.',
      svg: <>
        <rect x="12" y="14" width="96" height="58" rx="6" fill="#FCF0D5" />
        <rect x="30" y="22" width="26" height="42" rx="4" fill="#FCFBF8" stroke="#102B40" strokeWidth="1.6" />
        <circle cx="77" cy="43" r="14" fill="#FCFBF8" stroke="#102B40" strokeWidth="1.6" />
        <rect x="69" y="39" width="16" height="7" rx="1.5" fill="#176B70" />
      </>,
    },
  ];
  return <div className="kv-guia-fotos" aria-label="Ejemplos ilustrativos de fotografías del sistema">
    {cuadros.map((c) => <figure key={c.titulo}>
      <svg aria-hidden="true" viewBox="0 0 120 82" fill="none">{c.svg}</svg>
      <figcaption><strong>{c.titulo}</strong><span>{c.detalle}</span></figcaption>
    </figure>)}
  </div>;
}

export function PortadaPortal({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return <header className="kv-cliente-portada"><h1>{titulo}</h1>{children && <p>{children}</p>}</header>;
}

export function EnlacePortal({ to, children, secundario = false }: { to: string; children: ReactNode; secundario?: boolean }) {
  return <Link to={to} className={secundario ? 'kv-cliente-enlace' : 'kvp-boton'}>{children}<ArrowUpRight size={17} aria-hidden="true" /></Link>;
}

export function CargaPortal({ etiqueta }: { etiqueta: string }) {
  return <div className="kv-cliente-carga" role="status">
    <SunMedium size={24} aria-hidden="true" /><p>{etiqueta}</p>
    <div aria-hidden="true"><i /><i /><i /></div>
  </div>;
}
