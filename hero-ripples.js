// Geometry-based lifetime: a ring is retired only after its trailing edge has
// passed the farthest corner. New clicks never evict existing visible rings.
export const RIPPLE_SPEED = 105;
export const RIPPLE_TRAIL = 15;
export function rippleReach(ripple, width, height) {
  return Math.hypot(Math.max(ripple.x, 1 - ripple.x) * width, Math.max(ripple.y, 1 - ripple.y) * height);
}
export class RippleField {
  active = [];
  add(x, y, now) {
    this.active.push({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)), born: now });
  }
  sample(now, width, height) {
    this.active = this.active.filter(ring => (now - ring.born) * RIPPLE_SPEED - RIPPLE_TRAIL <= rippleReach(ring, width, height));
    return this.active.map(ring => ({
      x: ring.x * width, y: ring.y * height,
      radius: Math.max(0, now - ring.born) * RIPPLE_SPEED,
    }));
  }
}
