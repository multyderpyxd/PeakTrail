/* eslint-disable @next/next/no-img-element -- data-URLs de Firestore, sin optimizador */
import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  borrarComentario,
  borrarFoto,
  cargarSocial,
  comentar,
  subirFoto,
  type Comentario,
  type Foto,
  type RefTipo,
} from "@/lib/social";
import { IconoCerrar, IconoPapelera } from "@/components/icons";

function fechaCorta(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

/** Fotos y comentarios del grupo al pie de las fichas (solo invitados). */
export function SeccionSocial({
  refTipo,
  refId,
  usuario,
  esInvitado,
}: {
  refTipo: RefTipo;
  refId: string;
  usuario: User | null;
  esInvitado: boolean;
}) {
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [cargado, setCargado] = useState(false);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ampliada, setAmpliada] = useState<Foto | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!esInvitado) return;
    let cancelado = false;
    setCargado(false);
    cargarSocial(refTipo, refId)
      .then((datos) => {
        if (cancelado) return;
        setComentarios(datos.comentarios);
        setFotos(datos.fotos);
        setCargado(true);
      })
      .catch(() => !cancelado && setAviso("No se pudo cargar la actividad del grupo"));
    return () => {
      cancelado = true;
    };
  }, [refTipo, refId, esInvitado]);

  if (!esInvitado || !usuario) return null;

  const identidad = {
    usuario: usuario.uid,
    nombreUsuario: usuario.displayName ?? usuario.email ?? "Anónimo",
  };

  async function recargar() {
    const datos = await cargarSocial(refTipo, refId);
    setComentarios(datos.comentarios);
    setFotos(datos.fotos);
  }

  async function enviarComentario(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim() || ocupado) return;
    setOcupado(true);
    try {
      await comentar({ refTipo, refId, ...identidad, texto: texto.trim() });
      setTexto("");
      await recargar();
    } finally {
      setOcupado(false);
    }
  }

  async function elegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo || ocupado) return;
    setOcupado(true);
    setAviso(null);
    try {
      await subirFoto({ refTipo, refId, ...identidad, archivo });
      await recargar();
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "No se pudo subir la foto");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mt-3 border-t border-roca-800 pt-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-[0.18em] text-roca-300">
          Fotos del grupo
        </h3>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => archivoRef.current?.click()}
          className="text-[11px] text-hielo-300 underline decoration-roca-500 underline-offset-2 transition-colors hover:text-nieve disabled:opacity-40"
        >
          {ocupado ? "Subiendo…" : "Añadir foto"}
        </button>
        <input
          ref={archivoRef}
          type="file"
          accept="image/*"
          onChange={elegirFoto}
          className="hidden"
        />
      </div>
      {aviso && <p className="mt-1 text-[11px] text-ocre-400">{aviso}</p>}
      {cargado && fotos.length === 0 && (
        <p className="mt-1.5 text-[11px] text-roca-300">
          Nadie ha subido fotos todavía.
        </p>
      )}
      {fotos.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {fotos.map((foto) => (
            <button
              key={foto.id}
              type="button"
              onClick={() => setAmpliada(foto)}
              className="overflow-hidden rounded border border-roca-800"
            >
              <img
                src={foto.datos}
                alt={`Foto de ${foto.nombreUsuario}`}
                className="h-20 w-full object-cover transition-transform hover:scale-105"
              />
            </button>
          ))}
        </div>
      )}

      <h3 className="mt-3 text-[10px] uppercase tracking-[0.18em] text-roca-300">
        Comentarios
      </h3>
      {comentarios.length > 0 && (
        <ul className="mt-1.5 space-y-1.5">
          {comentarios.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-xs">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-roca-300">
                  <span className="text-hielo-300">{c.nombreUsuario}</span>
                  {" · "}
                  {fechaCorta(c.creadoEl)}
                </p>
                <p className="text-hielo-100">{c.texto}</p>
              </div>
              {c.usuario === usuario.uid && (
                <button
                  type="button"
                  aria-label="Borrar comentario"
                  onClick={async () => {
                    await borrarComentario(c.id);
                    await recargar();
                  }}
                  className="p-0.5 text-roca-400 transition-colors hover:text-nieve"
                >
                  <IconoPapelera width={12} height={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={enviarComentario} className="mt-2 flex gap-2">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe un comentario…"
          className="min-w-0 flex-1 rounded border border-roca-700 bg-roca-900/70 px-2 py-1 text-xs text-nieve placeholder:text-roca-500 focus:border-ocre-600 focus:outline-none"
        />
        <button
          type="submit"
          disabled={ocupado || !texto.trim()}
          className="rounded bg-ocre-600 px-2.5 py-1 text-xs text-roca-950 transition-colors hover:bg-ocre-400 disabled:opacity-40"
        >
          Enviar
        </button>
      </form>

      {/* Visor de foto ampliada */}
      {ampliada && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-roca-950/95 p-6"
          role="dialog"
          aria-label={`Foto de ${ampliada.nombreUsuario}`}
          onClick={() => setAmpliada(null)}
        >
          <img
            src={ampliada.datos}
            alt={`Foto de ${ampliada.nombreUsuario}`}
            className="max-h-[78vh] max-w-full rounded-lg border border-roca-700"
          />
          <div className="flex items-center gap-4 text-xs text-hielo-300">
            <span>
              {ampliada.nombreUsuario} · {fechaCorta(ampliada.creadoEl)}
            </span>
            {ampliada.usuario === usuario.uid && (
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  await borrarFoto(ampliada.id);
                  setAmpliada(null);
                  await recargar();
                }}
                className="flex items-center gap-1 text-roca-300 transition-colors hover:text-nieve"
              >
                <IconoPapelera width={13} height={13} />
                Borrar
              </button>
            )}
            <button
              type="button"
              onClick={() => setAmpliada(null)}
              className="flex items-center gap-1 transition-colors hover:text-nieve"
            >
              <IconoCerrar width={14} height={14} />
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
