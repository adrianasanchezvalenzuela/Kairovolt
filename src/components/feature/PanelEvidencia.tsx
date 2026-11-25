import type { ConfiguracionTecnica } from '@/domain/entidades/configuracion-tecnica';
import type { DocumentoExpediente } from '@/domain/documentos/documento';
import { CAMPOS } from '@/domain/validacion/campos';
import { Boton } from '@/components/ui/Boton';
import { Dialogo } from '@/components/ui/Dialogo';
import { DocumentPreview } from './DocumentPreview';

export interface PanelEvidenciaProps {
  /** Documento a abrir; `null` cierra el panel. */
  documento: DocumentoExpediente | null;
  /** Nombre legible del requisito que cubre (p. ej. «Diagrama unifilar (SFV-01)»). */
  requisito?: string | null;
  onCerrar: () => void;
}

const dato = (v: string | number | null) => (v === null || v === '' ? null : String(v));

/**
 * Evidencia de un documento: sus datos declarados y sus fechas (siempre) y el archivo (si la fuente lo tiene).
 * Si no hay archivo lo dice: no se inventa una vista.
 */
export function PanelEvidencia({ documento, requisito, onCerrar }: PanelEvidenciaProps) {
  return (
    <Dialogo abierto={documento !== null} titulo={documento?.nombre ?? 'Evidencia'} onCerrar={onCerrar} posicion="derecha" pie={<Boton onClick={onCerrar}>Cerrar</Boton>}>
      {documento && (
        <>
          <dl className="kv-dato">
            <dt>Tipo</dt><dd>{requisito ?? documento.tipo.replaceAll('_', ' ')}</dd>
            <dt>Emisión</dt><dd className="kv-mono">{documento.fechaEmision ?? <span className="kv-suave">No capturada</span>}</dd>
            <dt>Vigencia</dt><dd className="kv-mono">{documento.fechaVigencia ?? <span className="kv-suave">No capturada</span>}</dd>
          </dl>
          <h3 style={{ margin: '16px 0 6px' }}>Datos declarados en este documento</h3>
          {documento.datos.length === 0
            ? <p className="kv-suave">El documento no tiene datos declarados capturados.</p>
            : (
              <div className="kv-tabla-scroll">
                <table aria-label={`Datos declarados en ${documento.nombre}`}>
                  <thead><tr><th scope="col">Campo</th><th scope="col">Valor</th></tr></thead>
                  <tbody>
                    {documento.datos.map((d) => (
                      <tr key={d.campo}>
                        <td>{CAMPOS[d.campo].etiqueta}</td>
                        <td className="kv-mono">{dato(d.valor) === null ? <span className="kv-suave">vacío</span> : <>{dato(d.valor)}{CAMPOS[d.campo].unidad ? ` ${CAMPOS[d.campo].unidad}` : ''}</>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          <h3 style={{ margin: '16px 0 6px' }}>Archivo</h3>
          <DocumentPreview nombre={documento.nombre} url={documento.archivo?.url ?? null} mime={documento.archivo?.mime ?? null} altura={320} />
        </>
      )}
    </Dialogo>
  );
}

/** Resumen de la configuración técnica del proyecto, para cuando la evidencia es la configuración y no un documento. */
export function resumenConfiguracion(c: ConfiguracionTecnica): { etiqueta: string; valor: string | null }[] {
  const n = (v: number | null, u = '') => (v === null ? null : `${v}${u}`);
  return [
    { etiqueta: 'Nivel de tensión', valor: c.nivelTension }, { etiqueta: 'Paneles', valor: c.numeroPaneles === null ? null : `${c.numeroPaneles} × ${c.potenciaPanelW ?? '?'} W` },
    { etiqueta: 'Modelo de panel', valor: c.modeloPanel }, { etiqueta: 'Potencia DC declarada', valor: n(c.potenciaDcKwpDeclarada, ' kWp') },
    { etiqueta: 'Inversores', valor: c.numeroInversores === null ? null : `${c.numeroInversores} × ${c.marcaInversor ?? '?'} ${c.potenciaInversorKw ?? '?'} kW` },
    { etiqueta: 'Potencia AC', valor: n(c.potenciaAcKw, ' kW') }, { etiqueta: 'RPU', valor: c.rpu },
  ];
}
