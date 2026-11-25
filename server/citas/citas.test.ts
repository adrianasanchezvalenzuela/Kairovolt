import { describe, expect, it } from 'vitest';
import { crearApp } from '../app';
import { contenidoCorreo } from '../correo-portal';
import { demosPortal } from '../../src/data/demos-portal';
import { TIPOS_MEDIA_TENSION_DEMO } from '../catalogo';

const TOKEN = 'token-admin-citas-pruebas';
const base = '/api/demo/portal';
const csrf = { 'x-requested-with': 'kairovolt' };
const jsonH = { 'Content-Type': 'application/json' };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3]);

// Fija reloj en miércoles 2026-11-25 08:00 Hermosillo para determinismo
const AHORA_FIJO = () => Date.parse('2026-11-25T15:00:00.000Z');

const iniciar = () =>
  crearApp({ port: 0, zoho: null, supabase: null, adminToken: TOKEN }, fetch, AHORA_FIJO, true);

async function entrarDemo(app: ReturnType<typeof iniciar>, indice: 0 | 1 | 2) {
  const { folio, codigo } = demosPortal[indice];
  const r = await app.request(base + '/acceso', {
    method: 'POST',
    headers: jsonH,
    body: JSON.stringify({ folio, codigo }),
  });
  expect(r.status).toBe(200);
  return { Cookie: r.headers.get('set-cookie')!.split(';')[0]! };
}

