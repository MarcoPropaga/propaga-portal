/* Mensagens de erro do login em português, com orientação do que fazer. */
export function mensagemErroAuth(e: unknown): string {
  const code = (e as { code?: string })?.code || "";
  const m: Record<string, string> = {
    "auth/invalid-credential": "E-mail ou senha incorretos. Confira e tente de novo.",
    "auth/wrong-password": "E-mail ou senha incorretos. Confira e tente de novo.",
    "auth/user-not-found": "E-mail ou senha incorretos. Confira e tente de novo.",
    "auth/invalid-email": "Digite um e-mail válido.",
    "auth/user-disabled": "Este acesso foi desativado. Fale com a Propaga.",
    "auth/too-many-requests": "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.",
    "auth/network-request-failed": "Sem conexão com a internet. Verifique a rede e tente de novo.",
    "auth/expired-action-code": "Este link expirou. Use “Gerar novo link” para receber outro.",
    "auth/invalid-action-code": "Este link já foi usado ou não é válido. Use “Gerar novo link” para receber outro.",
    "auth/weak-password": "A senha não cumpre os requisitos indicados.",
    "auth/password-does-not-meet-requirements": "A senha não cumpre os requisitos indicados.",
    "auth/invalid-verification-code": "Código incorreto. Digite os 6 números que aparecem agora no aplicativo.",
    "auth/missing-code": "Digite os 6 números do aplicativo autenticador.",
    "auth/totp-challenge-timeout": "O tempo para digitar o código acabou. Entre de novo.",
    "auth/requires-recent-login": "Por segurança, entre de novo para continuar.",
    "auth/unverified-email": "Confirme seu e-mail pelo link do convite antes de ativar a verificação em duas etapas.",
  };
  return m[code] || "Não foi possível concluir agora. Tente de novo em instantes.";
}
