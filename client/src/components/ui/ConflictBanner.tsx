import { Alert } from "./Alert.js";

// Reusable 409 STALE_UPDATE banner (ui-spec §6.3, §7, §10): role="alert" so
// screen readers announce it immediately when a stale-write response arrives.
export function ConflictBanner({ message }: { message: string }) {
  return (
    <Alert
      variant="warning"
      role="alert"
      data-testid="action-conflict-banner"
    >
      {message}
    </Alert>
  );
}
