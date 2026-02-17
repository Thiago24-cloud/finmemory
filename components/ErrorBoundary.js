import { Component } from 'react';
import Link from 'next/link';

/**
 * Error Boundary para capturar erros no client e evitar tela branca.
 * Mostra uma mensagem amigável e link para voltar ao dashboard.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const err = this.state.error;
      const message = err?.message || (typeof err === 'string' ? err : 'Erro desconhecido');
      return (
        <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-5">
          <div className="max-w-md w-full bg-white rounded-xl shadow-sm p-6 text-center">
            <h1 className="text-lg font-bold text-[#333] mb-2">Algo deu errado</h1>
            <p className="text-[#666] text-sm mb-4">
              Ocorreu um erro inesperado. Tente voltar ao início ou recarregar a página.
            </p>
            {message && (
              <p className="text-left text-xs text-amber-800 bg-amber-50 rounded-lg p-3 mb-4 font-mono break-all" title="Detalhe do erro">
                {message}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                type="button"
                onClick={() => { if (typeof window !== 'undefined') window.location.reload(); }}
                className="inline-flex items-center justify-center gap-2 py-3 px-4 bg-[#2ECC49] text-white font-semibold rounded-xl hover:bg-[#22a83a]"
              >
                Recarregar
              </button>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 py-3 px-4 bg-[#667eea] text-white font-semibold rounded-xl hover:bg-[#5a6fd6]"
              >
                Voltar ao Dashboard
              </Link>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
