import {
  UtensilsCrossed,
  Plane,
  Home as HomeIcon,
  ShoppingBag,
  Zap,
  Film,
  Heart,
  GraduationCap,
  RefreshCw,
  ShoppingCart,
  Car,
  TrendingUp,
  Package,
  Wifi,
  Smartphone,
  Shield,
  Baby,
  Dumbbell,
  PiggyBank,
  Gift,
  CircleDollarSign,
  CreditCard,
  Landmark,
  Banknote,
  Wallet,
  Globe,
  QrCode,
  Building2,
  Lock,
  CalendarCheck,
} from "lucide-react";

const ICON_MAP = {
  Food: UtensilsCrossed,
  Travel: Plane,
  Rent: HomeIcon,
  Shopping: ShoppingBag,
  Bills: Zap,
  Entertainment: Film,
  Health: Heart,
  Education: GraduationCap,
  Subscriptions: RefreshCw,
  Groceries: ShoppingCart,
  Transport: Car,
  Investments: TrendingUp,
  Others: Package,
  Utilities: Zap,
  Insurance: Shield,
  Kids: Baby,
  Fitness: Dumbbell,
  Savings: PiggyBank,
  Gifts: Gift,
  EMI: CalendarCheck,
  Loan: CircleDollarSign,
  Internet: Wifi,
  Mobile: Smartphone,
  Dining: UtensilsCrossed,
  "Eating Out": UtensilsCrossed,
};

const PAYMENT_ICON_MAP = {
  Cash: Banknote,
  "Credit Card": CreditCard,
  "Debit Card": CreditCard,
  UPI: QrCode,
  "Net Banking": Landmark,
  Wallet: Wallet,
  "Google Pay": Globe,
  "Apple Pay": Smartphone,
  "Bank Transfer": Building2,
};

export function CategoryIcon({ name, size = 20, color = "#fff" }) {
  const Icon = ICON_MAP[name] || Package;
  return <Icon size={size} color={color} strokeWidth={1.8} />;
}

export function PaymentIcon({ name, size = 16, color = "#fff" }) {
  const Icon = PAYMENT_ICON_MAP[name] || CreditCard;
  return <Icon size={size} color={color} strokeWidth={1.8} />;
}

export function getCategoryIcon(name) {
  return ICON_MAP[name] || Package;
}
