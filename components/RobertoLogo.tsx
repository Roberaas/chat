export default function RobertoLogo({ size = 30 }: { size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: Math.round(size * 0.27),
        background: 'linear-gradient(135deg,var(--ac) 0%,#5b4de0 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        boxShadow: '0 4px 12px rgba(124,106,247,.35)',
        color: '#fff', fontWeight: 800, fontSize: Math.round(size * 0.5), letterSpacing: '-.5px',
      }}
    >
      R
    </div>
  )
}
