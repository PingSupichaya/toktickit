import { UserRole } from "../../api.js";

const ROLE_LABELS: Record<UserRole, string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMIN: "Administrator",
};

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={`role-badge role-badge--${role}`}
      data-testid="role-badge"
      data-value={role}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}