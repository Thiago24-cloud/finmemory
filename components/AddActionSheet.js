'use client';

import { useRouter } from 'next/router';
import { Camera, PenLine, MapPin } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/Sheet';

const actions = [
  {
    icon: Camera,
    label: 'Escanear Nota',
    desc: 'Tire uma foto e a IA extrai tudo',
    path: '/add-receipt',
    color: 'bg-primary/10 text-primary',
  },
  {
    icon: PenLine,
    label: 'Gasto Manual',
    desc: 'Digite os dados da compra',
    path: '/manual-entry',
    color: 'bg-warning/10 text-warning',
  },
  {
    icon: MapPin,
    label: 'Compartilhar Preço',
    desc: 'Ajude a comunidade com um preço',
    path: '/share-price',
    color: 'bg-accent/10 text-accent',
  },
];

export function AddActionSheet({ open, onOpenChange }) {
  const router = useRouter();

  const handleAction = (path) => {
    onOpenChange(false);
    router.push(path);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-10 pt-4">
        <SheetHeader className="mb-5">
          <SheetTitle className="text-base font-bold text-center">
            O que deseja adicionar?
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.path}
                onClick={() => handleAction(action.path)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card card-shadow hover:card-shadow-lg transition-all active:scale-[0.98]"
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${action.color}`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-foreground">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
