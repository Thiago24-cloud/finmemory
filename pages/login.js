import { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * /login redireciona para a página inicial (/) que já tem logo + Google.
 */
export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-primary p-5">
      <div className="bg-white rounded-[20px] p-10 text-center shadow-card-lovable">
        <div className="text-4xl mb-4 animate-pulse">⏳</div>
        <p className="text-[#666]">Redirecionando...</p>
      </div>
    </div>
  );
}
