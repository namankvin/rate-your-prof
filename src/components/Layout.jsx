import { useState, useEffect } from "react";
import { Link } from "./UI.jsx";
import Icon from "./Icon.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function Layout({ route, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const [logoutError, setLogoutError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  async function signOut() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      await logout();
      window.location.hash = "/";
    } catch (error) {
      setLogoutError(error.message);
    } finally {
      setLoggingOut(false);
    }
  }
  useEffect(() => setMenuOpen(false), [route]);
  const nav = [
    ["/", "Home"],
    ["/professors", "Professors"],
    ["/courses", "Courses"],
    ["/insights", "Insights"],
    ["/about", "About"],
  ];
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content").focus();
        }}
      >
        Skip to content
      </a>
      <header className="header">
        <div className="nav-container">
          <Link to="/" className="brand">
            <span className="brand-icon">
              <Icon name="cap" size={27} />
            </span>
            RateMyProf<span className="brand-dot">.</span>
          </Link>
          <nav
            aria-label="Main navigation"
            className={menuOpen ? "navigation open" : "navigation"}
          >
            {nav.map(([path, label]) => (
              <Link
                key={path}
                to={path}
                className={
                  (path === "/" ? route === "/" : route.startsWith(path))
                    ? "active"
                    : ""
                }
                aria-current={
                  (path === "/" ? route === "/" : route.startsWith(path))
                    ? "page"
                    : undefined
                }
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="nav-actions">
            {user ? (
              <>
                <span className="account-email" title={user.email}>
                  {user.role === "admin" ? "Admin" : user.email}
                </span>
                <button
                  className="logout-button"
                  disabled={loggingOut}
                  onClick={signOut}
                >
                  {loggingOut ? "…" : "Log out"}
                </button>
              </>
            ) : (
              <Link className="login-link" to="/login">
                Log in
              </Link>
            )}
            <Link className="button primary compact" to="/write-review">
              Write a review <Icon name="edit" size={15} />
            </Link>
            <button
              className="icon-button menu-button"
              aria-label="Toggle navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Icon name={menuOpen ? "close" : "menu"} />
            </button>
          </div>
        </div>
      </header>
      {logoutError && (
        <p className="form-error container" role="alert">
          {logoutError}
        </p>
      )}
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
