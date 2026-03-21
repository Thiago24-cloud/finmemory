import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { CalculadoraEconomia } from '../components/CalculadoraEconomia';

export default function CalculadoraPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-md mx-auto px-5 py-6 pb-28">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <CalculadoraEconomia />
      </div>
      <BottomNav />
    </div>
  );
}
