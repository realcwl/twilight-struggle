// Miller cylindrical projection, cut in the Pacific so no participating landmass straddles the edge.

const RAD = Math.PI / 180;

export const millerY = (latDeg: number): number => 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * latDeg * RAD));
export const millerLat = (y: number): number => (2.5 * (Math.atan(Math.exp(0.8 * y)) - Math.PI / 4)) / RAD;

export type Projection = {
  lon0: number;
  latSouth: number;
  latNorth: number;
  yNorth: number;
  ySouth: number;
};

/** The north edge follows from the south edge and the texture aspect, so texels stay square. */
export function makeProjection(lon0: number, latSouth: number, aspect: number): Projection {
  const ySouth = millerY(latSouth);
  const yNorth = ySouth + (2 * Math.PI) / aspect;
  return { lon0, latSouth, latNorth: millerLat(yNorth), yNorth, ySouth };
}

/** Longitude to pixel x. Not wrapped: longitudes west of lon0 come out negative. */
export const lonToX = (p: Projection, lon: number, width: number): number => ((lon - p.lon0) / 360) * width;
export const latToY = (p: Projection, lat: number, height: number): number =>
  ((p.yNorth - millerY(lat)) / (p.yNorth - p.ySouth)) * height;
export const xToLon = (p: Projection, x: number, width: number): number => p.lon0 + (x / width) * 360;
export const yToLat = (p: Projection, y: number, height: number): number =>
  millerLat(p.yNorth - (y / height) * (p.yNorth - p.ySouth));
