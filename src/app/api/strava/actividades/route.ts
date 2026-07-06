import type { NextRequest } from "next/server";

/**
 * Proxy de lectura de actividades: el API de Strava no permite CORS desde
 * el navegador, así que la petición pasa por aquí con el token del usuario.
 */
export async function GET(request: NextRequest) {
  const autorizacion = request.headers.get("authorization");
  if (!autorizacion?.startsWith("Bearer ")) {
    return Response.json({ error: "sin token" }, { status: 401 });
  }
  const pagina = request.nextUrl.searchParams.get("page") ?? "1";
  const despuesDe = request.nextUrl.searchParams.get("after");

  const url = new URL("https://www.strava.com/api/v3/athlete/activities");
  url.searchParams.set("per_page", "200");
  url.searchParams.set("page", pagina);
  if (despuesDe) url.searchParams.set("after", despuesDe);

  const respuesta = await fetch(url, {
    headers: { Authorization: autorizacion },
  });
  if (!respuesta.ok) {
    return Response.json(
      { error: `strava_${respuesta.status}` },
      { status: respuesta.status === 401 ? 401 : 502 },
    );
  }
  return Response.json(await respuesta.json());
}
