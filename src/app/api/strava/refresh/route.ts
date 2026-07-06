/**
 * Renueva el token de acceso de Strava (caduca cada 6 horas). El cliente
 * guarda sus tokens; el secreto necesario para renovarlos vive solo aquí.
 */
export async function POST(request: Request) {
  const { refreshToken } = await request.json().catch(() => ({}));
  if (!refreshToken) {
    return Response.json({ error: "falta refreshToken" }, { status: 400 });
  }
  const respuesta = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!respuesta.ok) {
    return Response.json({ error: "renovacion_fallida" }, { status: 502 });
  }
  const datos = await respuesta.json();
  return Response.json({
    accessToken: datos.access_token,
    refreshToken: datos.refresh_token,
    expiraEn: datos.expires_at,
  });
}
