// In-memory cache so revisiting a city is instant and images aren't re-generated.
const exploreCache = new Map();
const imageCache = new Map();
export function getCachedExplore(tripId, city) { return exploreCache.get(`${tripId}|${city}`); }
export function setCachedExplore(tripId, city, data) { exploreCache.set(`${tripId}|${city}`, data); }
export function getCachedImage(tripId, city) { return imageCache.get(`${tripId}|${city}`); }
export function setCachedImage(tripId, city, url) { imageCache.set(`${tripId}|${city}`, url); }
