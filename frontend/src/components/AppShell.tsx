// Sidebar + mobile tab-bar layout wrapping the signed-in app screens.
import { NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../lib/auth";
import {
  HomeIcon,
  PlusCircleIcon,
  ChartIcon,
  FlameIcon,
  ChevronDownIcon,
} from "./icons";

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? "nav-item active" : "nav-item";
}
function tabClass({ isActive }: { isActive: boolean }) {
  return isActive ? "tab-item active" : "tab-item";
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initial = user?.name?.charAt(0).toUpperCase() ?? "?";

  return (
    <>
      <div className="app-shell">
        <aside className="sidebar">
          <NavLink to="/courses" className="sidebar-logo">
            <div className="mark">P</div> Pathwise
          </NavLink>
          <nav className="nav-list">
            <NavLink to="/courses" className={navClass} end>
              <HomeIcon /> Courses
            </NavLink>
            <NavLink to="/courses/new" className={navClass}>
              <PlusCircleIcon /> Add course
            </NavLink>
            <NavLink to="/progress" className={navClass}>
              <ChartIcon /> Progress
            </NavLink>
          </nav>
          <div className="sidebar-streak">
            <FlameIcon cls="icon-lg" style={{ color: "var(--accent)" }} />
            <div>
              <div className="mono" style={{ fontWeight: 700, fontSize: 14 }}>
                {user?.streakCount ?? 0} day streak
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                Best: {user?.bestStreak ?? 0} days
              </div>
            </div>
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <div>
              <div className="eyebrow">Your courses</div>
              <h1 className="section-title">Hi, {user?.name ?? "there"}</h1>
            </div>
            <button
              className="profile-trigger"
              onClick={() => {
                logout();
                navigate("/signin");
              }}
              title="Log out"
            >
              <div className="avatar">{initial}</div>
              <span className="name">{user?.name}</span>
              <ChevronDownIcon cls="icon-sm chev" />
            </button>
          </div>
          {children}
        </main>
      </div>

      <div className="tab-bar">
        <NavLink to="/courses" className={tabClass} end>
          <HomeIcon />
          Courses
        </NavLink>
        <NavLink to="/courses/new" className={tabClass}>
          <PlusCircleIcon />
          Add
        </NavLink>
        <NavLink to="/progress" className={tabClass}>
          <ChartIcon />
          Progress
        </NavLink>
      </div>
    </>
  );
}
