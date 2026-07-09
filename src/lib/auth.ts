"use client";

import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { getDb, getFirebaseAuth, isFirebaseConfigured } from "./firebase";
import { escucharGruposDe } from "./grupos";
import { esPropietario } from "./propietario";
import type { GrupoResumen } from "@/types/grupo";

export interface EstadoUsuario {
  cargando: boolean;
  usuario: User | null;
  /** true si está en el roster global `amigos`, o es el propietario. */
  amigo: boolean;
  /** true si puede gestionar amigos y grupos (admin de `amigos` o propietario). */
  admin: boolean;
  /** true solo para el email fijo del propietario (ver src/lib/propietario.ts). */
  propietario: boolean;
  /** Grupos de los que es miembro. */
  grupos: GrupoResumen[];
}

const ESTADO_VACIO: Omit<EstadoUsuario, "cargando" | "usuario"> = {
  amigo: false,
  admin: false,
  propietario: false,
  grupos: [],
};

/**
 * Sesión actual y pertenencia al roster/grupos, reactiva a entradas/salidas
 * Y a cambios en vivo (onSnapshot): si un admin te asciende, te añade a un
 * grupo o lo renombra, se refleja sin esperar a un nuevo inicio de sesión.
 */
export function useUsuario(): EstadoUsuario {
  const [estado, setEstado] = useState<EstadoUsuario>({
    cargando: isFirebaseConfigured,
    usuario: null,
    ...ESTADO_VACIO,
  });

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let dejarAmigo: (() => void) | undefined;
    let dejarGrupos: (() => void) | undefined;

    const dejarAuth = onAuthStateChanged(getFirebaseAuth(), (usuario) => {
      dejarAmigo?.();
      dejarGrupos?.();
      dejarAmigo = undefined;
      dejarGrupos = undefined;

      if (!usuario?.email) {
        setEstado({ cargando: false, usuario: null, ...ESTADO_VACIO });
        return;
      }
      const email = usuario.email.toLowerCase();
      const propietario = esPropietario(email);
      setEstado({
        cargando: false,
        usuario,
        amigo: propietario,
        admin: propietario,
        propietario,
        grupos: [],
      });

      dejarAmigo = onSnapshot(
        doc(getDb(), "amigos", email),
        (ficha) => {
          const esAdminAmigo = ficha.data()?.admin === true;
          setEstado((actual) => ({
            ...actual,
            amigo: propietario || ficha.exists(),
            admin: propietario || esAdminAmigo,
          }));
        },
        () => {
          // sin permiso o sin red: se queda con los valores por defecto
        },
      );
      dejarGrupos = escucharGruposDe(email, (grupos) => {
        setEstado((actual) => ({ ...actual, grupos }));
      });
    });

    return () => {
      dejarAuth();
      dejarAmigo?.();
      dejarGrupos?.();
    };
  }, []);

  return estado;
}

export async function entrar(): Promise<void> {
  await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
}

export async function salir(): Promise<void> {
  await signOut(getFirebaseAuth());
}
