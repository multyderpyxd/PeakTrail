"use client";

import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getDb, getFirebaseAuth, isFirebaseConfigured } from "./firebase";

export interface EstadoUsuario {
  cargando: boolean;
  usuario: User | null;
  /** true si su correo está en la lista cerrada (colección `invitados`). */
  invitado: boolean;
}

/** Sesión actual y pertenencia al grupo, reactiva a entradas/salidas. */
export function useUsuario(): EstadoUsuario {
  const [estado, setEstado] = useState<EstadoUsuario>({
    cargando: isFirebaseConfigured,
    usuario: null,
    invitado: false,
  });

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(getFirebaseAuth(), async (usuario) => {
      if (!usuario?.email) {
        setEstado({ cargando: false, usuario: null, invitado: false });
        return;
      }
      let invitado = false;
      try {
        invitado = (
          await getDoc(doc(getDb(), "invitados", usuario.email.toLowerCase()))
        ).exists();
      } catch {
        // sin permiso o sin red: se queda como no invitado
      }
      setEstado({ cargando: false, usuario, invitado });
    });
  }, []);

  return estado;
}

export async function entrar(): Promise<void> {
  await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
}

export async function salir(): Promise<void> {
  await signOut(getFirebaseAuth());
}
