import type { ReactNode } from 'react';
import { ExternalLink, Info } from 'lucide-react';

/** Recursos visuales de las guías documentales. Todos los ejemplos son ficticios y se identifican como tales. */
const N = '#102B40', T = '#176B70', A = '#F2BD55', M = '#CDE1D9', P = '#FCFBF8', G = '#8CA0AC';
const VERIFICADO = 'enlace verificado el 26/11/2026';

function Marco({ titulo, children, nota }: { titulo: string; children: ReactNode; nota?: string }) {
  return <figure className="kv-gv">
    <div className="kv-gv__lienzo">{children}</div>
    <figcaption><strong>{titulo}</strong>{nota && <span>{nota}</span>}</figcaption>
  </figure>;
}
function Etiqueta({ x, y, n }: { x: number; y: number; n: number }) {
  return <g><circle cx={x} cy={y} r="9" fill={A} stroke={N} strokeWidth="1.4" /><text x={x} y={y + 3.6} textAnchor="middle" fontSize="10" fontWeight="800" fill={N} fontFamily="sans-serif">{n}</text></g>;
}
function Llamadas({ items }: { items: string[] }) {
  return <ol className="kv-gv__llamadas">{items.map((t, i) => <li key={t}><b>{i + 1}</b>{t}</li>)}</ol>;
}
function Enlaces({ enlaces }: { enlaces: [string, string][] }) {
  return <div className="kv-gv__enlaces">{enlaces.map(([t, u]) =>
    <a key={u} href={u} target="_blank" rel="noreferrer" className="kvp-boton kvp-boton--suave"><ExternalLink size={16} aria-hidden="true" /> {t}</a>)}
    <small>{VERIFICADO}</small></div>;
}
const Ficticio = () => <p className="kv-gv__nota"><Info size={15} aria-hidden="true" /> Ejemplo ilustrativo ficticio de KairóVolt. No es un documento oficial ni muestra datos reales.</p>;
const Lineas = ({ x, y, w, n, gap = 9 }: { x: number; y: number; w: number; n: number; gap?: number }) =>
  <>{Array.from({ length: n }, (_, i) => <rect key={i} x={x} y={y + i * gap} width={i % 3 === 2 ? w * 0.6 : w} height="3.5" rx="1.7" fill="#D9E3E8" />)}</>;

function ReciboCfe() {
  return <>
    <Marco titulo="Recibo de ejemplo con los campos que IDC revisa">
      <svg viewBox="0 0 340 230" role="img" aria-label="Recibo ilustrativo con cuatro campos señalados">
        <rect x="70" y="8" width="200" height="214" rx="8" fill={P} stroke={N} strokeWidth="1.6" />
        <rect x="70" y="8" width="200" height="30" rx="8" fill={T} /><text x="84" y="28" fill="#fff" fontSize="12" fontWeight="800" fontFamily="sans-serif">RECIBO · EJEMPLO</text>
        <rect x="84" y="50" width="120" height="8" rx="3" fill={N} opacity=".75" /><Lineas x={84} y={64} w={150} n={2} />
        <rect x="84" y="92" width="84" height="8" rx="3" fill={N} opacity=".75" /><rect x="84" y="106" width="130" height="5" rx="2" fill="#D9E3E8" />
        <rect x="84" y="128" width="182" height="34" rx="6" fill={M} /><text x="94" y="149" fontSize="11" fontWeight="800" fill={N} fontFamily="sans-serif">Total a pagar</text><text x="226" y="150" fontSize="12" fontWeight="800" fill={T} fontFamily="sans-serif">$ 0.00</text>
        <Lineas x={84} y={176} w={170} n={4} />
        <Etiqueta x={52} y={54} n={1} /><Etiqueta x={52} y={96} n={2} /><Etiqueta x={52} y={146} n={3} /><Etiqueta x={52} y={190} n={4} />
        <path d="M60 54h10M60 96h10M60 146h14M60 190h10" stroke={A} strokeWidth="2" />
      </svg>
    </Marco>
    <Llamadas items={['Nombre del titular del servicio', 'Número de servicio y RPU', 'Total a pagar: sin adeudos en el último corte', 'Fechas del periodo: que se lea completo']} />
    <Enlaces enlaces={[['Sitio de CFE', 'https://www.cfe.mx/'], ['Mi Espacio CFE', 'https://app.cfe.mx/Aplicaciones/CCFE/MiEspacio/Login.aspx']]} />
    <Ficticio />
  </>;
}

