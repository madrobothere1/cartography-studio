export type CartoView = Readonly<{
  /** Column-major matrix from map space (x east, z south) to clip space. */
  mvp: number[];
  /** Clip-space units per map unit, vertically. */
  scale: number;
}>;

/** Share of the frame's short side that the map fills at map size 1. */
const FILL = 0.84;

/** Flat top-down view: the map square sits centred in the frame, north up. */
export function getCartoView(aspect: number, fit: number): CartoView {
  const scale = fit * Math.min(1, aspect) * FILL;
  const mvp = [scale / aspect, 0, 0, 0, 0, 0, 0, 0, 0, -scale, 0, 0, 0, 0, 0, 1];
  return { mvp, scale };
}
