// Toucan Learn pixel sky, using the existing FLAME dither and geometry.
export const vertexSource = `#version 300 es
in vec2 position;
void main(){ gl_Position=vec4(position,0.0,1.0); }`;
export const originalFragmentSource = `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform float clock;
uniform float home_view;
uniform sampler2D nebula_noise;
uniform vec3 star_low;
uniform vec3 star_high;
uniform vec3 meteor_tint;
out vec4 outputColour;
const int BAYER[16]=int[](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
// Midnight/slate palette; FLAME's original dither and geometry.
const vec3 PALETTE[9]=vec3[](
 vec3(.024,.035,.051),vec3(.036,.057,.082),vec3(.055,.084,.116),
 vec3(.082,.122,.161),vec3(.122,.176,.216),vec3(.184,.251,.290),
 vec3(.267,.337,.365),vec3(.376,.439,.459),vec3(.537,.584,.592)
);
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 palette_colour(float value,vec2 pixel){
 ivec2 cell=ivec2(mod(pixel,4.0));
 float threshold=(float(BAYER[cell.x+cell.y*4])+0.5)/16.0;
 float level=clamp(value,0.0,1.0)*8.0;
 int index=int(floor(level));
 if(fract(level)>threshold){index=min(index+1,8);}
 return PALETTE[index];
}
vec3 stars(vec2 pixel,float cell_size,float salt,float t,float speed){
 vec2 point=pixel+floor(vec2(t*speed,-t*speed*.35));
 vec2 cell=floor(point/cell_size);
 vec2 local=mod(point,cell_size);
 float seed=hash(cell+salt);
 vec2 position=floor(vec2(hash(cell+salt+31.0),hash(cell+salt+77.0))*(cell_size-6.0))+3.0;
 vec2 distance_to_star=abs(local-position);
 float centre=float(max(distance_to_star.x,distance_to_star.y)<.5);
 float cross_shape=float(min(distance_to_star.x,distance_to_star.y)<.5&&max(distance_to_star.x,distance_to_star.y)<1.5);
 float shape=mix(centre,max(centre,cross_shape*.5),step(.965,seed));
 float twinkle=.76+.24*sin(t*(.30+seed*.35)+seed*45.0);
 vec3 colour=mix(star_low,star_high,seed);
 return colour*shape*twinkle*step(.30,seed);
}
// One brief meteor every fourteen seconds, away from the central wordmark.
vec3 shooting_star(vec2 pixel,vec2 grid,float t){
 float cycle=floor(t/14.0);
 float phase=mod(t,14.0)-6.0;
 if(phase<0.0||phase>1.15){return vec3(0.0);}
 vec2 start=grid*vec2(.62+hash(vec2(cycle,13.0))*.25,.07+hash(vec2(cycle,29.0))*.12);
 vec2 direction=normalize(vec2(-1.0,.42));
 vec2 head=floor(start+direction*phase*grid.x*.25);
 vec2 delta=pixel-head;
 float behind=-dot(delta,direction);
 float across=abs(dot(delta,vec2(-direction.y,direction.x)));
 float tail_length=clamp(grid.x*.10,12.0,30.0);
 float trail=step(0.0,behind)*step(behind,tail_length)*(1.0-smoothstep(.3,1.1,across))*pow(max(0.0,1.0-behind/tail_length),1.6);
 float point=1.0-smoothstep(.3,1.4,length(delta));
 float fade=smoothstep(0.0,.16,phase)*(1.0-smoothstep(.72,1.15,phase));
 return meteor_tint*max(trail*.58,point*.78)*fade;
}
void main(){
 float t=clock;
 vec2 grid=resolution;
 vec2 pixel=vec2(floor(gl_FragCoord.x),floor(resolution.y-gl_FragCoord.y));
 vec2 uv=(pixel+.5)/grid;
 vec2 noise_uv=uv*vec2(grid.x/grid.y,1.0);
 vec2 drift=vec2(t*.0007,-t*.00028);
 float broad=texture(nebula_noise,noise_uv*.61+drift).r;
 float detail=texture(nebula_noise,noise_uv*1.55-drift*.6+vec2(.34,.67)).r;
 float dust=texture(nebula_noise,noise_uv*3.2+drift*.4+vec2(.71,.13)).r;
 float band_axis=uv.y+uv.x*.70-.91;
 float band=exp(-pow(band_axis*3.6,2.0));
 float density=max(0.0,broad*1.05+detail*.43-.47);
 density*=.35+band*1.25;
 density-=smoothstep(.52,.77,dust)*band*.20;
 density+=sin(t*.065)*band*.012;
 vec3 colour=palette_colour(density,pixel);
 colour+=stars(pixel,21.0,4.0,t,.12)*.45;
 colour+=stars(pixel,37.0,91.0,t,.27)*.70;
 float navigation=(1.0-smoothstep(.24,.42,uv.x))*(1.0-smoothstep(.46,.63,uv.y));
 colour*=1.0-navigation*.40;
 if(home_view>.5){
   float shadow=1.0-smoothstep(.09,.24,max(colour.r,max(colour.g,colour.b)));
   float blue=exp(-dot((uv-vec2(.25,.28))*2.0,(uv-vec2(.25,.28))*2.0));
   float teal=exp(-dot((uv-vec2(.8,.72))*2.2,(uv-vec2(.8,.72))*2.2));
   float breathe=.82+.18*sin(t*.045);
   colour+=shadow*breathe*(vec3(.012,.020,.043)*blue+vec3(.004,.027,.023)*teal);
   colour+=shooting_star(pixel,grid,t);
 }
 outputColour=vec4(colour,1.0);
}`;

