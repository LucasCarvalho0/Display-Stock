export const PERMISSIONS = {
  "stock.view": "Consultar estoque e movimentações",
  "movements.create": "Registrar entradas e saídas",
  "inventory.count": "Realizar contagens e justificativas de inventário",
  "movements.correct": "Corrigir lançamentos",
  "inventory.approve": "Aprovar divergências e inventários",
  "inventory.close": "Fechar inventários",
  "adjustments.authorize": "Autorizar ajustes de estoque",
  "products.edit": "Criar/alterar cadastros e importar planilhas",
  "reports.export": "Exportar relatórios",
  "users.manage": "Gerenciar usuários e permissões",
  "settings.manage": "Alterar configurações do sistema",
} as const;
export type PermissionKey = keyof typeof PERMISSIONS;
const ALL = Object.keys(PERMISSIONS) as PermissionKey[];
const BASIC: PermissionKey[] = ["stock.view", "movements.create", "inventory.count", "reports.export"];

/** Perfis iniciais. O administrador pode reconfigurar em Usuários → Perfis e permissões. */
export const DEFAULT_ROLES: Record<string, { description: string; permissions: PermissionKey[] }> = {
  Administrador: { description: "Acesso total", permissions: ALL },
  Líder: {
    description: "Líder de operação: corrige, aprova e fecha",
    permissions: [...BASIC, "movements.correct", "inventory.approve", "inventory.close", "adjustments.authorize", "products.edit"],
  },
  Administrativo: { description: "Operação diária", permissions: BASIC },
};