describe('demos documentales (11 requisitos MT) y flujo completo de citas', () => {
  it('Demo 2 y Demo 3 comparten los mismos 11 documentos, permiten carga del cliente y Demo 2 bloquea cita de entrega completa', async () => {
    const app = iniciar();
    const d2 = await entrarDemo(app, 1);
    const d3 = await entrarDemo(app, 2);

    const v2 = await (await app.request(base + '/vista', { headers: d2 })).json() as {
      documentos: { id: string; estado: string; puedeSubir: boolean }[];
      documentosTecnicos: unknown[];
      guiaDocumental: { id: string; aplicabilidad: string }[];
    };
    const v3 = await (await app.request(base + '/vista', { headers: d3 })).json() as typeof v2;

    // Sin sección «IDC se encarga»
    expect(v2.documentosTecnicos).toEqual([]);
    expect(v3.documentosTecnicos).toEqual([]);

    // Exactamente los 11 requisitos aplicables en ambos demos
    expect(v2.documentos.map((d) => d.id).sort()).toEqual([...TIPOS_MEDIA_TENSION_DEMO].sort());
    expect(v3.documentos.map((d) => d.id).sort()).toEqual([...TIPOS_MEDIA_TENSION_DEMO].sort());

    // Acta constitutiva queda explícitamente como no_aplica (nunca Por confirmar)
    expect(v3.guiaDocumental.find((g) => g.id === 'acta_constitutiva')?.aplicabilidad).toBe('no_aplica');
    expect(v3.guiaDocumental.some((g) => g.aplicabilidad === 'pendiente_revision')).toBe(false);

    // Demo 3: todos en revisión digital favorable (prevalidado), ninguno marcado físicamente entregado aún
    expect(v3.documentos.every((d) => d.estado === 'prevalidado')).toBe(true);

    // Demo 2: cliente puede subir croquis, varias fotos del sistema y dictamen UVIE
    const fCroquis = new FormData();
    fCroquis.set('archivo', new File([PNG], 'croquis-ubicacion.png', { type: 'image/png' }));
    expect((await app.request(base + '/documentos/croquis', { method: 'POST', headers: { ...d2, ...csrf }, body: fCroquis })).status).toBe(201);

    const fFoto1 = new FormData();
    fFoto1.set('archivo', new File([PNG], 'paneles-1.png', { type: 'image/png' }));
    expect((await app.request(base + '/documentos/evidencia_fotografica', { method: 'POST', headers: { ...d2, ...csrf }, body: fFoto1 })).status).toBe(201);
    const fFoto2 = new FormData();
    fFoto2.set('archivo', new File([PNG], 'inversor-2.png', { type: 'image/png' }));
    expect((await app.request(base + '/documentos/evidencia_fotografica', { method: 'POST', headers: { ...d2, ...csrf }, body: fFoto2 })).status).toBe(201);

    const fUvie = new FormData();
    fUvie.set('archivo', new File([PDF], 'dictamen-uvie.pdf', { type: 'application/pdf' }));
    expect((await app.request(base + '/documentos/dictamen_uvie', { method: 'POST', headers: { ...d2, ...csrf }, body: fUvie })).status).toBe(201);

    // Demo 2 bloquea solicitar cita de entrega física completa mientras existan pendientes/correcciones
    const disp = await (await app.request(base + '/visita/disponibilidad?mes=2026-11&tipo=entrega_expediente', { headers: d2 })).json() as {
      dias: { fecha: string; tieneDisponibilidad: boolean; slots: { horaInicio: string; disponible: boolean }[] }[];
    };
    const dia = disp.dias.find((x) => x.tieneDisponibilidad)!;
    const slot = dia.slots.find((s) => s.disponible)!;

    const bloqueo = await app.request(base + '/visita/solicitar', {
      method: 'POST',
      headers: { ...d2, ...csrf, ...jsonH },
      body: JSON.stringify({ tipoVisita: 'entrega_expediente', fecha: dia.fecha, horaInicio: slot.horaInicio, idempotencyKey: 'clave-demo2-bloq' }),
    });
    expect(bloqueo.status).toBe(409);
    expect(await bloqueo.json()).toMatchObject({ error: 'expediente_no_listo' });
  });

  it('Demo 3: checklist, disponibilidad, idempotencia, concurrencia, ciclo IDC, ICS, cancelación y correo de confirmación', async () => {
    const app = iniciar();
    const d2 = await entrarDemo(app, 1);
    const d3 = await entrarDemo(app, 2);

    // 1. Checklist de visita personalizado y persistente
    const resInicial = await (await app.request(base + '/visita/resumen', { headers: d3 })).json() as {
      elegibilidad: { permitida: boolean; etiquetaEstadoDocumental: string; totalObligatorios: number };
      checklist: { documentoId: string; categoriaEntrega: string }[];
    };
    expect(resInicial.elegibilidad.permitida).toBe(true);
    expect(resInicial.elegibilidad.etiquetaEstadoDocumental).toBe('Documentación preparada para entrega física');
    expect(resInicial.elegibilidad.totalObligatorios).toBe(11);
    expect(resInicial.checklist.some((c) => c.categoriaEntrega === 'fisica_confirmada')).toBe(true);
    expect(resInicial.checklist.some((c) => c.categoriaEntrega === 'fisica_por_confirmar')).toBe(true);

    const saveChk = await app.request(base + '/visita/checklist', {
      method: 'POST',
      headers: { ...d3, ...csrf, ...jsonH },
      body: JSON.stringify({ marcados: ['carta_poder', 'solicitud'] }),
    });
    expect(saveChk.status).toBe(200);
    expect(await saveChk.json()).toEqual({ marcados: ['carta_poder', 'solicitud'] });

    // 2. Consultar calendario mensual y seleccionar fecha + horario disponible
    const disp = await (await app.request(base + '/visita/disponibilidad?mes=2026-11&tipo=entrega_expediente', { headers: d3 })).json() as {
      dias: { fecha: string; tieneDisponibilidad: boolean; slots: { horaInicio: string; disponible: boolean; motivoNoDisponible?: string }[] }[];
    };
    const dia = disp.dias.find((x) => x.tieneDisponibilidad)!;
    const slotsLibres = dia.slots.filter((s) => s.disponible);
    expect(slotsLibres.length).toBeGreaterThanOrEqual(2);
    const primerSlot = slotsLibres[0]!;
    const segundoSlot = slotsLibres[1]!;

    // 3. Solicitar cita → queda en estado 'solicitada' (NUNCA confirmada automáticamente)
    const solicitar = (key: string) => app.request(base + '/visita/solicitar', {
      method: 'POST',
      headers: { ...d3, ...csrf, ...jsonH },
      body: JSON.stringify({
        tipoVisita: 'entrega_expediente',
        fecha: dia.fecha,
        horaInicio: primerSlot.horaInicio,
        notasCliente: 'Llevo carpeta completa',
        idempotencyKey: key,
      }),
    });

    const r1 = await solicitar('idem-demo3-001');
    expect(r1.status).toBe(201);
    const { cita } = await r1.json() as { cita: { id: string; referencia: string; estado: string } };
    expect(cita.estado).toBe('solicitada');

    // Reintento con la misma idempotencyKey → idempotente (200, mismo ID, sin duplicar)
    const rRetry = await solicitar('idem-demo3-001');
    expect(rRetry.status).toBe(200);
    expect(await rRetry.json()).toMatchObject({ duplicada: true, cita: { id: cita.id } });

    // Prevención de doble reserva concurrente: otro cliente (Demo 2 en aclaracion_documental) intenta el MISMO horario → 409
    const colision = await app.request(base + '/visita/solicitar', {
      method: 'POST',
      headers: { ...d2, ...csrf, ...jsonH },
      body: JSON.stringify({
        tipoVisita: 'aclaracion_documental',
        fecha: dia.fecha,
        horaInicio: primerSlot.horaInicio,
        idempotencyKey: 'idem-demo2-colision',
      }),
    });
    expect(colision.status).toBe(409);
    expect(await colision.json()).toMatchObject({ error: 'horario_no_disponible' });

    // ICS bloqueado antes de confirmar
    expect((await app.request(base + '/visita/' + cita.id + '/ics', { headers: d3 })).status).toBe(409);

    // El cliente NO puede llamar al endpoint administrativo real con su cookie de portal
    expect((await app.request('/api/admin/citas/' + cita.id + '/accion', {
      method: 'POST',
      headers: { ...d3, ...csrf, ...jsonH },
      body: JSON.stringify({ accion: 'confirmar' }),
    })).status).toBe(401);

    // 4. Confirmación desde IDC (simulador demo)
    const conf = await app.request(base + '/simular-cita/' + cita.id, {
      method: 'POST',
      headers: { ...d3, ...csrf, ...jsonH },
      body: JSON.stringify({ accion: 'confirmar', ubicacionAutorizada: 'Oficinas IDC · Hermosillo (demo)' }),
    });
    expect(conf.status).toBe(200);
    expect(await conf.json()).toMatchObject({ cita: { estado: 'confirmada' } });

    // Ahora sí permite descargar .ics sin códigos ni datos personales
    const icsRes = await app.request(base + '/visita/' + cita.id + '/ics', { headers: d3 });
    expect(icsRes.status).toBe(200);
    expect(icsRes.headers.get('content-type')).toContain('text/calendar');
    const icsText = await icsRes.text();
    expect(icsText).toContain('BEGIN:VCALENDAR');
    expect(icsText).not.toContain(demosPortal[2].codigo);

    // Aviso e historial reflejan la confirmación
    const vistaConfirmada = await (await app.request(base + '/vista', { headers: d3 })).json() as {
      notificaciones: { eventoTipo?: string; titulo: string }[];
      historial: { titulo: string }[];
    };
    expect(vistaConfirmada.notificaciones.some((n) => n.eventoTipo === 'cita_confirmada')).toBe(true);
    expect(vistaConfirmada.historial.some((h) => h.titulo.includes('Cita confirmada'))).toBe(true);

    // 5. Propuesta de otro horario por IDC y aceptación del cliente
    const prop = await app.request(base + '/simular-cita/' + cita.id, {
      method: 'POST',
      headers: { ...d3, ...csrf, ...jsonH },
      body: JSON.stringify({ accion: 'proponer_horario', nuevaFecha: dia.fecha, nuevaHoraInicio: segundoSlot.horaInicio }),
    });
    expect(prop.status).toBe(200);
    expect(await prop.json()).toMatchObject({ cita: { estado: 'cambio_solicitado', propuestaPor: 'idc' } });

    const aceptar = await app.request(base + '/visita/' + cita.id + '/reprogramar', {
      method: 'POST',
      headers: { ...d3, ...csrf, ...jsonH },
      body: JSON.stringify({ accion: 'aceptar_propuesta' }),
    });
    expect(aceptar.status).toBe(200);
    expect(await aceptar.json()).toMatchObject({ cita: { estado: 'reprogramada', horaInicio: segundoSlot.horaInicio } });

    // 6. Registrar visita realizada → NO marca documentos como aceptados/entregados físicamente
    const realizada = await app.request(base + '/simular-cita/' + cita.id, {
      method: 'POST',
      headers: { ...d3, ...csrf, ...jsonH },
      body: JSON.stringify({ accion: 'realizada' }),
    });
    expect(realizada.status).toBe(200);
    expect(await realizada.json()).toMatchObject({ cita: { estado: 'realizada' } });
    const vistaPost = await (await app.request(base + '/vista', { headers: d3 })).json() as {
      documentos: { estado: string }[];
    };
    expect(vistaPost.documentos.every((d) => d.estado === 'prevalidado')).toBe(true);

    // 7. Correo de confirmación cumple exactamente con la plantilla solicitada sin exponer códigos ni archivos
    const correo = contenidoCorreo(
      {
        id: 'ev-cita-1',
        intento: 1,
        correo: 'cliente@example.invalid',
        token: null,
        tipo: 'cita_confirmada',
        detalles: { fecha: 'jueves, 26 de noviembre de 2026', horario: '10:00 – 10:45 (hora de Hermosillo)', ubicacion: 'Oficinas IDC Hermosillo' },
      },
      'https://portal.example.invalid',
    );
    expect(correo.subject).toBe('KairóVolt | Tu visita a IDC está confirmada.');
    expect(correo.html).toContain('¡Nos vemos pronto!');
    expect(correo.html).toContain('Ver detalles de mi visita');
    expect(correo.html).toContain('Equipo IDC — KairóVolt.');
    expect(correo.html).not.toMatch(/DEMO-KV26|Storage|token=/);
  });

  it('Cancelación libera el horario y el panel admin real exige autenticación con rol', async () => {
    const app = iniciar();
    const d3 = await entrarDemo(app, 2);
    const d2 = await entrarDemo(app, 1);

    const disp = await (await app.request(base + '/visita/disponibilidad?mes=2026-11&tipo=entrega_expediente', { headers: d3 })).json() as {
      dias: { fecha: string; tieneDisponibilidad: boolean; slots: { horaInicio: string; disponible: boolean }[] }[];
    };
    const dia = disp.dias.find((x) => x.tieneDisponibilidad)!;
    const slot = dia.slots.find((s) => s.disponible)!;

    const r = await app.request(base + '/visita/solicitar', {
      method: 'POST',
      headers: { ...d3, ...csrf, ...jsonH },
      body: JSON.stringify({ tipoVisita: 'entrega_expediente', fecha: dia.fecha, horaInicio: slot.horaInicio, idempotencyKey: 'idem-cancel-01' }),
    });
    const { cita } = await r.json() as { cita: { id: string } };

    // Cancelar desde cliente
    const cancel = await app.request(base + '/visita/' + cita.id + '/cancelar', {
      method: 'POST',
      headers: { ...d3, ...csrf, ...jsonH },
      body: JSON.stringify({ motivo: 'Cambio de agenda personal' }),
    });
    expect(cancel.status).toBe(200);
    expect(await cancel.json()).toMatchObject({ cita: { estado: 'cancelada' } });

    // Ahora otro cliente SÍ puede reservar el horario recién liberado
    const libre = await app.request(base + '/visita/solicitar', {
      method: 'POST',
      headers: { ...d2, ...csrf, ...jsonH },
      body: JSON.stringify({ tipoVisita: 'aclaracion_documental', fecha: dia.fecha, horaInicio: slot.horaInicio, idempotencyKey: 'idem-reuso-02' }),
    });
    expect(libre.status).toBe(201);

    // Panel admin con Bearer válido responde 200; anónimo responde 401
    expect((await app.request('/api/admin/citas')).status).toBe(401);
    const adminRes = await app.request('/api/admin/citas', { headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(adminRes.status).toBe(200);
  });
});