// Pixel image mode: reference cover framing, brush and radial wave refraction.
export const MAX_PIXEL_RIPPLES = 64;
export const PIXEL_RIPPLE_SPEED = 0.32;
export const PIXEL_RIPPLE_TAIL = 0.08;
export const pixelFragmentSource = originalFragmentSource
  .replace('uniform float home_view;', `uniform float home_view;
uniform sampler2D pixel_sky;
uniform vec2 pixel_size;
uniform float pixel_view;
uniform vec4 brush[12];
uniform vec2 swash[12];
uniform vec3 ink;
uniform vec3 ripples[${MAX_PIXEL_RIPPLES}];
uniform int rippleCount;`)
  .replace('vec2 drift=vec2(t*.0007,-t*.00028);', `
 float brushLight=0.0;
 vec2 warp=vec2(0.0);
 for(int i=0;i<12;i++){
  vec2 delta=(uv-brush[i].xy)*vec2(grid.x/grid.y,1.0);
  float age=brush[i].z;
  float life=max(0.0,1.0-age/1.5)*brush[i].w;
  vec2 direction=normalize(swash[i]+vec2(.0001,0.0));
  float along=dot(delta,direction);
  float across=dot(delta,vec2(-direction.y,direction.x));
  float halo=exp(-(along*along*55.0+across*across*340.0))*life;
  brushLight+=halo*.22;
  warp-=direction*halo*min(length(swash[i])*2.5,.09);
 }
 float ring=0.0;
 vec2 rippleWarp=vec2(0.0);
 for(int i=0;i<${MAX_PIXEL_RIPPLES};i++){
  if(i>=rippleCount){break;}
  vec2 delta=(uv-ripples[i].xy)*vec2(grid.x/grid.y,1.0);
  float age=ripples[i].z;
  vec2 farEdge=max(ripples[i].xy,vec2(1.0)-ripples[i].xy)*vec2(grid.x/grid.y,1.0);
  float reach=length(farEdge);
  float radius=age*${PIXEL_RIPPLE_SPEED};
  float fade=1.0-smoothstep(reach,reach+${PIXEL_RIPPLE_TAIL},radius);
  float wave=exp(-pow((length(delta)-radius)*60.0,2.0))*fade;
  ring+=wave;
  rippleWarp+=normalize(delta+vec2(.0001))*wave*.025;
 }
 vec2 displacement=clamp(warp,vec2(-.10),vec2(.10))+clamp(rippleWarp,vec2(-.06),vec2(.06));
 if(pixel_view>.5){
  // Match the original image's centred cover framing, then refract its pixels
  // with exactly the same brush and radial displacement as the Earth sky.
  vec2 sample_uv=clamp(uv+displacement/vec2(grid.x/grid.y,1.0),0.0,1.0);
  float cover_scale=max(grid.x/pixel_size.x,grid.y/pixel_size.y);
  vec2 visible=grid/(pixel_size*cover_scale);
  sample_uv=(sample_uv-.5)*visible+.5;
  vec3 original=texture(pixel_sky,sample_uv).rgb;
  // Joshua, 17 Oct 2026: match the other skies (refraction only), with no
  // tinted ring or brush paint on top of the image.
  outputColour=vec4(original,1.0);
  return;
 }
 noise_uv+=displacement;
 vec2 drift=vec2(t*.0007,-t*.00028);`);

// Exactly the approved presets: green, the learner sites' Earth palette and Pixel image,
// and FLAME's original purple pixel galaxy (flame_terminal_pixel_galaxy_v1.gdshader), the OG.
export const SKY_PRESETS = [
  {
    "id": "green",
    "palette": [
      [0.025,0.063,0.078], [0.037,0.098,0.110], [0.051,0.137,0.145],
      [0.086,0.192,0.184], [0.141,0.259,0.227], [0.216,0.337,0.271],
      [0.337,0.439,0.329], [0.490,0.561,0.420], [0.690,0.710,0.545]
    ],
    "stars": [[0.40,0.53,0.65], [0.85,0.87,0.81]],
    "meteor": [0.62,0.78,0.86]
  },
  {
    "id": "earth",
    "palette": [
      [0.025,0.18,0.25], [0.04,0.27,0.38], [0.065,0.40,0.49],
      [0.105,0.53,0.56], [0.28,0.61,0.52], [0.49,0.69,0.51],
      [0.69,0.77,0.55], [0.87,0.84,0.64], [0.99,0.94,0.79]
    ],
    "stars": [[0.45,0.70,0.71], [0.99,0.94,0.79]],
    "meteor": [0.80,0.94,0.87]
  },
  {
    "id": "pixel",
    "image": "assets/loading-pixel-sky.png",
    "ink": [
      0.23,
      1,
      0.78
    ]
  },
  {
    "id": "og",
    "palette": [
      [0.016,0.020,0.047], [0.035,0.031,0.090], [0.071,0.047,0.145],
      [0.125,0.067,0.208], [0.208,0.094,0.294], [0.318,0.145,0.396],
      [0.455,0.235,0.510], [0.631,0.369,0.635], [0.796,0.584,0.788]
    ],
    "stars": [[0.45,0.49,0.72], [0.93,0.83,0.92]],
    "meteor": [0.80,0.72,0.92]
  }
];
