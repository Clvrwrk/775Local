const CITY: Record<string, string> = {
  reno: "/media/reno.jpg",
  sparks: "/media/reno.jpg",
  "carson-city": "/media/carson.jpg",
  "incline-village": "/media/tahoe.jpg",
  "stateline": "/media/tahoe.jpg",
  "south-lake-tahoe": "/media/tahoe.jpg",
  "minden": "/media/carson.jpg",
  "gardnerville": "/media/carson.jpg",
  "fernley": "/media/washoe.jpg",
  "fallon": "/media/washoe.jpg",
  "winnemucca": "/media/elko.jpg",
  elko: "/media/elko.jpg",
  ely: "/media/elko.jpg",
  "west-wendover": "/media/elko.jpg",
};

const FALLBACK = [
  "/media/washoe.jpg",
  "/media/tahoe.jpg",
  "/media/shop.jpg",
  "/media/sierra.jpg",
  "/media/carson.jpg",
];

export function listingCover(citySlug: string, id: number) {
  return CITY[citySlug] ?? FALLBACK[Math.abs(id) % FALLBACK.length];
}
