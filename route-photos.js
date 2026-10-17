(function () {
  'use strict';

  // Keep each photo's file, intrinsic dimensions and alt text together.
  const ROUTE_PHOTOS = {
    "children": [
      { "file": "assets/photos/route-children-1.jpg", "width": 800, "height": 1200, "alt": "A smiling child holding up a colourful puzzle" },
      { "file": "assets/photos/route-children-2.jpg", "width": 800, "height": 1067, "alt": "A child drawing a house with coloured pencils" },
      { "file": "assets/photos/route-children-3.jpg", "width": 800, "height": 1199, "alt": "A young boy drawing at a white table" }
    ],
    "adults": [
      { "file": "assets/photos/route-adults-1.jpg", "width": 800, "height": 1200, "alt": "A man with a coffee working on his laptop in a café" },
      { "file": "assets/photos/route-adults-2.jpg", "width": 800, "height": 1200, "alt": "Two people working through notes together at a table" },
      { "file": "assets/photos/route-adults-3.jpg", "width": 800, "height": 1199, "alt": "A woman writing in a notebook at a desk by a window" }
    ]
  };

  // Runs as a classic script straight after the route cards, before their lazy
  // images are laid out, so the default photos are not downloaded as well.
  // Screenshot overrides affect only their own card; invalid values stay random.
  const params = new URLSearchParams(window.location.search);
  for (const [audience, query, variant] of [
    ['children', 'kids', 'family'],
    ['adults', 'adults', 'adult']
  ]) {
    const image = document.querySelector(`.audience-route-card--${variant} .audience-route-media img`);
    if (!image) continue;
    const photos = ROUTE_PHOTOS[audience];
    const requested = params.get(query);
    const index = /^[123]$/.test(requested) ? Number(requested) - 1 : Math.floor(Math.random() * photos.length);
    const photo = photos[index];
    image.width = photo.width;
    image.height = photo.height;
    image.alt = photo.alt;
    image.dataset.routePhoto = `${audience}-${index + 1}`;
    if (image.getAttribute('src') !== photo.file) image.src = photo.file;
  }
})();
