// Landing page Stripe redirects to after Checkout. Renders a one-button HTML
// page that deep-links back into the app via the `komanda://` scheme. We
// can't pass Stripe a custom-scheme URL directly — it requires http(s).

const SCHEME = 'komanda';

export default function (req: Request): Response {
  const url = new URL(req.url);
  const status = url.searchParams.get('status') === 'cancel' ? 'cancel' : 'success';

  const title = status === 'success' ? '¡Listo!' : 'Pago cancelado';
  const body =
    status === 'success'
      ? 'Tu suscripción está activa. Vuelve a Komanda para continuar.'
      : 'No completaste el pago. Puedes intentarlo de nuevo cuando quieras.';

  // Three slashes → empty authority → `billing/${status}` is the path,
  // not the host. Expo Router matches paths, not hosts, so a two-slash
  // form (`komanda://billing/...`) lands on Unmatched Route.
  const deepLink = `${SCHEME}:///billing/${status}`;

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
  <style>
    :root { color-scheme: light dark; }
    html, body { margin: 0; padding: 0; height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
    body { display: flex; align-items: center; justify-content: center; background: #F5EBD9; color: #1f1d18; }
    .card { max-width: 420px; margin: 24px; padding: 28px; border-radius: 24px; background: #fff; box-shadow: 0 10px 40px rgba(0,0,0,.08); text-align: center; }
    h1 { margin: 0 0 12px; font-size: 22px; }
    p { margin: 0 0 24px; line-height: 1.4; color: #4a463d; }
    a.btn { display: inline-block; padding: 14px 22px; border-radius: 999px; background: #1f1d18; color: #fff; text-decoration: none; font-weight: 700; }
  </style>
  <script>
    // Try to bounce straight into the app. If the scheme isn't registered
    // (web preview, no install), the visible button is the fallback.
    setTimeout(function () { window.location.replace(${JSON.stringify(deepLink)}); }, 50);
  </script>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${body}</p>
    <a class="btn" href="${deepLink}">Volver a Komanda</a>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
