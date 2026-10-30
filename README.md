# Between Rollers · Gage Studio

A browser-based, parametric designer for the roller-seating gage discussed in this project. Rotate, pan, and zoom a live solid; enter dimensions in inches or millimeters; export a printable model.

## Features

- Roller count and actual roller diameter, minimum/maximum between-roller diameters, and a continuously selectable design target.
- Gage thickness, probe-relief width and length, an exact Cage Clearance Diameter for the outer tooth envelope, and an optional through bore. Flat lengths are solved automatically.
- Automatically solved **tangent flats with contact at their exact midpoints**.
- Signed **diametral** printing compensation; optional compensation of the bore diameter.
- Independent top and bottom chamfer sizes and angles, including the relief and bore edges. Overlapping local chamfers are resolved by solid booleans.
- Up to six circular or straight/multiline text layers, on either face, embossed or engraved into the exported solid. Font family, weight, slant, size, depth, tracking, kerning, alignment, line spacing, position, rotation, radius, and reading direction are editable. Custom TTF, OTF, and WOFF fonts can be imported.
- **3MF, binary STL, OBJ, GLB, and PLY** exports. All use the final solid, including chamfers and lettering; guide rollers never export.
- Automatic device-local saving, portable `.gage.json` projects, a light-blue default and custom color picker, offline support, and installable app icons. The fixed editor keeps only settings scrollable, uses a side-by-side phone landscape layout, and fits the visible viewport above the keyboard.

## Geometry contract

The between-roller diameter is the circle through the inward-facing roller apexes. The min/max fields describe the allowable range; this app creates **one rigid gage at the chosen target**, rather than one expanding gage covering the whole range.

All calculations use millimeters internally, with inches converted at the input boundary (`0.025 in = 0.635 mm`). Curve tolerance is a separate tessellation setting and never rescales a chamfer.

Let `D` be the selected between-roller diameter after compensation, `C = D/2 + rollerDiameter/2` the roller-center radius, and `r` the actual roller radius. For each candidate half-flat length `h`, the centered tangent construction is:

```
contact angle beta = atan(h/r) + asin(gapWidth / (2*sqrt(r*r + h*h)))
contact point = (r*sin(beta), C - r*cos(beta))
flat endpoints = contact point +/- h*(cos(beta), sin(beta))
```

A bounded root solve selects `h` so the outside flat endpoint lies on exactly half the specified **Cage Clearance Diameter**, after compensation. The contact point remains the segment midpoint and the normal passes through the roller center. The lower endpoints meet the relief walls at `+/- gapWidth/2`; the opposite flat is mirrored. Seats repeat every `360 / rollerCount` degrees. Gap length is measured radially inward from the roller apex to the slot floor.

Compensation adds to **diameters**. `+0.010 in` increases both the between-roller span and cage clearance diameter by exactly `0.010 in`, shifting their radii by `0.005 in`. Actual roller diameter, relief dimensions, thickness, and text size remain unchanged. Bore compensation adds the same signed amount to the bore diameter when enabled.

Chamfer **size** is the setback across the flat face, and **angle** is measured from that face. Axial depth is `size * tan(angle)`. Thus a 0.750 in thick gage with two 0.025 in chamfers at 45 degrees has 0.700 in of full contact height. Angles can be selected independently from 1 to 89 degrees. Chamfers are constructed as exact sloped edge cuts, with conical joins at re-entrant corners and frustums around the bore. The solid kernel resolves intersections, preserving the uncut middle contact band; curve resolution controls surface approximation rather than chamfer dimensions. Physically impossible requests that consume the contact band or entire flat face are still rejected.

Invalid dimensions, overlapping rollers, insufficient webs, disconnected solids, missing glyphs, and lettering crossing an edge or hole block export. The previous valid model remains visible while inputs are repaired. Changing lettering reuses the cached base solid. Editing inputs no longer reframes the camera; Fit and the view presets are explicit controls.

Version 2 projects store the cage clearance diameter, angles, and color. Version 1 projects migrate their former flat length to the equivalent outside diameter without changing the saved geometry. The same local storage key is retained so existing device-local projects are recovered.

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

Four curve resolutions are available. The circular profile uses a sagitta bound of 0.08 mm (draft), 0.025 mm (standard), 0.008 mm (fine), or 0.0025 mm (ultra fine), in addition to minimum segment counts. Labels show the tolerance in the selected display units. Font curves have a separate resolution matched to the quality setting. 3MF and GLB also retain the selected gage color.

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

Use a current Safari, Chrome, Edge, or Firefox with WebAssembly. WebGL2 provides the primary accelerated view; an interactive Canvas 3D fallback draws the same solid when hardware graphics are unavailable. The responsive interface supports phone touch controls: one finger orbits; two fingers pan and pinch. On desktop, right-drag or Shift-drag pans. Keys 1–4 select views; F fits the model. On iPhone use Safari → Share → Add to Home Screen; supported Android/desktop browsers expose an Install app command.

Tests cover tangent midpoint/normal geometry, compensation, targets, solid manifoldness and connectivity, volume, chamfers, bores, circular and multiline lettering, bottom-face placement, invalid-input handling, missing glyphs, all export layouts, and an independent 3MF importer round-trip.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the distributed font licenses for third-party attribution.
