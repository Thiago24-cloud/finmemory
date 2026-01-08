export default function Home() {
  return (
    <div style={{ 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '50px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>
        🚀 FinMemory
      </h1>
      <p style={{ fontSize: '20px', color: '#666', marginBottom: '40px' }}>
        Seu assistente financeiro inteligente via e-mail
      </p>
      <a 
        href="/dashboard" 
        style={{ 
          display: 'inline-block',
          padding: '15px 40px',
          background: '#0070f3',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '8px',
          fontSize: '18px',
          fontWeight: 'bold',
          transition: 'background 0.3s'
        }}
        onMouseOver={(e) => e.target.style.background = '#0051cc'}
        onMouseOut={(e) => e.target.style.background = '#0070f3'}
      >
        Acessar Dashboard
      </a>
    </div>
  );
}