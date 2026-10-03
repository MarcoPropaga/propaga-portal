/* Firebase Authentication (Identity Platform) via REST administrativo. */
import { json, type Plataforma } from "./plataforma";

const V1 = "https://identitytoolkit.googleapis.com/v1";
const ADMIN_V2 = "https://identitytoolkit.googleapis.com/admin/v2";

export class Identidade {
  constructor(private p: Plataforma, private projeto: string) {}

  buscarPorEmail(email: string): { localId: string; email: string } | null {
    const r = json<{ users?: { localId: string; email: string }[] }>(
      this.p.http(`${V1}/projects/${this.projeto}/accounts:lookup`, "post", { email: [email] }), "buscar usuário");
    return r.users?.[0] ?? null;
  }

  /** O e-mail fica verificado: o acesso só se completa pelo link enviado a ele, e o 2FA exige e-mail verificado. */
  criar(email: string, nome: string): string {
    const r = json<{ localId: string }>(
      this.p.http(`${V1}/projects/${this.projeto}/accounts`, "post", { email, displayName: nome, emailVerified: true }),
      "criar usuário");
    return r.localId;
  }

  definirClaims(localId: string, claims: Record<string, unknown>) {
    json(this.p.http(`${V1}/projects/${this.projeto}/accounts:update`, "post",
      { localId, customAttributes: JSON.stringify(claims), emailVerified: true }), "definir perfil");
  }

  /** Gera (sem enviar) o link de definição de senha e devolve só o oobCode. Validade: 1 hora. */
  codigoDefinirSenha(email: string): string {
    const r = json<{ oobLink: string }>(
      this.p.http(`${V1}/projects/${this.projeto}/accounts:sendOobCode`, "post",
        { requestType: "PASSWORD_RESET", email, returnOobLink: true }), "gerar link de senha");
    const m = /[?&]oobCode=([^&]+)/.exec(r.oobLink);
    if (!m) throw new Error("Link de senha sem oobCode.");
    return decodeURIComponent(m[1]);
  }

  /** Liga TOTP (aplicativo autenticador), política de senha e proteção contra enumeração de e-mails. */
  configurarSeguranca() {
    const corpo = {
      mfa: { state: "ENABLED", providerConfigs: [{ state: "ENABLED", totpProviderConfig: { adjacentIntervals: 5 } }] },
      passwordPolicyConfig: {
        passwordPolicyEnforcementState: "ENFORCE",
        forceUpgradeOnSignin: true,
        passwordPolicyVersions: [{
          customStrengthOptions: {
            minPasswordLength: 8, containsUppercaseCharacter: true,
            containsNumericCharacter: true, containsNonAlphanumericCharacter: true,
          },
        }],
      },
      emailPrivacyConfig: { enableImprovedEmailPrivacy: true },
    };
    json(this.p.http(`${ADMIN_V2}/projects/${this.projeto}/config?updateMask=mfa,passwordPolicyConfig,emailPrivacyConfig`,
      "patch", corpo), "configurar segurança do login");
  }
}
