import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

// Mapeamento de erros OAuth do Google para mensagens amigáveis
const ERROR_MESSAGES = {
  // Erros do NextAuth
  OAuthSignin: {
    title: 'Erro ao Iniciar Login',
    message: 'Não foi possível iniciar o processo de login com o Google.',
    suggestion: 'Tente novamente. Se o problema persistir, limpe os cookies do navegador.'
  },
  OAuthCallback: {
    title: 'Erro no Callback',
    message: 'Houve um problema ao processar a resposta do Google.',
    suggestion: 'Tente fazer login novamente.'
  },
  OAuthCreateAccount: {
    title: 'Erro ao Criar Conta',
    message: 'Não foi possível criar sua conta no sistema.',
    suggestion: 'Tente novamente ou entre em contato com o suporte.'
  },
  OAuthAccountNotLinked: {
    title: 'Conta Não Vinculada',
    message: 'Este email já está associado a outra forma de login.',
    suggestion: 'Use o método de login original para esta conta.'
  },
  
  // Erros específicos do Google OAuth 2.0
  admin_policy_enforced: {
    title: 'Acesso Bloqueado pelo Administrador',
    message: 'Sua organização (Google Workspace) bloqueou o acesso a este aplicativo.',
    suggestion: 'Entre em contato com o administrador de TI da sua empresa para solicitar acesso.'
  },
  disallowed_useragent: {
    title: 'Navegador Não Suportado',
    message: 'O navegador atual não é compatível com o login do Google.',
    suggestion: 'Use um navegador padrão como Chrome, Firefox, Safari ou Edge.'
  },
  org_internal: {
    title: 'Aplicativo Interno',
    message: 'Este aplicativo está configurado apenas para usuários de uma organização específica.',
    suggestion: 'Use uma conta Google que pertença à organização autorizada.'
  },
  invalid_client: {
    title: 'Configuração Inválida',
    message: 'As credenciais do aplicativo estão incorretas.',
    suggestion: 'Este é um erro de configuração. Entre em contato com o suporte.'
  },
  deleted_client: {
    title: 'Aplicativo Removido',
    message: 'O aplicativo foi excluído do Google Cloud.',
    suggestion: 'Este é um erro de configuração. Entre em contato com o suporte.'
  },
  invalid_grant: {
    title: 'Sessão Expirada',
    message: 'Seu token de acesso expirou ou foi revogado.',
    suggestion: 'Faça login novamente para renovar sua sessão.'
  },
  redirect_uri_mismatch: {
    title: 'Erro de Redirecionamento',
    message: 'A URL de retorno não está autorizada.',
    suggestion: 'Este é um erro de configuração. Entre em contato com o suporte.'
  },
  invalid_request: {
    title: 'Requisição Inválida',
    message: 'A solicitação de login não está formatada corretamente.',
    suggestion: 'Tente limpar o cache do navegador e fazer login novamente.'
  },
  Configuration: {
    title: 'Erro de Configuração do Login',
    message: 'O login com Google está mal configurado (credenciais OAuth ou URL do app).',
    suggestion: 'Limpe os cookies deste site (finmemory-836908221936.southamerica-east1.run.app), feche e abra o navegador e tente de novo. Se continuar: verifique no Google Cloud as Credenciais OAuth e a variável NEXTAUTH_URL no Cloud Run.'
  },
  access_denied: {
    title: 'Acesso Negado',
    message: 'Você recusou as permissões solicitadas pelo aplicativo.',
    suggestion: 'Para usar o FinMemory, é necessário conceder acesso ao seu Gmail.'
  },
  
  // Erro padrão
  default: {
    title: 'Erro de Autenticação',
    message: 'Ocorreu um erro durante o processo de login.',
    suggestion: 'Tente novamente. Se o problema persistir, limpe os cookies e tente novamente.'
  }
};

export default function AuthError() {
  const router = useRouter();
  const [errorInfo, setErrorInfo] = useState(ERROR_MESSAGES.default);
  const [errorCode, setErrorCode] = useState('');

  useEffect(() => {
    // NextAuth passa o erro via query parameter
    const { error } = router.query;
    
    if (error) {
      setErrorCode(error);
      // Procura o erro no mapeamento, ou usa o padrão
      const info = ERROR_MESSAGES[error] || ERROR_MESSAGES.default;
      setErrorInfo(info);
    }
  }, [router.query]);

  const handleTryAgain = () => {
    // Limpa qualquer estado de erro e redireciona para home
    router.push('/');
  };

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: 'linear-gradient(135deg, #2ECC49 0%, #22a83a 100%)'
    }}>
      <div style={{
        background: 'white',
        padding: '48px 40px',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        textAlign: 'center',
        maxWidth: '500px',
        width: '100%'
      }}>
        {/* Ícone de erro */}
        <div style={{ 
          fontSize: '64px', 
          marginBottom: '24px'
        }}>
          ⚠️
        </div>

        {/* Título do erro */}
        <h1 style={{ 
          fontSize: '28px', 
          marginBottom: '16px',
          color: '#e74c3c',
          fontWeight: 'bold'
        }}>
          {errorInfo.title}
        </h1>

        {/* Mensagem do erro */}
        <p style={{ 
          fontSize: '16px', 
          color: '#666', 
          marginBottom: '16px',
          lineHeight: '1.6'
        }}>
          {errorInfo.message}
        </p>

        {/* Sugestão */}
        <div style={{
          background: '#f8f9fa',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '32px'
        }}>
          <p style={{ 
            fontSize: '14px', 
            color: '#495057',
            margin: 0
          }}>
            <strong>💡 Sugestão:</strong> {errorInfo.suggestion}
          </p>
        </div>

        {/* Botões de ação */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <button 
            onClick={handleTryAgain}
            style={{ 
              padding: '16px 40px',
              background: 'linear-gradient(135deg, #2ECC49, #22a83a)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 4px 12px rgba(52, 168, 83, 0.3)'
            }}
          >
            🔄 Tentar Novamente
          </button>
          
          <button 
            onClick={handleGoToDashboard}
            style={{ 
              padding: '14px 40px',
              background: 'transparent',
              color: '#2ECC49',
              border: '2px solid #2ECC49',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            📊 Ir para Dashboard
          </button>
        </div>

        {/* Código do erro (para debug) */}
        {errorCode && (
          <p style={{ 
            marginTop: '24px',
            fontSize: '12px', 
            color: '#adb5bd'
          }}>
            Código do erro: <code style={{ 
              background: '#f1f3f5', 
              padding: '2px 6px', 
              borderRadius: '4px' 
            }}>{errorCode}</code>
          </p>
        )}

        {/* Link para suporte */}
        <div style={{ marginTop: '24px' }}>
          <p style={{ fontSize: '13px', color: '#868e96' }}>
            Problemas persistentes? Entre em contato:{' '}
            <a 
              href="mailto:suporte@finmemory.app" 
              style={{ color: '#2ECC49', textDecoration: 'none' }}
            >
              suporte@finmemory.app
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
