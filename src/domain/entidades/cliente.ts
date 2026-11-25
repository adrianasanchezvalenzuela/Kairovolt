/** Cliente del proyecto. Vive en Zoho CRM (la cuenta del trato); aquí solo es el tipo del dominio. */
export interface Cliente {
  id: string;
  razonSocial: string;
  rfc: string | null;
  contacto: { nombre: string | null; correo: string | null; telefono: string | null } | null;
  ubicacion: { municipio: string | null; estado: string | null } | null;
}
