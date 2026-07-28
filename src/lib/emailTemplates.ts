/**
 * Template de e-mail HTML para confirmação/aprovação de reserva — TreeCondo
 */

interface ReservaEmailParams {
  nomeResidente: string;
  areaNome: string;
  dateStr: string;       // YYYY-MM-DD
  opcaoNome?: string;
  condominioNome: string;
  reservaId: string;
  valorCobrado?: number;
  appUrl: string;
}

export function buildReservaConfirmadaEmail(params: ReservaEmailParams): { subject: string; html: string } {
  const {
    nomeResidente,
    areaNome,
    dateStr,
    opcaoNome,
    condominioNome,
    reservaId,
    valorCobrado,
    appUrl,
  } = params;

  // Formata data pt-BR
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const dataFormatada = dt.toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const valorStr = valorCobrado && valorCobrado > 0
    ? `R$ ${valorCobrado.toFixed(2).replace(".", ",")}`
    : "Sem cobrança";

  const subject = `✅ Reserva aprovada — ${areaNome} em ${dataFormatada}`;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reserva Aprovada — TreeCondo</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px 40px;text-align:center;">
            <div style="display:inline-flex;align-items:center;gap:10px;">
              <div style="width:36px;height:36px;background:#00D0E6;border-radius:8px;display:inline-block;"></div>
              <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">TreeCondo</span>
            </div>
            <p style="color:#94a3b8;font-size:13px;margin:8px 0 0;">${condominioNome}</p>
          </td>
        </tr>

        <!-- Status Badge -->
        <tr>
          <td style="background:#ecfdf5;padding:16px 40px;text-align:center;border-bottom:1px solid #d1fae5;">
            <span style="display:inline-block;background:#10b981;color:#ffffff;font-size:12px;font-weight:700;padding:4px 14px;border-radius:999px;letter-spacing:0.5px;text-transform:uppercase;">
              ✓ Reserva Aprovada
            </span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="color:#475569;font-size:16px;margin:0 0 8px;">Olá, <strong style="color:#0f172a;">${nomeResidente}</strong>!</p>
            <p style="color:#475569;font-size:15px;margin:0 0 32px;line-height:1.6;">
              Sua reserva foi <strong>aprovada</strong>. Confira os detalhes abaixo:
            </p>

            <!-- Detalhes da reserva -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:32px;">
              ${[
                ["📍 Área", areaNome],
                ["📅 Data", dataFormatada],
                ...(opcaoNome ? [["🎯 Opção", opcaoNome]] : []),
                ["💰 Valor", valorStr],
                ["🔖 ID da reserva", reservaId],
              ].map(([label, value], i) => `
              <tr style="border-top:${i > 0 ? "1px solid #e2e8f0" : "none"};">
                <td style="padding:12px 20px;color:#64748b;font-size:13px;font-weight:500;width:140px;">${label}</td>
                <td style="padding:12px 20px;color:#0f172a;font-size:14px;font-weight:600;">${value}</td>
              </tr>`).join("")}
            </table>

            <!-- CTA -->
            <div style="text-align:center;margin-bottom:32px;">
              <a href="${appUrl}/reservas"
                style="display:inline-block;background:#00D0E6;color:#0f172a;font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;">
                Ver Minha Reserva
              </a>
            </div>

            <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0;">
              Se precisar cancelar, lembre-se de fazer isso com pelo menos <strong>48 horas de antecedência</strong> 
              pela plataforma TreeCondo.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">
              Este e-mail foi gerado automaticamente pelo <strong>TreeCondo</strong>.<br>
              Em caso de dúvidas, acesse a plataforma ou entre em contato com a administração do condomínio.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

export function buildReservaCanceladaEmail(params: ReservaEmailParams & { motivoCancelamento?: string }): { subject: string; html: string } {
  const { nomeResidente, areaNome, dateStr, condominioNome, motivoCancelamento } = params;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const dataFormatada = dt.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const subject = `❌ Reserva cancelada — ${areaNome} em ${dataFormatada}`;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Reserva Cancelada — TreeCondo</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px 40px;text-align:center;">
            <span style="color:#ffffff;font-size:22px;font-weight:700;">TreeCondo</span>
            <p style="color:#94a3b8;font-size:13px;margin:8px 0 0;">${condominioNome}</p>
          </td>
        </tr>
        <tr>
          <td style="background:#fef2f2;padding:16px 40px;text-align:center;border-bottom:1px solid #fecaca;">
            <span style="display:inline-block;background:#ef4444;color:#fff;font-size:12px;font-weight:700;padding:4px 14px;border-radius:999px;letter-spacing:0.5px;text-transform:uppercase;">
              Reserva Cancelada
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="color:#475569;font-size:15px;margin:0 0 16px;">Olá, <strong>${nomeResidente}</strong>!</p>
            <p style="color:#475569;font-size:15px;margin:0 0 24px;line-height:1.6;">
              Sua reserva da área <strong>${areaNome}</strong> para o dia <strong>${dataFormatada}</strong> foi cancelada.
            </p>
            ${motivoCancelamento ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
              <p style="color:#b91c1c;font-size:13px;margin:0;"><strong>Motivo:</strong> ${motivoCancelamento}</p>
            </div>` : ""}
            <p style="color:#64748b;font-size:13px;line-height:1.6;">
              Para fazer uma nova reserva, acesse a plataforma TreeCondo.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">Gerado automaticamente pelo TreeCondo.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
