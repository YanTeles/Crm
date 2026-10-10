// Tradução dos códigos de erro do banco (prefixo "crm:") e erros comuns do
// Postgres/Supabase para mensagens claras ao usuário.
const MESSAGES: Record<string, string> = {
  not_authenticated: "Sua sessão expirou. Entre novamente.",
  forbidden: "Você não tem permissão para esta ação.",
  not_found: "Registro não encontrado ou sem acesso.",
  version_conflict: "Este registro foi alterado por outra pessoa. Atualize a página e tente novamente.",
  email_not_confirmed: "Confirme seu e-mail antes de continuar.",
  invalid_company_name: "Informe um nome de empresa com 2 a 120 caracteres.",
  invalid_slug: "Use de 3 a 48 caracteres: letras minúsculas, números e hífens.",
  slug_taken: "Este endereço já está em uso.",
  slug_reserved: "Este endereço é reservado. Escolha outro.",
  slug_unavailable: "Não foi possível gerar um endereço para a empresa.",
  invalid_timezone: "Fuso horário inválido.",
  invalid_email: "E-mail inválido.",
  already_member: "Esta pessoa já faz parte da equipe.",
  invitation_invalid: "Convite inválido ou revogado.",
  invitation_used: "Este convite já foi utilizado.",
  invitation_expired: "Este convite expirou. Peça um novo ao administrador.",
  invitation_email_mismatch: "Este convite foi enviado para outro e-mail. Entre com o e-mail convidado.",
  invitation_not_pending: "Este convite não está mais pendente.",
  company_suspended: "Esta empresa está suspensa.",
  last_admin: "A empresa precisa de pelo menos um administrador ativo.",
  member_has_leads: "Redistribua os leads deste vendedor antes de promovê-lo a administrador.",
  cannot_deactivate_self: "Você não pode desativar o próprio acesso.",
  invalid_lead_name: "Informe o nome do lead.",
  invalid_phone: "Telefone inválido.",
  invalid_source: "Origem inválida ou desativada.",
  no_default_stage: "Configure uma etapa inicial no funil.",
  auto_distribution_disabled: "A distribuição automática está desativada nas configurações.",
  assignee_not_active_seller: "Selecione um vendedor ativo.",
  assignee_not_active: "O responsável precisa ser um membro ativo.",
  invalid_assignment_mode: "Modo de atribuição inválido.",
  invalid_custom_values: "Campos personalizados inválidos.",
  invalid_custom_field: "Campo personalizado inválido.",
  custom_field_inactive: "Este campo personalizado está desativado.",
  custom_field_invalid: "Valor inválido em campo personalizado.",
  custom_field_required: "Preencha os campos personalizados obrigatórios.",
  lead_archived: "Este lead está arquivado.",
  lead_not_open: "A oportunidade já está encerrada. Reabra para continuar.",
  lead_already_open: "A oportunidade já está aberta.",
  use_close_action: "Use as ações de Ganho ou Perdido para encerrar a oportunidade.",
  invalid_stage: "Etapa inválida.",
  invalid_target_stage: "Escolha uma etapa de destino válida para os leads.",
  stage_is_default: "A etapa inicial não pode ser removida. Defina outra como inicial antes.",
  stage_name_taken: "Já existe uma etapa com este nome.",
  stage_kind_immutable: "O tipo da etapa não pode ser alterado.",
  invalid_stage_order: "Ordem de etapas inválida. Atualize a página.",
  invalid_amount: "Informe um valor válido, com até duas casas decimais.",
  invalid_lost_reason: "Selecione um motivo de perda ativo.",
  note_too_long: "Observação muito longa.",
  invalid_description: "Informe a descrição (até 500 caracteres).",
  invalid_status: "Status inválido.",
  invalid_completed_at: "Data de conclusão inválida (não pode estar no futuro).",
  seller_not_active: "O vendedor precisa ser um membro ativo.",
  sale_cancelled: "Vendas canceladas não podem ser alteradas.",
  sale_not_pending: "Somente vendas pendentes podem ser concluídas.",
  cancel_reason_required: "Informe o motivo do cancelamento.",
  limit_reached: "Limite atingido para este tipo de cadastro.",
  field_type_locked: "O tipo não pode mudar porque o campo já possui valores ou opções.",
  immutable_record: "Registros de histórico não podem ser alterados.",
};

export type DbError = { code?: string; message?: string; details?: string | null } | null | undefined;

export function errorCode(error: DbError): string | null {
  const match = error?.message?.match(/^crm:([a-z_]+)/);
  return match?.[1] ?? null;
}

export function translateError(error: DbError, fallback = "Não foi possível concluir a operação."): string {
  if (!error) return fallback;
  const code = errorCode(error);
  if (code && MESSAGES[code]) return MESSAGES[code];
  switch (error.code) {
    case "23505":
      return "Já existe um registro com estes dados.";
    case "23503":
    case "23001":
      return "Este registro está em uso e não pode ser removido. Desative-o.";
    case "42501":
      return MESSAGES.forbidden;
    case "PGRST301":
    case "PGRST303":
      return MESSAGES.not_authenticated;
  }
  return fallback;
}
