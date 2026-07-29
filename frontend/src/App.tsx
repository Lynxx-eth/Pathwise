import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { ThemeProvider } from "./lib/theme";
import { ToastProvider } from "./lib/toast";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Privacy from "./pages/Privacy";
import Courses from "./pages/Courses";
import NewCourse from "./pages/NewCourse";
import CourseView from "./pages/CourseView";
import Upgrade from "./pages/Upgrade";
import StudyPlan from "./pages/StudyPlan";
import Quiz from "./pages/Quiz";
import Socratic from "./pages/Socratic";
import SocraticChat from "./pages/SocraticChat";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Game from "./pages/Game";
import Shop from "./pages/Shop";

function FullPageLoader() {
  return (
    <div className="auth-wrap">
      <p style={{ color: "var(--ink-soft)" }} role="status">
        Loading…
      </p>
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
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/privacy" element={<PrivacyGate />} />

      <Route path="/courses" element={<Protected><Courses /></Protected>} />
      <Route path="/courses/new" element={<Protected><NewCourse /></Protected>} />
      <Route path="/courses/:id" element={<Protected><CourseView /></Protected>} />
      <Route path="/study-plan/:id" element={<Protected><StudyPlan /></Protected>} />

      {/* Quizzes and Socratic sessions are server-side sessions, so their ids
          are in the URL — a refresh resumes exactly where the student was. The
          id-less forms resume the most recent session or pick a course. */}
      <Route path="/quiz" element={<Protected><Quiz /></Protected>} />
      <Route path="/quiz/:sessionId" element={<Protected><Quiz /></Protected>} />
      <Route path="/socratic" element={<Protected><Socratic /></Protected>} />
      <Route path="/socratic/chat/:sessionId" element={<Protected><SocraticChat /></Protected>} />

      <Route path="/progress" element={<Protected><Dashboard /></Protected>} />
      <Route path="/progress/:id" element={<Protected><Dashboard /></Protected>} />

      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/game" element={<Protected><Game /></Protected>} />
      <Route path="/shop" element={<Protected><Shop /></Protected>} />
      <Route path="/upgrade" element={<Protected><Upgrade /></Protected>} />

      <Route path="*" element={<Navigate to="/courses" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
