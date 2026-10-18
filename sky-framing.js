// Both skies use the opening's cell grid and centred image cover calculation.
export const SKY_CELL_SIZE = 2.5;

export function getSkyFrame(cssWidth, cssHeight, imageWidth = 0, imageHeight = 0, coverWidth = cssWidth) {
  const cells = size => Math.max(1, Math.round(size / SKY_CELL_SIZE));
  const width = cells(cssWidth);
  const height = cells(cssHeight);
  return {
    width,
    height,
    cssHeight,
    cellSize: SKY_CELL_SIZE,
    // A wider CTA repeats the opening's image instead of enlarging its art.
    coverScale: imageWidth && imageHeight
      ? Math.max(cells(coverWidth) / imageWidth, height / imageHeight)
      : 0,
  };
}
