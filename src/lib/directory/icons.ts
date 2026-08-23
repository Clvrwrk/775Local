import {
  Car,
  DoorOpen,
  Hammer,
  House,
  MapPin,
  PawPrint,
  Smile,
  Thermometer,
  Utensils,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  "door-open": DoorOpen,
  thermometer: Thermometer,
  wrench: Wrench,
  zap: Zap,
  car: Car,
  utensils: Utensils,
  smile: Smile,
  hammer: Hammer,
  house: House,
  "paw-print": PawPrint,
  "map-pin": MapPin,
};

export function categoryIcon(key: string): LucideIcon {
  return MAP[key] ?? MapPin;
}
