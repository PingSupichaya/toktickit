import { AuthProvider, useAuth } from "./context/AuthContext.js";
import { AuthLayout } from "./components/layout/AuthLayout.js";
import { RequireAuth } from "./components/layout/RequireAuth.js";
import { RequirePasswordChange } from "./components/layout/RequirePasswordChange.js";
import { AppShell } from "./components/layout/AppShell.js";
import { LoginForm } from "./components/ui/LoginForm.js";
import { ChangePasswordForm } from "./components/ui/ChangePasswordForm.js";
import { Spinner } from "./components/ui/Spinner.js";

function AppGate() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="auth-screen">
        <Spinner large label="Checking session" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <AuthLayout>
        <LoginForm />
      </AuthLayout>
    );
  }

  return (
    <>
      <RequirePasswordChange>
        <AuthLayout size="md">
          <ChangePasswordForm />
        </AuthLayout>
      </RequirePasswordChange>
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}