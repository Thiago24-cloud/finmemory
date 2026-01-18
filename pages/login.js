import { useRouter } from 'next/router';

export default function Login() {
  const router = useRouter();

  const handleGoogleLogin = () => {
    // Redireciona para a rota de autenticação Google já existente
    window.location.href = '/api/auth/google';
  };

  return (
    <div style={{ maxWidth: 400, margin: '40px auto', padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
      <h2>Permissão para acessar seu Gmail</h2>
      <p>
        Para que o Finmemory funcione corretamente, precisamos de sua autorização para ler seus e-mails do Gmail.
        <br /><br />
        <strong>Por quê?</strong>
        <ul>
          <li>Importar automaticamente suas transações financeiras</li>
          <li>Organizar seus dados de forma segura</li>
        </ul>
        <br />
        Você poderá revogar o acesso a qualquer momento nas configurações da sua conta Google.
      </p>
      <button
        onClick={handleGoogleLogin}
        style={{
          background: '#4285F4',
          color: '#fff',
          border: 'none',
          padding: '12px 24px',
          borderRadius: 4,
          fontSize: 16,
          cursor: 'pointer'
        }}
      >
        Continuar com Google
      </button>
    </div>
  );
}