function Identificacion() {
  const tarjeta = (x: number, frente: boolean) => <g transform={`translate(${x} 20)`}>
    <rect width="150" height="96" rx="9" fill={P} stroke={N} strokeWidth="1.6" />
    <rect width="150" height="18" rx="9" fill={frente ? T : N} /><rect y="9" width="150" height="9" fill={frente ? T : N} />
    <text x="8" y="13" fontSize="8" fontWeight="800" fill="#fff" fontFamily="sans-serif">{frente ? 'IDENTIFICACIÓN · EJEMPLO FICTICIO' : 'REVERSO · EJEMPLO'}</text>
    {frente ? <><rect x="10" y="30" width="38" height="46" rx="5" fill={M} /><circle cx="29" cy="46" r="8" fill={G} /><path d="M16 74a13 11 0 0 1 26 0" fill={G} /><Lineas x={58} y={32} w={80} n={4} gap={10} /><rect x="58" y="76" width="56" height="5" rx="2" fill={A} /></>
      : <><rect x="10" y="30" width="130" height="14" fill="#D9E3E8" /><Lineas x={10} y={54} w={130} n={4} gap={9} /><rect x="96" y="76" width="44" height="12" rx="3" fill={M} /></>}
  </g>;
  return <>
    <Marco titulo="Frente y reverso, completos y sin reflejos">
      <svg viewBox="0 0 340 136" role="img" aria-label="Identificación ficticia, frente y reverso">{tarjeta(8, true)}{tarjeta(182, false)}</svg>
    </Marco>
    <ul className="kv-gv__consejos"><li>Foto con toda la tarjeta visible y las cuatro esquinas dentro del encuadre.</li><li>Sin flash directo ni dedos tapando datos.</li><li>Sube frente y reverso cuando la identificación tenga información por ambos lados.</li></ul>
    <Ficticio />
  </>;
}

function Constancia() {
  const pasos = ['Entra al portal del SAT', 'Inicia sesión con RFC y contraseña o e.firma', 'Busca «Constancia de situación fiscal»', 'Genera y descarga el PDF'];
  return <>
    <ol className="kv-gv__pasos">{pasos.map((p, i) => <li key={p}><b>{i + 1}</b><span>{p}</span></li>)}</ol>
    <Marco titulo="Cómo luce una constancia (ejemplo ficticio)">
      <svg viewBox="0 0 340 170" role="img" aria-label="Constancia ficticia">
        <rect x="90" y="6" width="160" height="158" rx="7" fill={P} stroke={N} strokeWidth="1.5" /><rect x="90" y="6" width="160" height="22" rx="7" fill={N} /><text x="100" y="21" fill="#fff" fontSize="9" fontWeight="800" fontFamily="sans-serif">CONSTANCIA · EJEMPLO</text>
        <rect x="102" y="40" width="70" height="7" rx="3" fill={T} /><Lineas x={102} y={54} w={136} n={3} /><rect x="102" y="90" width="136" height="26" rx="5" fill={M} /><Lineas x={102} y={126} w={136} n={4} />
        <Etiqueta x={72} y={44} n={1} /><Etiqueta x={72} y={103} n={2} />
      </svg>
    </Marco>
    <Llamadas items={['Nombre o razón social y RFC', 'Domicilio fiscal; revisa que el archivo sea reciente y legible']} />
    <Enlaces enlaces={[['Constancia en el SAT', 'https://www.sat.gob.mx/portal/public/tramites/constancia-de-situacion-fiscal'], ['Portal del SAT', 'https://www.sat.gob.mx/']]} />
    <Ficticio />
  </>;
}

function CartaPoderFirmas() {
  const caja = (x: number, y: number, t: string, n: number) => <g><rect x={x} y={y} width="84" height="34" rx="5" fill={M} stroke={T} strokeDasharray="4 3" /><text x={x + 42} y={y + 21} textAnchor="middle" fontSize="9" fontWeight="700" fill={N} fontFamily="sans-serif">{t}</text><Etiqueta x={x + 76} y={y + 2} n={n} /></g>;
  return <>
    <Marco titulo="Espacios de firma de la Carta Poder (ejemplo)">
      <svg viewBox="0 0 340 200" role="img" aria-label="Carta Poder con cuatro espacios de firma">
        <rect x="80" y="6" width="180" height="190" rx="7" fill={P} stroke={N} strokeWidth="1.5" /><text x="170" y="26" textAnchor="middle" fontSize="11" fontWeight="800" fill={N} fontFamily="sans-serif">CARTA PODER</text>
        <Lineas x={94} y={38} w={152} n={5} />{caja(94, 100, 'Otorgante', 1)}{caja(166, 100, 'Apoderado', 2)}{caja(94, 150, 'Testigo 1', 3)}{caja(166, 150, 'Testigo 2', 4)}
      </svg>
    </Marco>
    <Llamadas items={['Firma de quien otorga el poder (titular)', 'Firma de la persona apoderada o representante', 'Firma del primer testigo', 'Firma del segundo testigo']} />
    <p className="kv-gv__nota"><Info size={15} aria-hidden="true" /> Usa el generador de abajo para ver y descargar la Carta Poder de demostración. Es solo para revisar el diseño.</p>
  </>;
}

