export default function Footer() {
  return (
    <footer className="site">
      <div className="wrap foot-grid">
        <div className="foot-left">
          <div className="foot-brand">
            <span className="brand-mark"><span>R</span></span>
            Reko
          </div>
          <span className="foot-copy">&copy; 2026 &middot; MIT licensed</span>
        </div>
        <div className="foot-links">
          <a href="https://github.com/6uan/reko" target="_blank" rel="noreferrer">GitHub</a>
          <a href="#">Docs</a>
          <a href="#">Privacy</a>
          <a href="#">Changelog</a>
        </div>
        <div className="powered-strava">
          <span className="strava-dot" />
          Powered by <strong>Strava</strong>
        </div>
      </div>
    </footer>
  )
}
