// The "rep." logotype, shared by Home, the lock screen and the loading screen.
export const Wordmark = ({ size = 34 }: { size?: number }) => (
  <span className="h1 wordmark" style={{ fontSize: size }}>rep<span style={{ color: 'var(--accent)' }}>.</span></span>
)
