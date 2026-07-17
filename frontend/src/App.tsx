import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Privacy from "./pages/Privacy";
import Courses from "./pages/Courses";
import NewCourse from "./pages/NewCourse";
import CourseView from "./pages/CourseView";
import Upgrade from "./pages/Upgrade";

function FullPageLoader() {
  return (
    <div className="auth-wrap">
      <p style={{ color: "var(--ink-soft)" }}>Loading…</p>
    </div>
  );
}

// Requires a signed-in user who has accepted the privacy statement.
function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/signin" replace />;
  if (!user.privacyAccepted) return <Navigate to="/privacy" replace />;
  return <>{children}</>;
}

// Auth screens redirect away if already fully signed in.
function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (user && user.privacyAccepted) return <Navigate to="/courses" replace />;
  return <>{children}</>;
}

// Privacy screen: needs a user, but only before they've accepted.
function PrivacyGate() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/signin" replace />;
  if (user.privacyAccepted) return <Navigate to="/courses" replace />;
  return <Privacy />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/signin" element={<PublicOnly><SignIn /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><SignUp /></PublicOnly>} />
      <Route path="/privacy" element={<PrivacyGate />} />
      <Route path="/courses" element={<Protected><Courses /></Protected>} />
      <Route path="/courses/new" element={<Protected><NewCourse /></Protected>} />
      <Route path="/courses/:id" element={<Protected><CourseView /></Protected>} />
      <Route path="/upgrade" element={<Protected><Upgrade /></Protected>} />
      <Route path="*" element={<Navigate to="/courses" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
