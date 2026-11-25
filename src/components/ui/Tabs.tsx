import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem {
  id: string;
  etiqueta: string;
  /** Contador o insignia junto al nombre (p. ej. número de bloqueantes). */
  extra?: ReactNode;
}

export interface TabsProps {
  tabs: readonly TabItem[];
  activa: string;
  onCambiar: (id: string) => void;
  etiqueta: string;
  /** Contenido de la pestaña activa. */
  children: ReactNode;
}

/** Pestañas accesibles: flechas, Inicio y Fin cambian de pestaña; solo la activa entra en el orden de tabulación. */
export function Tabs({ tabs, activa, onCambiar, etiqueta, children }: TabsProps) {
  const base = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const idTab = (id: string) => `${base}-tab-${id}`;
  const idPanel = (id: string) => `${base}-panel-${id}`;

  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.id === activa);
    const destino = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
    if (destino === null) return;
    e.preventDefault();
    const t = tabs[destino]!;
    onCambiar(t.id);
    refs.current[t.id]?.focus();
  };

  return (
    <div>
      <div className="kv-tabs" role="tablist" aria-label={etiqueta} onKeyDown={alTeclear}>
        {tabs.map((t) => (
          <button
            key={t.id} ref={(el) => { refs.current[t.id] = el; }} type="button" role="tab" id={idTab(t.id)} aria-controls={idPanel(t.id)}
            aria-selected={t.id === activa} tabIndex={t.id === activa ? 0 : -1} className="kv-tab" onClick={() => onCambiar(t.id)}
          >
            {t.etiqueta}{t.extra}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={idPanel(activa)} aria-labelledby={idTab(activa)} className="kv-tabpanel">{children}</div>
    </div>
  );
}