function Unifilar() {
  const caja = (x: number, t: string, c = M) => <g><rect x={x} y="60" width="52" height="40" rx="7" fill={c} stroke={N} strokeWidth="1.4" /><text x={x + 26} y="84" textAnchor="middle" fontSize="8.5" fontWeight="700" fill={N} fontFamily="sans-serif">{t}</text></g>;
  return <>
    <Marco titulo="Esquema unifilar ilustrativo" nota="Del campo solar a la red">
      <svg viewBox="0 0 340 150" role="img" aria-label="Diagrama unifilar ilustrativo: paneles, inversor, protecciones, medidor y red">
        <path d="M60 80h14M126 80h14M192 80h14M258 80h14" stroke={N} strokeWidth="2" />
        {caja(8, 'Paneles FV', '#F5DFAD')}{caja(74, 'Inversor')}{caja(140, 'Protecciones')}{caja(206, 'Medidor')}{caja(272, 'Red CFE', '#E0E9EC')}
        <text x="170" y="130" textAnchor="middle" fontSize="9" fill={G} fontFamily="sans-serif">Esquema ilustrativo, no es un diseño real</text>
      </svg>
    </Marco>
    <ul className="kv-gv__consejos"><li><strong>Quién lo elabora:</strong> quien diseña la instalación, por ejemplo el ingeniero o la empresa instaladora responsable del proyecto.</li><li>IDC revisa que el diagrama coincida con los equipos de tus fichas técnicas.</li></ul>
    <Ficticio />
  </>;
}

function Fichas() {
  return <>
    <div className="kv-gv__par">
      <Marco titulo="Panel solar · ejemplo">
        <svg viewBox="0 0 160 170" role="img" aria-label="Ficha técnica de panel de ejemplo"><rect x="14" y="6" width="132" height="158" rx="7" fill={P} stroke={N} strokeWidth="1.5" /><rect x="26" y="18" width="46" height="62" rx="3" fill={T} />{[0, 1, 2].map((i) => <path key={i} d={`M26 ${39 + i * 20}h46M${41 + i * 15} 18v62`} stroke="#8CC9C5" />)}<rect x="80" y="20" width="56" height="8" rx="3" fill={A} /><Lineas x={80} y={36} w={56} n={4} gap={9} /><Lineas x={26} y={96} w={110} n={6} /><Etiqueta x={146} y={24} n={1} /><Etiqueta x={146} y={104} n={2} /></svg>
      </Marco>
      <Marco titulo="Inversor · ejemplo">
        <svg viewBox="0 0 160 170" role="img" aria-label="Ficha técnica de inversor de ejemplo"><rect x="14" y="6" width="132" height="158" rx="7" fill={P} stroke={N} strokeWidth="1.5" /><rect x="30" y="18" width="52" height="44" rx="6" fill={M} stroke={T} /><circle cx="44" cy="30" r="3" fill={A} /><rect x="92" y="20" width="44" height="8" rx="3" fill={A} /><Lineas x={92} y={36} w={44} n={4} gap={9} /><Lineas x={26} y={80} w={110} n={7} /><Etiqueta x={146} y={24} n={1} /><Etiqueta x={146} y={96} n={2} /></svg>
      </Marco>
    </div>
    <Llamadas items={['Marca y modelo exactos (deben coincidir con tu diagrama)', 'Potencia y características eléctricas principales']} />
    <Ficticio />
  </>;
}

