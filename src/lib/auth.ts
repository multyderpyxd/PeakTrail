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
import { listarGruposDe } from "./grupos";
import { esPropietario } from "./propietario";
import type { GrupoResumen } from "@/types/grupo";

export interface EstadoUsuario {
  cargando: boolean;
  usuario: User | null;
  /** true si su correo está en la lista cerrada (colección `invitados`). */
  invitado: boolean;
  /** true si puede gestionar la lista de invitados desde la app. */
  admin: boolean;
  /** true si está en el roster global `amigos`, o es el propietario. */
  amigo: boolean;
  /** true si puede gestionar amigos y grupos (admin de `amigos` o propietario). */
  adminGrupos: boolean;
  /** true solo para el email fijo del propietario (ver src/lib/propietario.ts). */
  propietario: boolean;
  /** Grupos de los que es miembro. */
  grupos: GrupoResumen[];
}

const ESTADO_VACIO: Omit<EstadoUsuario, "cargando" | "usuario"> = {
  invitado: false,
  admin: false,
  amigo: false,
  adminGrupos: false,
  propietario: false,
  grupos: [],
};

/** Sesión actual y pertenencia al grupo/roster, reactiva a entradas/salidas. */
export function useUsuario(): EstadoUsuario {
  const [estado, setEstado] = useState<EstadoUsuario>({
    cargando: isFirebaseConfigured,
    usuario: null,
    ...ESTADO_VACIO,
  });

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(getFirebaseAuth(), async (usuario) => {
      if (!usuario?.email) {
        setEstado({ cargando: false, usuario: null, ...ESTADO_VACIO });
        return;
      }
      const email = usuario.email.toLowerCase();
      let invitado = false;
      let admin = false;
      let amigo = esPropietario(email);
      let adminGrupos = esPropietario(email);
      let grupos: GrupoResumen[] = [];
      try {
        const [fichaInvitado, fichaAmigo, gruposDe] = await Promise.all([
          getDoc(doc(getDb(), "invitados", email)),
          getDoc(doc(getDb(), "amigos", email)),
          listarGruposDe(email),
        ]);
        invitado = fichaInvitado.exists();
        admin = fichaInvitado.data()?.admin === true;
        if (fichaAmigo.exists()) {
          amigo = true;
          if (fichaAmigo.data()?.admin === true) adminGrupos = true;
        }
        grupos = gruposDe;
      } catch {
        // sin permiso o sin red: se queda con los valores por defecto
      }
      setEstado({
        cargando: false,
        usuario,
        invitado,
        admin,
        amigo,
        adminGrupos,
        propietario: esPropietario(email),
        grupos,
      });
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
