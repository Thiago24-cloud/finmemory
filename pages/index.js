export default function Home() {
  return (
    <div style={{ 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '50px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{
        background: 'white',
        padding: '60px 40px',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        textAlign: 'center',
        maxWidth: '600px',
        width: '100%'
      }}>
        <h1 style={{ 
          fontSize: '48px', 
          marginBottom: '20px',
          background: 'linear-gradient(135deg, #667eea, #764ba2)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontWeight: 'bold'
        }}>
          🚀 FinMemory
        </h1>
        <p style={{ 
          fontSize: '20px', 
          color: '#666', 
          marginBottom: '40px',
          lineHeight: '1.6'
        }}>
          Seu assistente financeiro inteligente que organiza suas notas fiscais automaticamente do Gmail
        </p>
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          alignItems: 'center'
        }}>
          <a 
            href="/api/auth/google" 
            style={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '16px 40px',
              background: 'linear-gradient(135deg, #34A853, #0F9D58)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              fontSize: '18px',
              fontWeight: 'bold',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 4px 12px rgba(52, 168, 83, 0.3)',
              width: '100%',
              maxWidth: '400px'
            }}
            onMouseOver={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 20px rgba(52, 168, 83, 0.4)';
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 12px rgba(52, 168, 83, 0.3)';
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Entrar com Google
          </a>
          
          <a 
            href="/dashboard" 
            style={{ 
              display: 'inline-block',
              padding: '14px 40px',
              background: 'transparent',
              color: '#667eea',
              textDecoration: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              border: '2px solid #667eea',
              transition: 'all 0.2s',
              width: '100%',
              maxWidth: '400px'
            }}
            onMouseOver={(e) => {
              e.target.style.background = '#667eea';
              e.target.style.color = 'white';
            }}
            onMouseOut={(e) => {
              e.target.style.background = 'transparent';
              e.target.style.color = '#667eea';
            }}
          >
            Continuar sem login
          </a>
        </div>
        
        <div style={{
          marginTop: '40px',
          padding: '24px',
          background: '#f8f9fa',
          borderRadius: '12px',
          textAlign: 'left'
        }}>
          <h3 style={{ 
            fontSize: '18px', 
            marginBottom: '16px',
            color: '#333'
          }}>
            ✨ Como funciona:
          </h3>
          <ul style={{ 
            listStyle: 'none', 
            padding: 0,
            margin: 0,
            color: '#666',
            fontSize: '14px',
            lineHeight: '2'
          }}>
            <li>📧 Conecte seu Gmail</li>
            <li>🤖 IA processa suas notas fiscais</li>
            <li>📊 Visualize gastos organizados</li>
            <li>💰 Controle total de suas finanças</li>
          </ul>
        </div>
      </div>
    </div>
  );
}