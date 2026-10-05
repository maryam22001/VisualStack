# AegisOT — System Architecture Studio

[![Isoflow Community Edition](https://img.shields.io/badge/Powered%20By-Isoflow%20CE-blue)](https://github.com/markmanx/isoflow)
[![React 18](https://img.shields.io/badge/React-18.3.1-61dafb)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178c6)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An interactive multi-view architecture visualization suite for the **AegisOT** Autonomous Industrial IoT Security Architecture[cite: 1, 7]. This tool combines 3D isometric modeling powered by **Isoflow Community Edition** with interactive 2D engineering views, dynamic component editing, custom icon uploads, and direct vector SVG exports.

Repository: [https://github.com/maryam22001/System-Architecture-by-isoflow.git](https://github.com/maryam22001/System-Architecture-by-isoflow.git)

---

## 3D Engine Reference: Isoflow

The 3D isometric visualization in this project is built using [Isoflow Community Edition](https://github.com/markmanx/isoflow) (`markmanx/isoflow`), an open-source React component for drawing 3D isometric network and system diagrams.

* **Repository:** [https://github.com/markmanx/isoflow](https://github.com/markmanx/isoflow)
* **Documentation:** [https://isoflow.io/docs](https://isoflow.io/docs)
* **License:** MIT License
* **Key Features Leveraged:**
  * Declarative isometric coordinate grid mapping (`{ x, y }` tile positions).
  * Extensible icon sets via `@isoflow/isopacks` (AWS, GCP, Azure, Kubernetes, and generic hardware).
  * Dynamic isometric connectors and labeled data paths.

---

## Architecture Overview (5-Layer Model)

The diagram reflects the end-to-end telemetry and remediation pipeline of the AegisOT platform[cite: 1, 7]:

1. **Layer 1: Physical / OT Edge:** ESP32 microcontrollers, optocoupled emergency-stop relays, 12V conveyor drives, and high-rate I2C vibration/power telemetry (ADXL345, INA219)[cite: 1, 7].
2. **Layer 2: Network / Trust:** Boundary enrollment (ZTP engine), smart managed switch isolation (VLAN 10 vs. VLAN 99 Quarantine), and GNS3 emulated network remediation[cite: 1, 7].
3. **Layer 3: Platform HA:** High-availability TLS Mosquitto broker cluster, Laravel 11 orchestration worker/API, and TimescaleDB/PostgreSQL time-series persistence[cite: 1, 7].
4. **Layer 4: Supervised AI Suite:** FastAPI windowed anomaly detection service paired with LangGraph diagnostic agents operating under strict read-only tool guardrails[cite: 1, 7].
5. **Layer 5: Experience & Oversight:** Real-time Vue 3 Digital Twin state mirror and Flutter mobile interface with mandatory human-in-the-loop approval gates[cite: 1, 7].

---

## Workspace Features

* **3D Isometric View (Isoflow):** Visualizes the multi-tier spatial cloud, network boundaries, and edge hardware with 3D isometric connectors and depth perspective.
* **Clean HA Diagram View:** Mimics enterprise microservice cluster documentation with soft-rounded group pods, orthogonal Manhattan line routing, and live status badges.
* **Detailed 2D View:** Card-based operational layout detailing pinouts, bus protocols, and data badges.
* **In-Place Component Editor:** Double-click any node or boundary enclosure to edit titles, subtext, add hardware notes, or upload custom SVG/PNG device icons.
* **Theme Switching:** Instant toggle between High-Contrast Dark Mode and Presentation-Ready Light Mode.
* **Vector SVG Export:** Direct client-side serialization to download pure, scalable `.svg` files from any active view for slide decks, papers, and GitHub documentation.

---

## Prerequisites & Installation

### Requirements

* **Node.js:** v18.x or v20.x LTS
* **Package Manager:** npm (v9+) or pnpm

### 1. Clone the Repository

```bash
git clone [https://github.com/maryam22001/System-Architecture-by-isoflow.git](https://github.com/maryam22001/System-Architecture-by-isoflow.git)
```bash
git clone https://github.com/maryam22001/System-Architecture-by-isoflow.git
cd System-Architecture-by-isoflow
```

## Running the Project Locally

### Start Development Server

To launch the local Vite development server with Hot Module Replacement (HMR):

```bash
npm run dev
```

Once running, navigate to the local address displayed in your terminal (typically `http://localhost:5173/` or `http://localhost:5174/`).

### Making Edits & Re-running

Editing Layout & Nodes: Customize node positioning, connections, and cluster coordinates directly inside `src/CleanArchitectureView.tsx`, `src/Architecture2D.tsx`, or `src/aegisotData.ts`. Vite updates the browser instantly via HMR without a full page refresh.

### Running with Clean Cache

If modifying package versions or bundler settings in `vite.config.ts`, restart Vite and force dependency pre-bundling:

```bash
npm run dev -- --force
```

### Linting & Type-Checking

Run ESLint and TypeScript checks before committing:

```bash
npm run lint
```

## How to Use the Studio

### 1. View Navigation

Toggle between views using the top navigation bar:

- Clean Diagram: Clustered microservice layout with soft HA enclosures and orthogonal routes.
- Detailed 2D View: Deep component inspection with sensor buses, pinouts, and custom lines.
- 3D Isometric: 3D perspective diagram powered by Isoflow.

### 2. Canvas Interactions

- Zoom: Scroll the mouse wheel up/down over the canvas, or use the `+` / `-` buttons on the bottom-right HUD.
- Pan: Click and hold any empty background area, then drag across the canvas.
- Move Nodes / Enclosures: Click and drag any component icon or enclosure box to reorder the layout.

### 3. Editing Components & Uploading Custom Icons

- Double-click any node icon to open the edit modal.
- Modify the label, subtitle, or select a built-in vector icon.
- Custom Icons: Click "Choose File" to upload your own local `.svg` or `.png` hardware icons directly onto the canvas.
- Click "Save Changes" to commit updates to the live scene.

### 4. Vector SVG Export

Frame your desired layout and click "Export Active View (SVG)" in the top header.

The application compiles the active DOM SVG tree into a downloadable `.svg` vector file ready for technical documentation and presentation slides.

## Production Build

To build a standalone production bundle:

```bash
npm run build
```

The compiled assets will be located in the `dist/` directory. Test the production build locally with:

```bash
npm run preview
```

## Acknowledgments & Credits

- `markmanx/isoflow` — Core 3D isometric diagramming component and `@isoflow/isopacks`.
- Diagrams-as-Code Community — Inspiration for declarative architectural patterns.

## License

This project is licensed under the MIT License.