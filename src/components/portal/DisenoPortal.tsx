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

export function IlustracionExpediente({ variante }: { variante: 'identidad' | 'documentos' | 'validacion' }) {
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
