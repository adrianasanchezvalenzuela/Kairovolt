import type { ComponentType, ReactNode } from 'react';
import { BadgeCheck, CalendarCheck, ClipboardPenLine, FolderOpen, Gauge, Zap, type LucideIcon } from 'lucide-react';
import { demosPortal } from '@/data/demos-portal';
import { IlusAprobada, IlusCaptura, IlusConectada, IlusDocumentos, IlusMedidor, IlusVisita, type PropsIlus } from '@/components/portal/IlustracionesHero';

/** Configuración visual y narrativa de cada demo: una sola fuente para el selector y para el hero de Inicio. */
export type Momento = 'captura' | 'documentos' | 'visita' | 'aprobada' | 'medidor' | 'concluida';
export interface DemoVisual {
  indice: number; numero: string; folio: string; momento: Momento; Icono: LucideIcon;
  tarjeta: { titulo: string; etapa: string; fondo: string; texto: string; acento: string; oscuro: boolean };
  hero: { etiqueta: string; titulo: string; subtitulo: string; fondo: string; texto: string; acento: string; oscuro: boolean; Ilustracion: ComponentType<PropsIlus> };
  accion: { texto: string; ruta: string };
}

const NAVY = '#102B40', TEAL = '#176B70', AMBAR = '#F2BD55';
const base = (i: number) => ({ indice: i, numero: String(i + 1).padStart(2, '0'), folio: demosPortal[i]!.folio });

export const DEMOS_VISUAL: readonly DemoVisual[] = [
  { ...base(0), momento: 'captura', Icono: ClipboardPenLine,
    tarjeta: { titulo: 'Captura de datos', etapa: 'Inicio del expediente', fondo: '#F4DFA9', texto: NAVY, acento: TEAL, oscuro: false },
    hero: { etiqueta: 'Primer paso', titulo: 'Comencemos tu próxima conexión.', subtitulo: 'Todo empieza con unos cuantos datos. Nosotros te acompañamos en el proceso.', fondo: '#F4DFA9', texto: NAVY, acento: TEAL, oscuro: false, Ilustracion: IlusCaptura },
    accion: { texto: 'Completar mis datos', ruta: '/portal/mis-datos' } },
  { ...base(1), momento: 'documentos', Icono: FolderOpen,
    tarjeta: { titulo: 'Preparación documental', etapa: 'Media tensión · 11 documentos', fondo: '#C9DFD6', texto: NAVY, acento: TEAL, oscuro: false },
    hero: { etiqueta: 'Tu expediente', titulo: 'Cada documento te acerca a tu conexión.', subtitulo: 'Prepara tu expediente con nuestras guías y recibe observaciones antes de tu entrega física.', fondo: '#C9DFD6', texto: NAVY, acento: TEAL, oscuro: false, Ilustracion: IlusDocumentos },
    accion: { texto: 'Continuar mi expediente', ruta: '/portal/documentos' } },
  { ...base(2), momento: 'visita', Icono: CalendarCheck,
    tarjeta: { titulo: 'Preparación de visita y citas', etapa: 'Listo para entrega física', fondo: '#DCE7ED', texto: NAVY, acento: TEAL, oscuro: false },
    hero: { etiqueta: 'Entrega física', titulo: 'Todo listo para el siguiente paso.', subtitulo: 'Tu documentación está preparada. Organiza tu entrega física con IDC.', fondo: '#DCE7ED', texto: NAVY, acento: TEAL, oscuro: false, Ilustracion: IlusVisita },
    accion: { texto: 'Solicitar cita de entrega', ruta: '/portal/visita' } },
  { ...base(3), momento: 'aprobada', Icono: BadgeCheck,
    tarjeta: { titulo: 'Solicitud aprobada', etapa: 'Resolución favorable de CFE', fondo: NAVY, texto: '#FFFFFF', acento: AMBAR, oscuro: true },
    hero: { etiqueta: 'Resolución de CFE', titulo: '¡Buenas noticias! Tu solicitud fue aprobada.', subtitulo: 'CFE emitió una resolución favorable. Estamos más cerca de conectar tu sistema solar.', fondo: NAVY, texto: '#FFFFFF', acento: AMBAR, oscuro: true, Ilustracion: IlusAprobada },
    accion: { texto: 'Revisar mis contratos', ruta: '/portal/contratos' } },
  { ...base(4), momento: 'medidor', Icono: Gauge,
    tarjeta: { titulo: 'Instalación del medidor', etapa: 'Contratos formalizados', fondo: TEAL, texto: '#FFFFFF', acento: AMBAR, oscuro: true },
    hero: { etiqueta: 'Instalación', titulo: 'Tu conexión está cada vez más cerca.', subtitulo: 'Los contratos están formalizados. El siguiente paso es la instalación de tu medidor bidireccional.', fondo: '#E3EFED', texto: NAVY, acento: TEAL, oscuro: false, Ilustracion: IlusMedidor },
    accion: { texto: 'Prepararme para la instalación', ruta: '/portal/instalacion' } },
  { ...base(5), momento: 'concluida', Icono: Zap,
    tarjeta: { titulo: 'Interconexión completada', etapa: 'Trámite cerrado', fondo: '#E0E8CD', texto: NAVY, acento: TEAL, oscuro: false },
    hero: { etiqueta: 'Interconexión concluida', titulo: '¡Lo logramos! Ya estás conectado.', subtitulo: 'Tu recorrido de interconexión ha concluido. Gracias por confiar en IDC.', fondo: TEAL, texto: '#FFFFFF', acento: AMBAR, oscuro: true, Ilustracion: IlusConectada },
    accion: { texto: 'Ver mi expediente final', ruta: '/portal/expediente' } },
];
export const visualDeFolio = (folio: string): DemoVisual | undefined => DEMOS_VISUAL.find((d) => d.folio === folio);

/** Hero reutilizable: texto a la izquierda e ilustración propia a la derecha (nunca se superponen). */
export function HeroDemo({ visual, acciones, banda }: { visual: DemoVisual; acciones: ReactNode; banda?: ReactNode }) {
  const { hero } = visual; const Ilus = hero.Ilustracion;
  return <section className={'kv-hero kv-hero--' + visual.momento + (hero.oscuro ? ' kv-hero--oscuro' : '')} style={{ ['--h-fondo' as string]: hero.fondo, ['--h-texto' as string]: hero.texto, ['--h-acento' as string]: hero.acento }}>
    <div className="kv-hero__cuerpo">
      <div className="kv-hero__texto">
        <span className="kv-hero__etiqueta"><visual.Icono size={15} aria-hidden="true" /> Demo {visual.numero} · {hero.etiqueta}</span>
        <h1>{hero.titulo}</h1>
        <p>{hero.subtitulo}</p>
        <div className="kv-hero__acciones">{acciones}</div>
      </div>
      <div className="kv-hero__ilus"><Ilus tono={hero.oscuro ? 'oscuro' : 'claro'} /></div>
    </div>
    {banda && <div className="kv-hero__banda">{banda}</div>}
  </section>;
}
