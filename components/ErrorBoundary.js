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
      return (
        <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-5">
          <div className="max-w-md w-full bg-white rounded-xl shadow-sm p-6 text-center">
            <h1 className="text-lg font-bold text-[#333] mb-2">Algo deu errado</h1>
            <p className="text-[#666] text-sm mb-6">
              Ocorreu um erro inesperado. Tente voltar ao início ou recarregar a página.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 py-3 px-4 bg-[#667eea] text-white font-semibold rounded-xl hover:bg-[#5a6fd6]"
            >
              Voltar ao Dashboard
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
