import type { AvatarVariant } from "../../domain/models";

export interface AvatarPreset {
  id: AvatarVariant;
  label: string;
  preview: string;
  image: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "creeper", label: "Creeper", preview: "Cr", image: "/avatars/creeper.jpg" },
  { id: "zombie", label: "Zombie", preview: "Zo", image: "/avatars/zombie.jpg" },
  { id: "enderman", label: "Enderman", preview: "En", image: "/avatars/enderman.png" },
  { id: "esqueleto", label: "Esqueleto", preview: "Es", image: "/avatars/esqueleto.jpg" },
  { id: "cerdo", label: "Cerdo", preview: "Ce", image: "/avatars/cerdo.jpg" },
  { id: "vaca", label: "Vaca", preview: "Va", image: "/avatars/vaca.jpg" },
  { id: "pollo", label: "Pollo", preview: "Po", image: "/avatars/pollo.jpg" },
];

export function getAvatarImage(variant?: string): string {
  const key = variant || "creeper";
  const found = AVATAR_PRESETS.find((p) => p.id === key);
  if (found) return found.image;
  if (key === "ender" || key === "enderman") return "/avatars/enderman.png";
  if (key === "steve") return "/avatars/steve.png";
  if (key === "alex") return "/avatars/alex.png";
  return `/avatars/${key}.jpg`;
}
