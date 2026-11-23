interface Props {
  etiqueta: string;
  valor: string;
  detalle?: string;
}

export function Indicador({ etiqueta, valor, detalle }: Props) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--kv-borde)', borderLeft: '3px solid var(--kv-teal)', borderRadius: 'var(--kv-radio)', padding: '8px 12px', minWidth: 150 }}>
      <div className="kv-suave" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em' }}>{etiqueta}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{valor}</div>
      {detalle && <div className="kv-suave" style={{ fontSize: 12 }}>{detalle}</div>}
    </div>
  );
}
