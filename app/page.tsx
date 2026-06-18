export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 640, margin: '80px auto', padding: 24 }}>
      <h1 style={{ fontSize: 28 }}>Chat Widget</h1>
      <p style={{ color: '#555', lineHeight: 1.6 }}>
        Multi-tenant embeddable AI chat. Manage your sites in the{' '}
        <a href="/admin">admin panel</a>.
      </p>
    </main>
  );
}
