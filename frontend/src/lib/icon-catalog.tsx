import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BookOpen,
  Briefcase,
  Camera,
  Car,
  Coffee,
  CreditCard,
  Dumbbell,
  FileText,
  Fuel,
  Gift,
  Gamepad2,
  GraduationCap,
  Heart,
  HeartPulse,
  Home,
  Landmark,
  Music,
  PawPrint,
  PiggyBank,
  Plane,
  Receipt,
  ShoppingBag,
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
  { value: "banknote", label: "Наличные", icon: Banknote, featured: true },
  { value: "receipt", label: "Чек", icon: Receipt, featured: false },
  { value: "file-text", label: "Документы", icon: FileText, featured: false },
  { value: "shopping-bag", label: "Шопинг", icon: ShoppingBag, featured: false },
  { value: "shopping-cart", label: "Покупки", icon: ShoppingCart, featured: false },
  { value: "utensils", label: "Еда", icon: Utensils, featured: false },
  { value: "coffee", label: "Кафе", icon: Coffee, featured: false },
  { value: "car", label: "Транспорт", icon: Car, featured: false },
  { value: "fuel", label: "Топливо", icon: Fuel, featured: false },
  { value: "home", label: "Дом", icon: Home, featured: false },
  { value: "plane", label: "Путешествия", icon: Plane, featured: false },
  { value: "heart", label: "Здоровье", icon: Heart, featured: false },
  { value: "heart-pulse", label: "Здоровье", icon: HeartPulse, featured: false },
  { value: "graduation-cap", label: "Обучение", icon: GraduationCap, featured: false },
  { value: "book-open", label: "Книги", icon: BookOpen, featured: false },
  { value: "music", label: "Музыка", icon: Music, featured: false },
  { value: "dumbbell", label: "Спорт", icon: Dumbbell, featured: false },
  { value: "paw-print", label: "Питомцы", icon: PawPrint, featured: false },
  { value: "camera", label: "Фото", icon: Camera, featured: false },
  { value: "gamepad-2", label: "Игры", icon: Gamepad2, featured: false },
  { value: "briefcase", label: "Работа", icon: Briefcase, featured: false },
  { value: "gift", label: "Подарки", icon: Gift, featured: false },
];

export function getIconOption(iconValue: string): IconOption {
  const found = ICON_OPTIONS.find((option) => option.value === iconValue);
  return found ?? ICON_OPTIONS[0];
}
