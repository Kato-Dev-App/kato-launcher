export const INSTANCE_BACKGROUNDS = [
  "/instances/bosque.jpg",
  "/instances/desierto.jpg",
  "/instances/montana.jpg",
  "/instances/pantano.jpg",
];

export function getInstanceBackground(index: number): string {
  return INSTANCE_BACKGROUNDS[index % INSTANCE_BACKGROUNDS.length];
}
