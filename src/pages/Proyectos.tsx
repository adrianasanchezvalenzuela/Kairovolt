import { useMemo, useState } from 'react';
import { aVistaProyecto } from '@/application/vista-proyectos';
import { useFuenteDatos } from '@/hooks/FuenteDatos';
import { useCartera } from '@/hooks/useExpediente';
import { ProjectCard } from '@/components/feature/ProjectCard';
import { ProjectTable } from '@/components/feature/ProjectTable';
import { Boton } from '@/components/ui/Boton';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Estados';
import { PageHeader } from '@/components/ui/PageHeader';

type Vista = 'tabla' | 'tarjetas';

export function Proyectos() {
  const { fuente } = useFuenteDatos();
  const { items, error, recargar } = useCartera();
  const [vista, setVista] = useState<Vista>('tabla');
  const [texto, setTexto] = useState('');
  const [etapa, setEtapa] = useState('todas');

  const vistas = useMemo(() => items?.map(aVistaProyecto) ?? null, [items]);
  const filtradas = useMemo(() => {
    const q = texto.trim().toLowerCase();
    return (vistas ?? []).filter((v) => (etapa === 'todas' || v.etapa === etapa) && (q === '' || `${v.folio} ${v.nombre} ${v.cliente} ${v.ubicacion}`.toLowerCase().includes(q)));
  }, [vistas, texto, etapa]);

  return (
    <>
      <PageHeader
        titulo="Proyectos"
        meta={`Interconexión CFE · generación distribuida fotovoltaica · ${fuente === 'zoho' ? 'datos de Zoho' : 'datos de prueba'}`}
        acciones={vistas && vistas.length > 0 && (
          <div role="group" aria-label="Forma de mostrar los proyectos" style={{ display: 'flex', gap: 4 }}>
            <Boton tamano="sm" variante={vista === 'tabla' ? 'primario' : 'secundario'} aria-pressed={vista === 'tabla'} onClick={() => setVista('tabla')}>Tabla</Boton>
            <Boton tamano="sm" variante={vista === 'tarjetas' ? 'primario' : 'secundario'} aria-pressed={vista === 'tarjetas'} onClick={() => setVista('tarjetas')}>Tarjetas</Boton>
          </div>
        )}
      />
      {error && <ErrorState titulo="No se pudieron cargar los proyectos" detalle={error} onReintentar={recargar} />}
      {!error && !vistas && <LoadingState etiqueta="Cargando proyectos…" />}
      {vistas && vistas.length === 0 && <EmptyState titulo="No hay proyectos" descripcion="No hay proyectos con folio KV en la fuente de datos." />}
      {vistas && vistas.length > 0 && (
        <>
          <div className="kv-filtros">
            <div className="kv-campo"><label htmlFor="p-q">Buscar</label><input id="p-q" type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Folio, nombre o cliente" /></div>
            <div className="kv-campo">
              <label htmlFor="p-e">Etapa</label>
              <select id="p-e" value={etapa} onChange={(e) => setEtapa(e.target.value)}>
                <option value="todas">Todas</option>
                {['G0', 'G1', 'G2', 'G3', 'Completo'].map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <span className="kv-suave" role="status">{filtradas.length} de {vistas.length}</span>
          </div>
          {filtradas.length === 0
            ? <EmptyState compacto titulo="Sin coincidencias" descripcion="Ningún proyecto coincide con la búsqueda." />
            : vista === 'tabla'
              ? <ProjectTable proyectos={filtradas} />
              : <ul className="kv-tarjetas" aria-label="Proyectos">{filtradas.map((v) => <li key={v.id}><ProjectCard proyecto={v} /></li>)}</ul>}
        </>
      )}
    </>
  );
}
