import {
  Home,
  Search,
  Package,
  Utensils,
  CalendarCheck,
  Hash,
  ShoppingCart,
  ClipboardList,
  ChefHat,
  Bell,
  History,
  Receipt,
  Truck,
  QrCode,
} from 'lucide-react';

/** Navegação inferior — mesma ordem e rótulos do Skip. */
export const SKIP_NAV_ITEMS = [
  { id: 'ofertas', name: 'Dashboard', Icon: Home },
  { id: 'mapa', name: 'Preços', Icon: Search },
  { id: 'insumos', name: 'Estoque', Icon: Package },
  { id: 'cardapio', name: 'Cardápio', Icon: Utensils },
  { id: 'preparo', name: 'Preparo', Icon: CalendarCheck },
  { id: 'mesas', name: 'Mesas', Icon: Hash },
  { id: 'vendas', name: 'Vendas', Icon: ShoppingCart },
  { id: 'lista', name: 'Lista', Icon: ClipboardList },
  { id: 'cozinha', name: 'Cozinha', Icon: ChefHat },
  { id: 'garcom', name: 'Garçom', Icon: Bell },
  { id: 'historico', name: 'Histórico', Icon: History },
  { id: 'caixa', name: 'Caixa', Icon: Receipt },
  { id: 'entrega', name: 'Entrega', Icon: Truck },
  { id: 'codigos', name: 'Códigos', Icon: QrCode },
];