function Certificados() {
  return <>
    <Marco titulo="Certificado de ejemplo">
      <svg viewBox="0 0 340 170" role="img" aria-label="Certificado ficticio">
        <rect x="70" y="8" width="200" height="154" rx="8" fill={P} stroke={N} strokeWidth="1.5" /><rect x="82" y="20" width="176" height="130" rx="4" fill="none" stroke={A} strokeWidth="1.5" />
        <text x="170" y="44" textAnchor="middle" fontSize="12" fontWeight="800" fill={N} fontFamily="serif">CERTIFICADO · EJEMPLO</text><Lineas x={104} y={58} w={132} n={4} /><circle cx="170" cy="120" r="16" fill={M} stroke={T} strokeWidth="1.5" /><path d="m163 120 5 5 9-11" stroke={T} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <Etiqueta x={64} y={64} n={1} /><Etiqueta x={64} y={120} n={2} />
      </svg>
    </Marco>
    <Llamadas items={['Modelo del equipo certificado (debe coincidir con la ficha técnica)', 'Organismo que certifica y vigencia, si aplica']} />
    <ul className="kv-gv__consejos"><li><strong>Dónde conseguirlos:</strong> pídelos al fabricante o al distribuidor de tus paneles e inversor.</li></ul>
    <Ficticio />
  </>;
}

function Fotos() {
  return <Marco titulo="Una foto clara y una que se tendría que repetir">
    <svg viewBox="0 0 340 130" role="img" aria-label="Comparación de foto clara y foto borrosa">
      <g><rect x="12" y="8" width="150" height="100" rx="8" fill="#E7F0F2" stroke={N} /><circle cx="130" cy="30" r="12" fill={A} /><path d="M24 96l30-40h60l20 40z" fill={T} stroke={N} /><path d="M50 82h82M62 68h60" stroke="#8CC9C5" /><text x="87" y="124" textAnchor="middle" fontSize="10" fontWeight="700" fill={T} fontFamily="sans-serif">✔ Nítida y completa</text></g>
      <g opacity=".55" style={{ filter: 'blur(2px)' }}><rect x="178" y="8" width="150" height="100" rx="8" fill="#E7F0F2" stroke={N} /><path d="M200 96l30-40h60l20 40z" fill={T} /></g>
      <text x="253" y="124" textAnchor="middle" fontSize="10" fontWeight="700" fill="#8A5A0B" fontFamily="sans-serif">✖ Borrosa o cortada</text>
    </svg>
  </Marco>;
}

function Dictamen() {
  return <>
    <Marco titulo="Dictamen de ejemplo">
      <svg viewBox="0 0 340 170" role="img" aria-label="Dictamen ficticio">
        <rect x="70" y="8" width="200" height="154" rx="8" fill={P} stroke={N} strokeWidth="1.5" /><rect x="70" y="8" width="200" height="26" rx="8" fill={N} /><text x="82" y="26" fill="#fff" fontSize="10" fontWeight="800" fontFamily="sans-serif">DICTAMEN UVIE · EJEMPLO</text>
        <Lineas x={84} y={46} w={170} n={4} /><rect x="84" y="90" width="170" height="24" rx="5" fill={M} /><text x="94" y="106" fontSize="9.5" fontWeight="800" fill={T} fontFamily="sans-serif">Resultado de la verificación</text><Lineas x={84} y={126} w={120} n={3} />
        <Etiqueta x={62} y={52} n={1} /><Etiqueta x={62} y={102} n={2} />
      </svg>
    </Marco>
    <Llamadas items={['Datos del proyecto verificado (deben coincidir con tu expediente)', 'Resultado y firma de la unidad que lo emite']} />
    <ul className="kv-gv__consejos"><li><strong>Quién lo emite:</strong> una unidad de verificación (UVIE). IDC coordina contigo cuándo corresponde solicitarlo.</li></ul>
    <Ficticio />
  </>;
}

/** Bloque visual específico por documento. `croquis` y `solicitud` tienen su propio componente. */
export function GuiaVisualDocumento({ id }: { id: string }) {
  const cuerpo = (() => {
    switch (id) {
      case 'recibo_cfe': return <ReciboCfe />;
      case 'identificacion_oficial': return <Identificacion />;
      case 'constancia_situacion_fiscal': return <Constancia />;
      case 'carta_poder': return <CartaPoderFirmas />;
      case 'diagrama_unifilar': return <Unifilar />;
      case 'ficha_tecnica': return <Fichas />;
      case 'certificado': return <Certificados />;
      case 'evidencia_fotografica': return <Fotos />;
      case 'dictamen_uvie': return <Dictamen />;
      default: return null;
    }
  })();
  return cuerpo && <div className="kv-gv__bloque">{cuerpo}</div>;
}
