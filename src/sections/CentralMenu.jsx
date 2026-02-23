import '../styles/central-menu.css'
import { centralMenuLinks } from '../constants/centralMenuLinks'

function CentralMenu() {
  return (
    <main className="landing-shell">
      <div className="landing-bg" aria-hidden="true">
        <div className="bg-soft-mesh" />
        <div className="bg-grid-pattern" />
      </div>

      <section className="central-menu-hero">
        <div className="orb orb-left" aria-hidden="true" />
        <div className="orb orb-right" aria-hidden="true" />

        <div className="hero-content">
          <div className="hero-icon" aria-hidden="true">
            <span className="material-symbols-outlined">school</span>
          </div>

          <h1>HIKAGEN</h1>
          <p>Plataforma de Gestión Escolar</p>

          <nav className="glass-menu" aria-label="Menú principal">
            {centralMenuLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}

            <span className="menu-divider" aria-hidden="true" />

            <button type="button" className="menu-login-btn">
              Login
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </nav>
        </div>
      </section>
    </main>
  )
}

export default CentralMenu
