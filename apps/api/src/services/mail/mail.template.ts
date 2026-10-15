export type TransactionalMail =
  | { kind: 'test'; to: string }
  | { kind: 'password-reset' | 'login-link'; to: string; url: string; expiresInMinutes: number }
  | { kind: 'login-code'; to: string; code: string; expiresInMinutes: number };

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

export function renderMail(input: TransactionalMail) {
  const subject =
    input.kind === 'test'
      ? 'Prueba de correo MEDISUR'
      : input.kind === 'password-reset'
        ? 'MEDISUR: recuperación de contraseña'
        : 'MEDISUR: inicio de sesión';
  const introduction =
    input.kind === 'test'
      ? 'El servicio de correo transaccional de MEDISUR está configurado correctamente.'
      : input.kind === 'password-reset'
        ? 'Utiliza el siguiente enlace para restablecer tu contraseña.'
        : input.kind === 'login-link'
          ? 'Utiliza el siguiente enlace para iniciar sesión.'
          : 'Utiliza el siguiente código para iniciar sesión.';
  const action = input.kind === 'test' ? '' : input.kind === 'login-code' ? input.code : input.url;
  const footer =
    input.kind === 'test'
      ? 'Este mensaje no contiene información clínica.'
      : `Válido durante ${input.expiresInMinutes} minutos. Si no solicitaste este mensaje, ignóralo. No compartas este enlace o código.`;
  const actionHtml =
    input.kind === 'test'
      ? ''
      : input.kind === 'login-code'
        ? `<p style="font-size:24px;font-weight:bold">${escapeHtml(action)}</p>`
        : `<p><a href="${escapeHtml(action)}">Continuar en MEDISUR</a></p>`;
  return {
    subject,
    text: ['MEDISUR', introduction, action, footer].filter(Boolean).join('\n\n'),
    html: `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${subject}</title></head><body style="font-family:Arial,sans-serif;color:#333"><main style="max-width:600px;margin:auto;padding:24px"><h1>MEDISUR</h1><p>${introduction}</p>${actionHtml}<p>${footer}</p></main></body></html>`,
  };
}
