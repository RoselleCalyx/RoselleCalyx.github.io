/* =====================================================================
   Planet globe: a slowly turning planet in WebGL.
   One fragment shader ray-casts the sphere and paints it from real
   global maps (Solar System Scope, CC BY 4.0, from NASA data), lit in
   linear light:
   - Earth: day map, city lights on the night side, drifting clouds that
     cast shadows, terrain relief from a normal map, sun glint only on the
     oceans, and an atmosphere that is blue by day and orange at twilight
     (after the three.js "TSL Earth" example);
   - the Moon and Mercury: Lommel–Seeliger shading (the flat "full moon"
     look of airless dust) with relief taken from the map;
   - Venus, Mars and the giants: Minnaert limb darkening and thin hazes;
   - Saturn: real ring structure, shadows both ways.
   Until a map arrives the old procedural surface is shown, then it fades
   over. Moons orbit in the equatorial plane and pass in front and behind.
   PlanetGlobe.create(canvas) -> { show(id), moons(id), start(), stop() } or null
   ===================================================================== */
(function () {
  const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform int uKind; uniform float uR;
uniform vec3 uBX; uniform vec3 uBY; uniform vec3 uBZ; uniform vec3 uL; uniform vec3 uAtm;
uniform vec4 uMoon[4]; uniform vec3 uMoonCol[4]; uniform int uMoons; uniform int uRing;
uniform sampler2D uMap; uniform sampler2D uNight; uniform sampler2D uClouds; uniform sampler2D uOcean;
uniform sampler2D uNormal; uniform sampler2D uRingTex; uniform sampler2D uMoonTex;
uniform float uTex; uniform float uRingOn; uniform float uMoonTexOn;

const float PI = 3.1415927, TAU = 6.2831853;
const vec3 SUN = vec3(1.0, 0.985, 0.96);
const vec3 SKY_DAY = vec3(0.072, 0.453, 1.0);     // #4db2ff in linear light
const vec3 SKY_DUSK = vec3(0.511, 0.064, 0.002);  // #bc490b

float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
float worley(vec3 p) {
  vec3 i = floor(p), f = fract(p); float d = 1.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = vec3(hash(i + g), hash(i + g + 19.1), hash(i + g + 47.3));
    vec3 r = g + o - f; d = min(d, dot(r, r));
  }
  return sqrt(d);
}
float crater(vec3 p, float s) {
  float d = worley(p * s);
  return 1.0 - 0.32 * (1.0 - smoothstep(0.12, 0.3, d)) + 0.22 * smoothstep(0.28, 0.33, d) * (1.0 - smoothstep(0.33, 0.42, d));
}

/* ---------- Saturn's rings (radii of Saturn) ---------- */
float ringProc(float r) {
  if (r < 1.24 || r > 2.28) return 0.0;
  float a = r < 1.53 ? 0.16 : r < 1.95 ? 0.86 : r < 2.03 ? 0.06 : 0.6;
  if (abs(r - 2.215) < 0.008) a *= 0.15;
  return a * (0.72 + 0.28 * noise(vec3(r * 140.0, 0.0, 0.0)));
}
vec4 ringSample(float r) {                         // the map spans 1.168 – 2.338 radii
  float u = (r - 1.168) / 1.17;
  vec4 s = texture2D(uRingTex, vec2(clamp(u, 0.0, 1.0), 0.5));
  return s * step(0.0, u) * step(u, 1.0);
}
float ringAlpha(float r) { return uRingOn > 0.5 ? ringSample(r).a : ringProc(r); }
vec3 ringCol(float r) {
  if (uRingOn > 0.5) {
    float l = dot(ringSample(r).rgb, vec3(0.3, 0.5, 0.2));
    return mix(vec3(0.5, 0.46, 0.42), vec3(1.0, 0.93, 0.8), smoothstep(0.18, 0.52, l));
  }
  float n = noise(vec3(r * 55.0, 1.0, 0.0));
  return r < 1.53 ? vec3(0.62, 0.56, 0.48) : mix(vec3(0.78, 0.70, 0.56), vec3(0.97, 0.90, 0.76), n);
}
float faintRing(float r) { return 0.32 * (1.0 - smoothstep(0.0, 0.012, abs(r - 1.95))) + 0.18 * (1.0 - smoothstep(0.0, 0.01, abs(r - 2.06))); }

/* ---------- maps ---------- */
// p is a unit vector in the body's frame (y = north pole); east longitude grows counter-clockwise seen from the north
vec2 equi(vec3 p) { return vec2(atan(-p.z, p.x) / TAU + 0.5, 0.5 - asin(clamp(p.y, -1.0, 1.0)) / PI); }
// two candidate longitudes with seams on opposite sides; keep the smooth one so mipmapping never draws a seam (Tarini)
vec2 seam(vec2 uv) {
#ifdef DERIV
  float a = fract(uv.x), b = fract(uv.x + 0.5) - 0.5;
  uv.x = fwidth(a) < fwidth(b) - 0.0001 ? a : b;
#endif
  return uv;
}
vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
float luma(vec3 c) { return dot(c, vec3(0.3, 0.55, 0.15)); }
vec3 east(vec3 p) { return normalize(vec3(p.z, 0.0, -p.x) + vec3(1e-5, 0.0, 0.0)); }
vec3 toView(vec3 n) { return n.x * uBX + n.y * uBY + n.z * uBZ; }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 display(vec3 x) { return pow(aces(x), vec3(1.0 / 2.2)); }

// relief from the brightness of a map, for worlds without a height map
vec3 reliefFrom(sampler2D s, vec2 uv, vec3 pb, float k) {
  vec2 d = vec2(1.5 / 2048.0, 1.5 / 1024.0);
  float h0 = luma(texture2D(s, uv).rgb), hx = luma(texture2D(s, uv + vec2(d.x, 0.0)).rgb), hy = luma(texture2D(s, uv + vec2(0.0, d.y)).rgb);
  vec3 e = east(pb), n = cross(pb, e);
  return normalize(pb - (e * (hx - h0) - n * (hy - h0)) * k);
}

vec3 earth(vec3 N, vec3 pb, float t) {
  vec2 uv = equi(pb), su = seam(uv);
  float ocean = smoothstep(0.3, 0.7, texture2D(uOcean, su).r);
  vec3 day = lin(texture2D(uMap, su).rgb);
  day = mix(day, day * vec3(0.5, 0.62, 0.78), ocean);   // open ocean is darker than the map suggests
  vec3 e = east(pb), n = cross(pb, e);
  vec3 nm = texture2D(uNormal, su).rgb * 2.0 - 1.0;
  vec3 Nn = toView(normalize(pb + (e * nm.x + n * nm.y) * 1.4 * (1.0 - ocean)));
  // clouds drift slowly east; their shadows are the same map nudged toward the sun
  vec2 cuv = vec2(uv.x + t * 0.0012, uv.y);
  float cl = smoothstep(0.1, 0.92, texture2D(uClouds, seam(cuv)).r);
  vec3 Lb = vec3(dot(uL, uBX), dot(uL, uBY), dot(uL, uBZ));
  vec2 so = vec2(dot(Lb, e) / max(length(pb.xz), 0.08) / TAU, -dot(Lb, n) / PI) * 0.01;
  float cs = smoothstep(0.1, 0.92, texture2D(uClouds, seam(cuv + so)).r);

  float dg = dot(N, uL), dn = dot(Nn, uL);
  float dayStr = smoothstep(-0.25, 0.5, dg);
  vec3 c = day * (1.0 - 0.6 * cs * (1.0 - cl)) * max(dn, 0.0) * smoothstep(-0.05, 0.12, dg);
  // the sun glints off water, never off land or cloud
  float nh = max(dot(N, normalize(uL + vec3(0.0, 0.0, 1.0))), 0.0);
  c += SUN * (pow(nh, 300.0) * 0.9 + pow(nh, 40.0) * 0.12 + pow(nh, 8.0) * 0.02) * ocean * (1.0 - cl) * smoothstep(0.0, 0.2, dg);
  // clouds catch the light a little past the terminator
  float cd = smoothstep(-0.1, 0.35, dg) * (0.25 + 0.75 * max(dg, 0.0));
  c = mix(c, vec3(0.92) * cd, cl);
  // city lights, dimmed by cloud
  c += lin(texture2D(uNight, su).rgb) * vec3(3.2, 2.4, 1.5) * (1.0 - dayStr) * (1.0 - 0.85 * cl);
  // atmosphere: blue by day, orange at twilight, strongest toward the limb
  float fres = 1.0 - max(N.z, 0.0);
  vec3 sky = mix(SKY_DUSK, SKY_DAY, smoothstep(-0.12, 0.5, dg));
  c += SKY_DAY * 0.02 * max(dg, 0.0);
  return mix(c, sky, clamp(smoothstep(-0.18, 1.0, dg) * fres * fres, 0.0, 1.0));
}

vec3 airless(sampler2D s, vec3 N, vec3 pb, float relief, float gain) {
  vec2 su = seam(equi(pb));
  vec3 alb = lin(texture2D(s, su).rgb) * gain;
  vec3 Nn = toView(reliefFrom(s, su, pb, relief));
  float mu0 = max(dot(Nn, uL), 0.0), mu = max(N.z, 0.02);
  float ls = 2.0 * mu0 / (mu0 + mu);                 // Lommel–Seeliger: dust stays bright right to the limb
  return alb * mix(mu0, ls, 0.72) * smoothstep(-0.02, 0.06, dot(N, uL)) * SUN;
}

vec3 giant(vec3 N, vec3 pb, float k, float drift, float t) {
  vec2 uv = equi(pb); uv.x += drift * t;
  vec3 alb = lin(texture2D(uMap, seam(uv)).rgb);
  float mu0 = max(dot(N, uL), 0.0), mu = max(N.z, 0.06);
  return alb * pow(mu0, k) * pow(mu, k - 1.0) * SUN;  // Minnaert limb darkening
}

/* ---------- the old procedural surfaces: shown until the maps arrive ---------- */
vec3 surface(vec3 p, float t, out float spec, out vec3 emit) {
  spec = 0.0; emit = vec3(0.0);
  float lat = p.y, lon = atan(p.z, p.x);
  if (uKind == 1) {
    vec3 c = mix(vec3(0.40, 0.38, 0.36), vec3(0.70, 0.67, 0.62), fbm(p * 3.0));
    return c * crater(p, 4.5) * crater(p + 3.1, 9.0);
  }
  if (uKind == 2) {
    float v = fbm(vec3(p.x * 1.6 + 0.5 * sin(lat * 7.0 + t * 0.04), lat * 6.0, p.z * 1.6));
    return mix(vec3(0.84, 0.66, 0.40), vec3(0.99, 0.93, 0.78), v);
  }
  if (uKind == 3) {
    float h = fbm(p * 1.8 + vec3(3.0));
    float land = smoothstep(0.47, 0.5, h);
    vec3 ocean = mix(vec3(0.02, 0.07, 0.24), vec3(0.05, 0.26, 0.5), smoothstep(0.36, 0.47, h));
    float dry = fbm(p * 5.0);
    vec3 ground = mix(vec3(0.15, 0.34, 0.13), vec3(0.6, 0.48, 0.3), smoothstep(0.45, 0.68, dry + (1.0 - abs(lat)) * 0.15 - 0.1));
    float ice = smoothstep(0.94, 0.965, abs(lat) + 0.03 * dry);
    vec3 c = mix(mix(ocean, ground, land), vec3(0.93, 0.96, 0.99), ice);
    spec = (1.0 - land) * (1.0 - ice);
    float cl = smoothstep(0.52, 0.78, fbm(p * 2.6 + vec3(0.0, 7.0, 0.0)));
    c = mix(c, vec3(0.97), cl * 0.85); spec *= 1.0 - cl;
    return c;
  }
  if (uKind == 4) {
    float m = smoothstep(0.5, 0.62, fbm(p * 1.4 + vec3(5.0)));
    return mix(vec3(0.68, 0.67, 0.64), vec3(0.36, 0.36, 0.37), m) * crater(p, 4.0) * crater(p + 7.0, 8.5);
  }
  if (uKind == 5) {
    float n = fbm(p * 2.5);
    vec3 c = mix(vec3(0.5, 0.22, 0.12), vec3(0.82, 0.46, 0.26), smoothstep(0.35, 0.65, n));
    c = mix(c, vec3(0.38, 0.19, 0.13), smoothstep(0.55, 0.7, fbm(p * 1.2 + 2.0)) * 0.6);
    return mix(c, vec3(0.95, 0.93, 0.92), smoothstep(0.93, 0.955, abs(lat) + 0.025 * n));
  }
  if (uKind == 6) {
    float v = lat + 0.035 * (fbm(vec3(p.x * 2.0 + t * 0.01, lat * 10.0, p.z * 2.0)) - 0.5) * 2.0;
    vec3 c = mix(vec3(0.6, 0.42, 0.3), vec3(0.95, 0.9, 0.81), sin(v * 23.0) * 0.5 + 0.5);
    float d = length(vec2(atan(sin(lon), cos(lon)), (lat + 0.36) * 2.6));
    return mix(c, vec3(0.8, 0.42, 0.28), 1.0 - smoothstep(0.17, 0.22, d));
  }
  if (uKind == 7) {
    float v = lat + 0.015 * (fbm(vec3(p.x * 2.0, lat * 8.0, p.z * 2.0)) - 0.5);
    return mix(vec3(0.8, 0.68, 0.48), vec3(0.96, 0.89, 0.69), sin(v * 18.0) * 0.5 + 0.5);
  }
  if (uKind == 8) return mix(vec3(0.55, 0.8, 0.84), vec3(0.7, 0.9, 0.92), (sin(lat * 9.0) * 0.5 + 0.5) * 0.35);
  return mix(vec3(0.14, 0.28, 0.74), vec3(0.3, 0.5, 0.93), sin(lat * 14.0 + fbm(p * 3.0) * 0.8) * 0.5 + 0.5);
}
vec3 procedural(vec3 N, vec3 pb, float t) {
  if (uKind == 0) {
    vec3 c = mix(vec3(1.0, 0.52, 0.12), vec3(1.0, 0.9, 0.58), fbm(pb * 14.0 + vec3(t * 0.03)));
    return c * (0.55 + 0.45 * pow(max(N.z, 0.0), 0.45)) * 1.25;
  }
  float spec; vec3 emit;
  vec3 c = surface(pb, t, spec, emit);
  float dl = dot(N, uL);
  vec3 lit = c * (0.035 + 1.05 * smoothstep(-0.08, 0.25, dl) * (0.25 + 0.75 * max(dl, 0.0)));
  lit += spec * pow(max(dot(N, normalize(uL + vec3(0.0, 0.0, 1.0))), 0.0), 40.0) * 0.55 * step(0.0, dl);
  return lit + uAtm * pow(1.0 - max(N.z, 0.0), 2.5) * (max(dl, 0.0) * 0.9 + 0.08);
}

/* ---------- a world from its maps, returned ready for display ---------- */
vec3 mapped(vec3 N, vec3 pb, float t) {
  float dl = dot(N, uL), fres = 1.0 - max(N.z, 0.0);
  vec3 c;
  if (uKind == 0) {                                   // the Sun: the map, living granulation, limb darkening
    vec3 base = lin(texture2D(uMap, seam(equi(pb))).rgb);
    float g = fbm(pb * 26.0 + vec3(t * 0.04)) - 0.5;
    float mu = max(N.z, 0.0);
    c = base * (1.0 + 0.5 * g) * (0.35 + 0.65 * sqrt(mu)) * 4.2;
    c *= 1.0 - 0.8 * (1.0 - smoothstep(0.06, 0.13, worley(pb * 5.0))) * step(0.66, hash(floor(pb * 5.0)));
    return display(c);
  }
  if (uKind == 3) c = earth(N, pb, t);
  else if (uKind == 1) c = airless(uMap, N, pb, 2.2, 1.25);
  else if (uKind == 4) c = airless(uMap, N, pb, 1.6, 1.15);
  else if (uKind == 5) {                              // Mars: dusty, a thin pink haze at the limb
    c = giant(N, pb, 0.85, 0.0, t) * 1.15;
    c = mix(c, vec3(0.75, 0.38, 0.24) * 0.6, clamp(pow(fres, 3.0) * smoothstep(-0.2, 0.6, dl) * 0.55, 0.0, 1.0));
  } else if (uKind == 2) {                            // Venus: the cloud deck, softened, drifting the "wrong" way
    vec2 uv = equi(pb); uv.x -= t * 0.004;
    vec3 a = mix(vec3(0.62, 0.5, 0.32), lin(texture2D(uMap, seam(uv)).rgb), 0.55) * 1.35;
    float mu0 = max(dl, 0.0), mu = max(N.z, 0.05);
    c = a * pow(mu0, 0.75) * pow(mu, -0.25) * smoothstep(-0.05, 0.1, dl);
    c = mix(c, vec3(0.9, 0.75, 0.45), clamp(pow(fres, 2.5) * smoothstep(-0.3, 0.7, dl) * 0.45, 0.0, 1.0));
  } else if (uKind == 6) c = giant(N, pb, 0.92, 0.0, t) * 1.12;
  else if (uKind == 7) {
    c = giant(N, pb, 0.9, 0.0, t) * 1.08;
  } else if (uKind == 8) c = giant(N, pb, 0.8, 0.0, t) * 1.2;
  else c = giant(N, pb, 0.8, 0.0, t) * 1.35;
  if (uKind >= 6) c += lin(uAtm) * pow(fres, 3.0) * max(dl, 0.0) * 0.5;   // high haze on the giants
  return display(c);
}

void main() {
  float S = 0.5 * min(uRes.x, uRes.y);
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / S;
  float px = 1.5 / S, t = uTime, R = uR;
  vec3 col = vec3(0.012, 0.016, 0.035) + vec3(0.025, 0.018, 0.05) * (1.0 - length(uv) * 0.5);
  vec2 cell = floor(gl_FragCoord.xy / 3.0);
  float h = hash(vec3(cell, 1.0));
  if (h > 0.9965) col += vec3(0.8, 0.85, 1.0) * (0.55 + 0.45 * sin(t * 1.7 + h * 100.0)) * hash(vec3(cell, 2.0));

  float best = -1e9, cov = 0.0;
  float r2 = dot(uv, uv), rr0 = sqrt(r2);
  // the limb glow of an atmosphere, drawn behind the disc (a thin shell, as in the three.js Earth)
  if (uKind != 0 && dot(uAtm, uAtm) > 0.0 && rr0 > R - px && rr0 < R * 1.08) {
    float shell = uKind == 3 ? 1.035 : uKind == 2 ? 1.05 : uKind == 5 ? 1.018 : 1.025;
    float Ra = R * shell, nz = sqrt(max(Ra * Ra - r2, 0.0)) / Ra;
    vec3 Ns = vec3(uv / Ra, -nz);
    float sunward = dot(normalize(vec3(uv, 0.0)), uL);
    float a = pow(clamp(1.0 - (1.0 - nz - 0.73) / 0.27, 0.0, 1.0), 3.0) * smoothstep(-0.12, 0.9, sunward) * step(rr0, Ra);
    vec3 glow = uKind == 3 ? mix(SKY_DUSK, SKY_DAY, smoothstep(-0.12, 0.5, sunward)) * 1.3 : lin(uAtm) * 0.9;
    col = mix(col, display(glow), a * (uKind == 3 ? 0.95 : 0.6));
  }
  if (rr0 < R + px) {
    cov = 1.0 - smoothstep(R - px, R + px, rr0);
    float z = sqrt(max(R * R - r2, 0.0));
    vec3 N = normalize(vec3(uv, z));
    vec3 pb = vec3(dot(N, uBX), dot(N, uBY), dot(N, uBZ));
    vec3 c = vec3(0.0);
    if (uTex < 1.0) c = procedural(N, pb, t);
    if (uTex > 0.0) c = mix(c, mapped(N, pb, t), uTex);
    if (uRing == 1 && uKind != 0) {                   // the rings' shadow across the clouds
      float tt = -dot(N * R, uBY) / dot(uL, uBY);
      if (tt > 0.0) c *= 1.0 - 0.8 * ringAlpha(length(N * R + uL * tt) / R);
    }
    col = mix(col, c, cov);
    best = z;
  }
  if (cov < 0.5) best = -1e9;

  for (int i = 0; i < 4; i++) {                       // moons
    if (i >= uMoons) break;
    vec4 m = uMoon[i]; vec2 d = uv - m.xy; float dd = dot(d, d);
    if (dd < m.w * m.w) {
      float z = m.z + sqrt(m.w * m.w - dd);
      if (z > best) {
        vec3 N = normalize(vec3(d, sqrt(m.w * m.w - dd)));
        float dl = dot(N, uL);
        vec3 c;
        if (i == 0 && uMoonTexOn > 0.5) {             // our Moon, tidally locked: its near side faces the Earth
          vec3 mx = normalize(-m.xyz), my = normalize(uBY - dot(uBY, mx) * mx), mz = cross(mx, my);
          vec3 pm = vec3(dot(N, mx), dot(N, my), dot(N, mz));
          vec3 alb = lin(texture2D(uMoonTex, seam(equi(pm))).rgb) * 1.2;
          float mu0 = max(dl, 0.0), mu = max(N.z, 0.02);
          c = display(alb * mix(mu0, 2.0 * mu0 / (mu0 + mu), 0.72) * smoothstep(-0.02, 0.06, dl));
        } else {
          c = uMoonCol[i] * (0.8 + 0.3 * noise(N * 6.0 + float(i) * 13.0));
          c *= 0.04 + smoothstep(-0.05, 0.3, dl) * (0.3 + 0.7 * max(dl, 0.0));
        }
        float e = 1.0 - smoothstep(m.w - 1.5 / S, m.w, sqrt(dd));
        col = mix(col, c, e);
        best = z;
      }
    }
  }
  if (uKind == 0 && rr0 > R - px) {                   // the corona, blended across the limb
    float k = max(rr0 - R, 0.0);
    col += (1.0 - cov * 0.6) * (vec3(1.0, 0.58, 0.22) * exp(-k / (R * 0.28)) * 0.85 + vec3(1.0, 0.8, 0.5) * exp(-k / (R * 0.05)) * 0.6);
  }
  if (uRing > 0) {
    float zr = -(uBY.x * uv.x + uBY.y * uv.y) / uBY.z;
    vec3 q = vec3(uv, zr); float rr = length(q) / R;
    float a = uRing == 1 ? ringAlpha(rr) : faintRing(rr);
    if (a > 0.003 && zr > best) {
      vec3 rc = uRing == 1 ? ringCol(rr) : vec3(0.7, 0.76, 0.82);
      float lit = 0.5 + 0.55 * abs(dot(uL, uBY));
      float b = dot(q, uL), disc = b * b - (dot(q, q) - R * R);
      if (disc > 0.0 && -b - sqrt(disc) > 0.0) lit *= 0.1;   // in the planet's shadow
      col = mix(col, rc * lit, a);
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;
  const VERT = "attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }";

  // kind, axial tilt (°), length of day (hours; negative = retrograde), atmosphere tint, rings, moons [name, orbit (planet radii), size, period (s), colour]
  // maps: sampler -> file in assets/planets (grey ones are uploaded as single-channel textures)
  const BODIES = {
    sun: { kind: 0, tilt: 7.25, day: 609, maps: { uMap: "sun.webp" } },
    mercury: { kind: 1, tilt: 0.03, day: 1408, maps: { uMap: "mercury.webp" } },
    venus: { kind: 2, tilt: 177.4, day: -5832, atm: [0.9, 0.75, 0.45], maps: { uMap: "venus.webp" } },
    earth: { kind: 3, tilt: 23.4, day: 24, atm: [0.3, 0.55, 1.0], light: [-0.88, 0.3, 0.36], moons: [["Moon", 2.3, 0.27, 46, [0.76, 0.75, 0.72]]],
      maps: { uMap: "earth-day.webp", uNight: "earth-night.webp", uClouds: "earth-clouds.webp", uOcean: "earth-ocean.webp", uNormal: "earth-normal.webp", uMoonTex: "moon.webp" } },
    moon: { kind: 4, tilt: 6.7, day: 655, maps: { uMap: "moon.webp" } },
    mars: { kind: 5, tilt: 25.2, day: 24.6, atm: [0.8, 0.45, 0.3], moons: [["Phobos", 1.55, 0.06, 11, [0.6, 0.55, 0.5]], ["Deimos", 2.2, 0.045, 26, [0.66, 0.62, 0.56]]], maps: { uMap: "mars.webp" } },
    jupiter: { kind: 6, tilt: 3.1, day: 9.9, atm: [0.3, 0.25, 0.2], moons: [["Io", 1.5, 0.07, 10, [0.95, 0.85, 0.42]], ["Europa", 1.85, 0.06, 16, [0.9, 0.86, 0.78]], ["Ganymede", 2.25, 0.09, 24, [0.7, 0.66, 0.6]], ["Callisto", 2.65, 0.085, 38, [0.5, 0.46, 0.42]]], maps: { uMap: "jupiter.webp" } },
    saturn: { kind: 7, tilt: 26.7, day: 10.7, atm: [0.25, 0.22, 0.15], ring: 1, moons: [["Enceladus", 2.45, 0.035, 13, [0.96, 0.98, 1.0]], ["Titan", 2.8, 0.1, 32, [0.92, 0.66, 0.32]]], maps: { uMap: "saturn.webp", uRingTex: "saturn-ring.webp" } },
    uranus: { kind: 8, tilt: 97.8, day: -17.2, atm: [0.4, 0.75, 0.8], ring: 2, moons: [["Titania", 2.2, 0.06, 22, [0.72, 0.7, 0.68]], ["Oberon", 2.6, 0.06, 32, [0.66, 0.62, 0.6]]], maps: { uMap: "uranus.webp" } },
    neptune: { kind: 9, tilt: 28.3, day: 16.1, atm: [0.3, 0.5, 1.0], ring: 2, moons: [["Triton", 2.3, 0.08, -28, [0.86, 0.82, 0.8]]], maps: { uMap: "neptune.webp" } }
  };
  const UNITS = { uMap: 0, uNight: 1, uClouds: 2, uOcean: 3, uNormal: 4, uRingTex: 5, uMoonTex: 6 };
  const GREY = { "earth-clouds.webp": 1, "earth-ocean.webp": 1, "moon.webp": 1 };
  const BASE = "assets/planets/";

  function create(canvas) {
    const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) return null;
    const deriv = !!gl.getExtension("OES_standard_derivatives");
    const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
    const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, (deriv ? "#extension GL_OES_standard_derivatives : enable\n#define DERIV\n" : "") + FRAG);
    if (!vs || !fs) return null;
    const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(prog)); return null; }
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {}; ["uRes", "uTime", "uKind", "uR", "uBX", "uBY", "uBZ", "uL", "uAtm", "uMoons", "uRing", "uTex", "uRingOn", "uMoonTexOn"].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));
    Object.keys(UNITS).forEach((n) => gl.uniform1i(gl.getUniformLocation(prog, n), UNITS[n]));
    const uMoon = [0, 1, 2, 3].map((i) => gl.getUniformLocation(prog, `uMoon[${i}]`)), uMoonCol = [0, 1, 2, 3].map((i) => gl.getUniformLocation(prog, `uMoonCol[${i}]`));
    const unit = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
    const L = unit([-0.72, 0.38, 0.58]);

    // maps load only when a world is first opened, then stay cached
    const cache = {};
    function texture(file) {
      if (cache[file]) return cache[file];
      const o = (cache[file] = { tex: gl.createTexture(), ready: false });
      const img = new Image();
      img.onload = () => {
        const ring = file === "saturn-ring.webp", fmt = ring ? gl.RGBA : GREY[file] ? gl.LUMINANCE : gl.RGB;
        gl.bindTexture(gl.TEXTURE_2D, o.tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, fmt, fmt, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, ring ? gl.CLAMP_TO_EDGE : gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        // without derivatives the seam trick is unavailable, so skip mipmaps (no seam, a little shimmer)
        if (deriv || ring) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
        else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
        o.ready = true;
      };
      img.onerror = () => { o.failed = true; };
      img.src = BASE + file;
      return o;
    }
    const mapsOf = (b) => Object.entries(b.maps || {}).map(([u, f]) => [u, texture(f)]);
    const allReady = (list) => list.length > 0 && list.every(([, o]) => o.ready);

    let body = BODIES.saturn, id = "saturn", maps = [], fade = 0, running = false, raf = 0, last = 0, t0 = performance.now(), dpr = 1;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const normv = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); };
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      if (w && (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr))) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      gl.viewport(0, 0, canvas.width, canvas.height);
      const t = reduce || (window.Sky && Sky.calm) ? 20 : (now - t0) / 1000;
      // the spin axis: tilted in the picture, tipped a little toward us so we see a pole and the ring opening
      const T = (body.tilt * Math.PI) / 180, inc = 0.32;
      let a = [-Math.sin(T), Math.cos(T) * Math.cos(inc), Math.cos(T) * Math.sin(inc)];
      if (Math.abs(a[2]) < 0.2) a = normv([a[0], a[1], a[2] + 0.25]);
      const ref = normv(cross(a, [0, 0, 1])), refZ = cross(ref, a);
      // positive = prograde: counter-clockwise seen from above the north pole
      const rate = Math.sign(body.day) * Math.min(2.5, Math.max(0.12, 24 / Math.abs(body.day))) * (2 * Math.PI / 45);
      const ph = -t * rate;
      const bx = ref.map((v, i) => Math.cos(ph) * v + Math.sin(ph) * refZ[i]);
      const bz = cross(bx, a);
      const moons = body.moons || [];
      const extent = Math.max(body.ring === 1 ? 2.32 : body.ring ? 2.1 : 1, moons.length ? 0.8 * Math.max(...moons.map((m) => m[1] + m[2])) : 1);
      const R = Math.min(id === "sun" ? 0.5 : 0.62, 0.92 / extent);
      // the maps: bind what this world uses and fade them in once they have all arrived
      const ready = allReady(maps.filter(([u]) => u !== "uMoonTex"));
      fade = ready ? Math.min(1, fade + dt / 0.9) : 0;
      maps.forEach(([u, o]) => { gl.activeTexture(gl.TEXTURE0 + UNITS[u]); gl.bindTexture(gl.TEXTURE_2D, o.ready ? o.tex : null); });
      gl.uniform1f(U.uTex, fade);
      gl.uniform1f(U.uRingOn, maps.some(([u, o]) => u === "uRingTex" && o.ready) ? 1 : 0);
      gl.uniform1f(U.uMoonTexOn, maps.some(([u, o]) => u === "uMoonTex" && o.ready) ? 1 : 0);
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime, t);
      gl.uniform1i(U.uKind, body.kind);
      gl.uniform3fv(U.uL, body.light ? unit(body.light) : L);   // Earth is lit more from the side, so its night lights show
      gl.uniform1f(U.uR, R);
      gl.uniform3fv(U.uBX, bx); gl.uniform3fv(U.uBY, a); gl.uniform3fv(U.uBZ, bz);
      gl.uniform3fv(U.uAtm, body.atm || [0, 0, 0]);
      gl.uniform1i(U.uRing, body.ring || 0);
      gl.uniform1i(U.uMoons, moons.length);
      moons.forEach((m, i) => {
        const th = -(t * 2 * Math.PI) / m[3] + i * 2.1;
        const r = m[1] * R;
        const pos = ref.map((v, k) => (Math.cos(th) * v + Math.sin(th) * refZ[k]) * r);
        gl.uniform4f(uMoon[i], pos[0], pos[1], pos[2], m[2] * R);
        gl.uniform3fv(uMoonCol[i], m[4]);
      });
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    return {
      moons: (k) => (BODIES[k] && BODIES[k].moons ? BODIES[k].moons.map((m) => m[0]) : []),
      show(k) {
        if (!BODIES[k]) return;
        body = BODIES[k]; id = k; maps = mapsOf(body);
        fade = allReady(maps.filter(([u]) => u !== "uMoonTex")) ? 1 : 0;
      },
      start() { if (!running) { running = true; last = 0; raf = requestAnimationFrame(frame); } },
      stop() { running = false; cancelAnimationFrame(raf); }
    };
  }
  window.PlanetGlobe = { create, has: (k) => !!BODIES[k] };
})();
