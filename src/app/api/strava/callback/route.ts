import type { NextRequest } from "next/server";

/**
 * Retorno del OAuth de Strava: intercambia el código por tokens usando el
 * secreto (solo servidor) y devuelve al mapa con los tokens en el fragmento
 * de la URL (#strava=...), que nunca llega a servidores ni a logs.
 */
export async function GET(request: NextRequest) {
  const codigo = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  if (error || !codigo) {
    return redirigir(`/#strava_error=${encodeURIComponent(error ?? "sin_codigo")}`);
  }

  const respuesta = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code: codigo,
      grant_type: "authorization_code",
    }),
  });
  if (!respuesta.ok) {
    return redirigir("/#strava_error=intercambio_fallido");
  }
  const datos = await respuesta.json();
  const conexion = {
    accessToken: datos.access_token,
    refreshToken: datos.refresh_token,
    expiraEn: datos.expires_at,
    atleta: `${datos.athlete?.firstname ?? ""} ${datos.athlete?.lastname ?? ""}`.trim(),
  };
  return redirigir(`/#strava=${encodeURIComponent(JSON.stringify(conexion))}`);
}

/** Location relativa: funciona igual detrás del proxy de Codespaces y en Vercel. */
function redirigir(destino: string) {
  return new Response(null, { status: 302, headers: { Location: destino } });
}
