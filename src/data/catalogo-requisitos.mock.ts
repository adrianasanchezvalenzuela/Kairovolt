import type { CanalEntrega, Requisito } from '@/domain/checklist/checklist';
import type { CompuertaId } from '@/domain/compuertas/compuerta';
import type { TipoDocumento } from '@/domain/documentos/documento';

/**
 * Catálogo base G0–G3 según la definición de IDC (requisitos de interconexión MT/CFE e inspección UIIE).
 * Pendiente de validar con IDC:
 *  - qué documentos además de los marcados exigen canal físico;
 *  - qué documentos aporta el cliente (base: los de acopio "Del Cliente" de G1 y el recibo CFE);
 *  - qué documentos requieren vigencia (base: recibo CFE, identificación, CSF y certificados, según el checklist de G2);
 *  - la política de zona del dictamen UVIE (base: G3; ver `catalogoParaZona`).
 */
const r = (
  compuerta: CompuertaId,
  tipo: TipoDocumento,
  nombre: string,
  extra: { canal?: CanalEntrega; condicion?: string; reubicablePorZona?: boolean; requiereVigencia?: boolean; aportaCliente?: boolean } = {},
): Requisito => ({
  id: `r-${tipo}`,
  tipo,
  nombre,
  compuerta,
  obligatorio: extra.condicion === undefined,
  canal: extra.canal ?? 'digital',
  ...(extra.condicion !== undefined && { condicion: extra.condicion }),
  ...(extra.reubicablePorZona && { reubicablePorZona: true }),
  ...(extra.requiereVigencia && { requiereVigencia: true }),
  ...(extra.aportaCliente && { aportaCliente: true }),
});

export const catalogoRequisitosBase: readonly Requisito[] = [
  // G0 — Prefactibilidad y diagnóstico
  r('G0', 'consulta_capacidad_mt', 'Consulta/registro de capacidad del circuito MT (Plataforma GD de CFE)'),
  r('G0', 'recibo_cfe', 'Recibo CFE del último corte, sin adeudos', { requiereVigencia: true, aportaCliente: true }),
  r('G0', 'datos_preliminares', 'Datos técnicos preliminares (capacidad AC/DC, tensión, modalidad)'),
  // G1 — Acopio legal y documentación técnica
  r('G1', 'identificacion_oficial', 'Identificación oficial vigente del propietario o representante', { requiereVigencia: true, aportaCliente: true }),
  r('G1', 'constancia_situacion_fiscal', 'Constancia de Situación Fiscal (SAT) actualizada', { requiereVigencia: true, aportaCliente: true }),
  r('G1', 'carta_poder', 'Carta poder (con INE del otorgante, apoderado y 2 testigos)', { canal: 'fisico', aportaCliente: true }),
  r('G1', 'acta_constitutiva', 'Acta constitutiva / acreditación de propiedad o posesión', { condicion: 'Titular persona moral o cuando aplique', aportaCliente: true }),
  r('G1', 'croquis', 'Croquis de localización georreferenciado'),
  r('G1', 'diagrama_unifilar', 'Diagrama unifilar (SFV-01)'),
  r('G1', 'memoria_calculo', 'Memoria de cálculo fotovoltaica y plano de planta (SFV-02)'),
  r('G1', 'ficha_tecnica', 'Fichas técnicas de módulos e inversores'),
  r('G1', 'certificado', 'Certificados UL/CSA vigentes de paneles e inversores', { requiereVigencia: true }),
  // G2 — Validación bloqueante
  r('G2', 'solicitud', 'Solicitud de interconexión CFE llenada y firmada', { canal: 'fisico' }),
  r('G2', 'evidencia_fotografica', 'Evidencia fotográfica del sistema (módulos, inversores, tablero, medidor)'),
  r('G2', 'checklist_consistencia', 'Checklist de consistencia cruzada y vigencias aprobado'),
  // G3 — Verificación UVIE, contratación y energización
  r('G3', 'dictamen_uvie', 'Dictamen de verificación UVIE (NOM-001-SEDE-2012)', { canal: 'fisico', reubicablePorZona: true }),
  r('G3', 'certificado_uiie', 'Certificado de cumplimiento UIIE', { condicion: 'Si aplica por criterio de Zona / acuerdo A/054/2024' }),
  r('G3', 'oficio_resolutivo', 'Acuse de ingreso / Oficio Resolutivo de CFE'),
  r('G3', 'contrato_interconexion', 'Contrato de Interconexión (CFE Distribución)', { canal: 'fisico' }),
  r('G3', 'contrato_contraprestacion', 'Contrato de Contraprestación (CFE Suministrador)', { canal: 'fisico' }),
  r('G3', 'medidor_bidireccional', 'Evidencia de instalación de medidor bidireccional y alta comercial'),
];
