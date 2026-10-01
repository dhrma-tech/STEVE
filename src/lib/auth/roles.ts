/** Roles that may change things. A `viewer` can see everything in the org but not act on it. */
export const WRITER_ROLES: readonly string[] = ["owner", "admin", "member"];
/** Owners and admins are the org's managers: they set budgets and policy and can always-approve tools. */
export const MANAGER_ROLES: readonly string[] = ["owner", "admin"];

export const isWriterRole = (role: string) => WRITER_ROLES.includes(role);
export const isManagerRole = (role: string) => MANAGER_ROLES.includes(role);
