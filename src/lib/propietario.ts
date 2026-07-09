/**
 * El propietario es una constante, no un dato de Firestore: no hay ruta en
 * la app para crear uno (solo el propietario puede ascender/descender
 * admins — ver firestore.rules, función esPropietario()). Si el propietario
 * cambia alguna vez, hay que editar este email Y el de firestore.rules.
 */
export const EMAIL_PROPIETARIO = "josemiangos@gmail.com";

export function esPropietario(email?: string | null): boolean {
  return !!email && email.toLowerCase() === EMAIL_PROPIETARIO;
}
