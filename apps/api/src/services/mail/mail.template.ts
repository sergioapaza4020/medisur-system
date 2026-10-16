export type TransactionalMail =
  | { kind: 'test'; to: string }
  | {
      kind: 'password-reset' | 'login-link';
      to: string;
      url: string;
      expiresInMinutes: number;
    }
  | {
      kind: 'login-code';
      to: string;
      code: string;
      expiresInMinutes: number;
    };

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return entities[character];
  });

interface MailContent {
  subject: string;
  title: string;
  introduction: string;
  actionLabel?: string;
  securityTitle?: string;
  securityText: string;
}

function getMailContent(input: TransactionalMail): MailContent {
  switch (input.kind) {
    case 'test':
      return {
        subject: 'Prueba de correo MEDISUR',
        title: 'Correo configurado correctamente',
        introduction:
          'El servicio de correo transaccional de MEDISUR está configurado correctamente.',
        securityText: 'Este es un mensaje de prueba y no contiene información clínica.',
      };

    case 'password-reset':
      return {
        subject: 'MEDISUR: recuperación de contraseña',
        title: 'Restablece tu contraseña',
        introduction: 'Utiliza el siguiente enlace para restablecer tu contraseña en MEDISUR.',
        actionLabel: 'Restablecer contraseña',
        securityTitle: `Válido durante ${input.expiresInMinutes} minutos.`,
        securityText:
          'Si no solicitaste este mensaje, puedes ignorarlo. No compartas este enlace con otras personas.',
      };

    case 'login-link':
      return {
        subject: 'MEDISUR: inicio de sesión',
        title: 'Inicia sesión en MEDISUR',
        introduction: 'Utiliza el siguiente enlace seguro para iniciar sesión en tu cuenta.',
        actionLabel: 'Continuar en MEDISUR',
        securityTitle: `Válido durante ${input.expiresInMinutes} minutos.`,
        securityText:
          'Si no solicitaste este mensaje, puedes ignorarlo. No compartas este enlace con otras personas.',
      };

    case 'login-code':
      return {
        subject: 'MEDISUR: código de inicio de sesión',
        title: 'Tu código de acceso',
        introduction: 'Utiliza el siguiente código para iniciar sesión en MEDISUR.',
        securityTitle: `Válido durante ${input.expiresInMinutes} minutos.`,
        securityText:
          'Si no solicitaste este código, puedes ignorar este mensaje. No compartas este código con otras personas.',
      };
  }
}

