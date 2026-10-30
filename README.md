# Between Rollers · Gage Studio

A browser-based, parametric designer for the roller-seating gage discussed in this project. Rotate, pan, and zoom a live solid; enter dimensions in inches or millimeters; export a printable model.

## Features

- Roller count and actual roller diameter, minimum/maximum between-roller diameters, and a continuously selectable design target.
- Gage thickness, probe-relief width and length, centered contact-flat length, and an optional through bore.
- Automatically solved **tangent flats with contact at their exact midpoints**.
- Signed **diametral** printing compensation; optional compensation of the bore diameter.
- Independent, true 45° top and bottom chamfers, including the relief and bore edges.
- Up to six circular or straight/multiline text layers, on either face, embossed or engraved into the exported solid. Font family, weight, slant, size, depth, tracking, kerning, alignment, line spacing, position, rotation, radius, and reading direction are editable. Custom TTF, OTF, and WOFF fonts can be imported.
- **3MF, binary STL, OBJ, GLB, and PLY** exports. All use the final solid, including chamfers and lettering; guide rollers never export.
- Automatic device-local saving, portable `.gage.json` projects, a responsive phone/desktop interface, offline support, and installable app icons.

## Geometry contract

The between-roller diameter is the circle through the inward-facing roller apexes. The min/max fields describe the allowable range; this app creates **one rigid gage at the chosen target**, rather than one expanding gage covering the whole range.

All calculations use millimeters internally. Let `D` be the selected between-roller diameter after compensation, `r` the actual roller radius, `h` half the flat length, and `w` the relief width:

```
roller-center pitch radius C = D/2 + r
contact angle beta = atan(h/r) + asin(w / (2*sqrt(r*r + h*h)))
contact point = (r*sin(beta), C - r*cos(beta))
flat endpoints = contact point +/- h*(cos(beta), sin(beta))
```

This places the contact point at the segment midpoint, with the flat normal passing through the roller center. The lower ends meet the relief walls at `+/- w/2`. The corresponding flat on the other side is mirrored. Identical seats are repeated at `360 / rollerCount` degrees. Gap length is the radial distance inward from the apex to the slot floor.

Compensation adds to the **diameter**, before the pitch radius is calculated. `+0.010 in` changes `D` by exactly `+0.010 in`, moving the roller-center circle outward by `0.005 in` per side. It does not apply `0.010 in` to each radius. Actual roller diameter, relief dimensions, thickness, and text size remain unchanged. If enabled, bore compensation adds the same signed amount to the bore diameter. The outer tooth envelope is derived from the tangent geometry, rather than being an independent input.

The middle contact faces remain full size between the two chamfers. The chamfer algorithm checks for intersecting offsets; narrow teeth may require smaller chamfers. Invalid dimensions, overlapping rollers, insufficient webs, disconnected solids, missing glyphs, and lettering crossing an edge or hole block export. The last valid solid remains visible with an explicit warning while inputs are repaired.

The nominal solid does not simulate elastic preload, stiffness, or roller/raceway deformation. Confirm finished dimensions, seating, and CMM probe access on the physical part. A custom font keeps its actual file weight; the built-in regular/bold selector does not synthesize bold for imported fonts.

## Export behavior

| Format | Units and coordinates | Purpose |
| --- | --- | --- |
| 3MF | Explicit millimeters, Z up | Preferred printing interchange. One model object and a build item. Includes the editable project as a package attachment. |
| STL | Millimeter coordinates, Z up | Binary triangle mesh. Select millimeters when importing. |
| OBJ | Millimeter coordinates, Z up | Indexed triangle mesh. Select millimeters when importing. |
| GLB | Meters, Y up | Standard binary glTF for 3D viewers. |
| PLY | Millimeter coordinates, Z up | ASCII indexed triangle mesh. |

3MF is a model package, not a slicer-specific printer or material profile. The exports are meshes, not STEP/BREP CAD solids. The project's JSON remains parametric and can be reopened for editing. Models with raised bottom lettering are translated so their lowest point rests at Z=0.

Three curve resolutions are available. The circular profile uses a sagitta bound of 0.08 mm (draft), 0.025 mm (standard), or 0.008 mm (fine), in addition to minimum segment counts. Font curves have a separate resolution matched to the quality setting.

## Develop and deploy

Requires Node 22 or newer.

```sh
npm ci
npm test
npm run dev
```

```sh
npm run build
npm run preview
```

The build is fully self-contained: the solid-modeling WASM, fonts, scripts, icons, and offline assets are bundled locally, without runtime CDN dependencies. Modeling and uploaded fonts stay on the device unless the user saves or shares an export/project. Local storage is best-effort; use a project download for a portable backup.

`.github/workflows/deploy.yml` tests and builds pushes to `main`, then publishes `dist` through GitHub Pages Actions. The repository's **Settings → Pages → Source** must be set to **GitHub Actions**. Pull requests run the tests and build without publishing. Relative asset paths support this repository's Pages subdirectory.

Use a current Safari, Chrome, Edge, or Firefox with WebAssembly and WebGL2. The responsive interface supports phone touch controls: one finger orbits; two fingers pan and pinch. On desktop, right-drag or Shift-drag pans. Keys 1–4 select views; F fits the model. On iPhone use Safari → Share → Add to Home Screen; supported Android/desktop browsers expose an Install app command.

Tests cover tangent midpoint/normal geometry, compensation, targets, solid manifoldness and connectivity, volume, chamfers, bores, circular and multiline lettering, bottom-face placement, invalid-input handling, missing glyphs, all export layouts, and an independent 3MF importer round-trip.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the distributed font licenses for third-party attribution.
