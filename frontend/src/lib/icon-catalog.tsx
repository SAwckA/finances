import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Car,
  CreditCard,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  PiggyBank,
  Receipt,
  ShoppingCart,
  Utensils,
  Wallet,
} from "lucide-react";

export type IconOption = {
  value: string;
  label: string;
  icon: LucideIcon;
  featured: boolean;
};

export const ICON_OPTIONS: IconOption[] = [
  { value: "credit-card", label: "Карта", icon: CreditCard, featured: true },
  { value: "wallet", label: "Кошелек", icon: Wallet, featured: true },
  { value: "piggy-bank", label: "Копилка", icon: PiggyBank, featured: true },
  { value: "landmark", label: "Банк", icon: Landmark, featured: true },
  { value: "receipt", label: "Чек", icon: Receipt, featured: false },
  { value: "shopping-cart", label: "Покупки", icon: ShoppingCart, featured: false },
  { value: "utensils", label: "Еда", icon: Utensils, featured: false },
  { value: "car", label: "Транспорт", icon: Car, featured: false },
  { value: "home", label: "Дом", icon: Home, featured: false },
  { value: "heart-pulse", label: "Здоровье", icon: HeartPulse, featured: false },
  { value: "graduation-cap", label: "Обучение", icon: GraduationCap, featured: false },
  { value: "briefcase", label: "Работа", icon: Briefcase, featured: false },
  { value: "gift", label: "Подарки", icon: Gift, featured: false },
];

export function getIconOption(iconValue: string): IconOption {
  const found = ICON_OPTIONS.find((option) => option.value === iconValue);
  return found ?? ICON_OPTIONS[0];
}