function renderActionHtml(input: TransactionalMail, actionLabel?: string) {
  if (input.kind === 'test') {
    return '';
  }

  if (input.kind === 'login-code') {
    return `
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
        style="margin:32px 0;"
      >
        <tr>
          <td align="center">
            <div
              style="
                display:inline-block;
                padding:18px 32px;
                border:1px solid #D8E7F7;
                border-radius:12px;
                background-color:#F4F9FF;
                color:#0B2A55;
                font-family:Arial,sans-serif;
                font-size:30px;
                font-weight:700;
                letter-spacing:8px;
                line-height:1.2;
              "
            >
              ${escapeHtml(input.code)}
            </div>
          </td>
        </tr>
      </table>
    `;
  }

  return `
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="margin:32px 0;"
    >
      <tr>
        <td align="center">
          <table
            role="presentation"
            cellspacing="0"
            cellpadding="0"
            border="0"
          >
            <tr>
              <td
                align="center"
                bgcolor="#0877D1"
                style="
                  border-radius:10px;
                  background-color:#0877D1;
                "
              >
                <a
                  href="${escapeHtml(input.url)}"
                  target="_blank"
                  rel="noopener noreferrer"
                  style="
                    display:inline-block;
                    min-width:280px;
                    padding:16px 28px;
                    color:#FFFFFF;
                    font-family:Arial,sans-serif;
                    font-size:16px;
                    font-weight:700;
                    line-height:22px;
                    text-decoration:none;
                    text-align:center;
                    border-radius:10px;
                  "
                >
                  ${escapeHtml(actionLabel ?? 'Continuar en MEDISUR')} &nbsp;→
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function renderSecurityBox(content: MailContent) {
  return `
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="
        margin-top:8px;
        border-collapse:separate;
      "
    >
      <tr>
        <td
          style="
            padding:20px 22px;
            background-color:#F3F8FD;
            border:1px solid #E2EEF8;
            border-radius:12px;
          "
        >
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
          >
            <tr>
              <td
                width="52"
                valign="top"
                style="
                  width:52px;
                  padding-right:14px;
                "
              >
                <div
                  style="
                    width:44px;
                    height:44px;
                    border-radius:50%;
                    background-color:#E2F1FF;
                    color:#0877D1;
                    font-family:Arial,sans-serif;
                    font-size:23px;
                    line-height:44px;
                    text-align:center;
                  "
                >
                  ◷
                </div>
              </td>

              <td valign="middle">
                ${
                  content.securityTitle
                    ? `
                      <p
                        style="
                          margin:0 0 5px;
                          color:#102A56;
                          font-family:Arial,sans-serif;
                          font-size:15px;
                          font-weight:700;
                          line-height:21px;
                        "
                      >
                        ${escapeHtml(content.securityTitle)}
                      </p>
                    `
                    : ''
                }

                <p
                  style="
                    margin:0;
                    color:#63728A;
                    font-family:Arial,sans-serif;
                    font-size:14px;
                    line-height:21px;
                  "
                >
                  ${escapeHtml(content.securityText)}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function renderLogo(logoUrl?: string) {
  if (logoUrl) {
    try {
      const url = new URL(logoUrl.trim());
      if (url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash) {
        return `<img src="${escapeHtml(url.href)}" width="180" alt="MEDISUR" style="display:block;width:180px;max-width:100%;height:auto;border:0;" />`;
      }
    } catch {
      // Branding is optional: an invalid URL must never prevent mail delivery.
    }
  }
  return '<strong style="color:#102A56;font-family:Arial,sans-serif;font-size:28px;line-height:32px;">MEDISUR</strong>';
}

export function renderMail(input: TransactionalMail, logoUrl?: string) {
  const content = getMailContent(input);

  const action = input.kind === 'test' ? '' : input.kind === 'login-code' ? input.code : input.url;

  const text = [
    'MEDISUR',
    content.title,
    content.introduction,
    action,
    content.securityTitle,
    content.securityText,
    'MEDISUR | Comprometidos con tu salud',
  ]
    .filter(Boolean)
    .join('\n\n');

  const actionHtml = renderActionHtml(input, content.actionLabel);
  const securityHtml = renderSecurityBox(content);
  const logoHtml = renderLogo(logoUrl);

  const html = `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
    />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(content.subject)}</title>
  </head>

  <body
    style="
      margin:0;
      padding:0;
      background-color:#F2F7FC;
      color:#102A56;
      font-family:Arial,Helvetica,sans-serif;
      -webkit-text-size-adjust:100%;
      -ms-text-size-adjust:100%;
    "
  >
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="
        width:100%;
        background-color:#F2F7FC;
        border-collapse:collapse;
      "
    >
      <tr>
        <td
          align="center"
          style="
            padding:40px 16px;
          "
        >
          <table
            role="presentation"
            width="600"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
              width:100%;
              max-width:600px;
              background-color:#FFFFFF;
              border:1px solid #E4EDF6;
              border-radius:18px;
              overflow:hidden;
            "
          >
            <!-- Header / marca -->
            <tr>
              <td align="left">
                <table
                  role="presentation"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="border-collapse:collapse;"
                >
                  <tr>
                    <td
                      valign="middle"
                      style="
                        padding-right:14px;
                      "
                    >
                      ${logoHtml}
                    </td>

                    <td valign="middle">
                    <p
                      style="
                        margin:0;
                        color:#102A56;
                        font-family:Arial,sans-serif;
                        font-size:28px;
                        font-weight:700;
                        line-height:32px;
                        letter-spacing:0.5px;
                      "
                    >
                      MEDISUR
                    </p>

                    <p
                      style="
                        margin:4px 0 0;
                        color:#7292B9;
                        font-family:Arial,sans-serif;
                        font-size:10px;
                        font-weight:700;
                        line-height:14px;
                        letter-spacing:2px;
                        text-transform:uppercase;
                      "
                    >
                      Salud más cerca de ti
                    </p>
                  </td>
                </tr>
              </table>
            </td>
            </tr>
            <!-- Contenido -->
            <tr>
              <td
                style="
                  padding:10px 40px 36px;
                "
              >
                <!-- Ilustración simple -->
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    margin-bottom:20px;
                  "
                >
                  <tr>
                    <td align="center">
                      <div
                        style="
                          width:94px;
                          height:94px;
                          border-radius:50%;
                          background-color:#EEF7FF;
                          color:#0877D1;
                          font-family:Arial,sans-serif;
                          font-size:48px;
                          line-height:94px;
                          text-align:center;
                        "
                      >
                        🔒
                      </div>
                    </td>
                  </tr>
                </table>

                <h1
                  style="
                    margin:0 0 14px;
                    color:#102A56;
                    font-family:Arial,sans-serif;
                    font-size:30px;
                    font-weight:700;
                    line-height:38px;
                    text-align:center;
                  "
                >
                  ${escapeHtml(content.title)}
                </h1>

                <p
                  style="
                    margin:0 auto;
                    max-width:470px;
                    color:#64748B;
                    font-family:Arial,sans-serif;
                    font-size:16px;
                    font-weight:400;
                    line-height:25px;
                    text-align:center;
                  "
                >
                  ${escapeHtml(content.introduction)}
                </p>

                ${actionHtml}

                ${securityHtml}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td
                style="
                  padding:0 40px 28px;
                "
              >
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                >
                  <tr>
                    <td
                      style="
                        border-top:1px solid #E7EDF4;
                        padding-top:22px;
                      "
                    >
                      <p
                        style="
                          margin:0;
                          color:#94A3B8;
                          font-family:Arial,sans-serif;
                          font-size:12px;
                          line-height:18px;
                          text-align:center;
                        "
                      >
                        MEDISUR &nbsp; | &nbsp; Comprometidos con tu salud
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <table
            role="presentation"
            width="600"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
              width:100%;
              max-width:600px;
            "
          >
            <tr>
              <td
                style="
                  padding:18px 24px 0;
                "
              >
                <p
                  style="
                    margin:0;
                    color:#94A3B8;
                    font-family:Arial,sans-serif;
                    font-size:11px;
                    line-height:17px;
                    text-align:center;
                  "
                >
                  Este es un mensaje automático de MEDISUR.
                  Por favor, no respondas a este correo.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();

  return {
    subject: content.subject,
    text,
    html,
  };
}
