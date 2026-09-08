import React from "react";
import {
  Baby,
  Building2,
  Camera,
  Car,
  Droplets,
  Flame,
  Hammer,
  Heart,
  Home,
  Laptop,
  Leaf,
  Music,
  Paintbrush,
  Plug,
  Scissors,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Truck,
  Wifi,
  Wind,
  Wrench,
  Zap,
  Dog,
  type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICONS: { id: string; label: string; Icon: LucideIcon }[] = [
  { id: "wrench", label: "Repair", Icon: Wrench },
  { id: "zap", label: "Electrical", Icon: Zap },
  { id: "droplets", label: "Plumbing", Icon: Droplets },
  { id: "wind", label: "AC / Air", Icon: Wind },
  { id: "sparkles", label: "Cleaning", Icon: Sparkles },
  { id: "home", label: "Home", Icon: Home },
  { id: "car", label: "Vehicle", Icon: Car },
  { id: "laptop", label: "Computer", Icon: Laptop },
  { id: "smartphone", label: "Phone", Icon: Smartphone },
  { id: "paintbrush", label: "Paint", Icon: Paintbrush },
  { id: "hammer", label: "Carpentry", Icon: Hammer },
  { id: "plug", label: "Appliance", Icon: Plug },
  { id: "flame", label: "Gas / Heat", Icon: Flame },
  { id: "leaf", label: "Garden", Icon: Leaf },
  { id: "scissors", label: "Salon", Icon: Scissors },
  { id: "heart", label: "Health", Icon: Heart },
  { id: "baby", label: "Childcare", Icon: Baby },
  { id: "dog", label: "Pets", Icon: Dog },
  { id: "shopping-bag", label: "Shopping", Icon: ShoppingBag },
  { id: "building-2", label: "Office", Icon: Building2 },
  { id: "truck", label: "Moving", Icon: Truck },
  { id: "wifi", label: "Internet", Icon: Wifi },
  { id: "camera", label: "Photo", Icon: Camera },
  { id: "music", label: "Events", Icon: Music },
];

const MAP = Object.fromEntries(CATEGORY_ICONS.map((i) => [i.id, i.Icon]));

export default function CategoryIcon({
  icon,
  className = "w-7 h-7",
}: {
  icon?: string;
  className?: string;
}) {
  const value = String(icon || "wrench").trim();
  if (value.startsWith("http") || value.startsWith("/") || value.startsWith("data:")) {
    return <img src={value} alt="" className={`${className} object-contain`} />;
  }
  const Icon = MAP[value.toLowerCase()];
  if (Icon) return <Icon className={className} />;
  if (value.length <= 4) return <span className="text-2xl leading-none">{value}</span>;
  return <Wrench className={className} />;
}
