# Calgary On-Street Parking Map

An interactive, responsive static map application built with **OpenStreetMap** (via Leaflet) that visualizes the City of Calgary's on-street parking zones, rates, street shapes, and parking restrictions using the Calgary Parking Authority ArcGIS FeatureServer API, alongside native **iOS** (`ios/`) and **Android** (`android/`) mobile applications.

🌐 **Live Demo (GitHub Pages):** [https://icecore2.github.io/yyc-parking.github.io/](https://icecore2.github.io/yyc-parking.github.io/)

---

## 🌟 Key Features

1. **Interactive OpenStreetMap Base Layer**
   - High-resolution OpenStreetMap tiles with optional base layer switching (OpenStreetMap Standard, CartoDB Positron clean street map, CartoDB Dark mode).
   - Centered on Calgary downtown core with street-level clarity.

2. **Pins for All Parking Locations**
   - Renders a custom pin marker (`P`) placed at the exact center of each parking zone's street segment across Calgary.
   - Marker clustering enabled by default for fluid, 60fps performance across 1,600+ parking zones, expanding automatically as you zoom into street level.
   - Clustering can be toggled on or off directly via the bottom floating toolbar.

3. **Complete Zone Details On Click**
   - Clicking any pin or street shape immediately highlights the polyline and opens a comprehensive **Slide-Out Details Sidebar** and marker popup.
   - Displays all associated parking details:
     - **Parking Zone Number** (e.g., `#1008`)
     - **Address / Street Segment** (e.g., `Eau Claire Av SW, Fr 4 St SW To 5 St SW`)
     - **Block Side** (North, South, East, West)
     - **Stall & Zone Capacity** (number of stalls, segment length in meters)
     - **Stall Type** (Parallel, Angle, Perpendicular)
     - **Business Revitalization Zone (BRZ)** (Downtown, Kensington, Beltline, Inglewood, etc.)
     - **Price Zone Tier**
     - **Max Stay Limit** (e.g., 2 Hours, 3 Hours)
     - **Enforceable Hours** (e.g., 09:10 - 17:50 Mon-Sat)
     - **Full Rate Schedule** (hourly rates, Saturday rates, Sunday/Holiday free parking)
     - **Parking Restrictions & Prohibitions** (Rush-hour AM/PM restrictions, No Stopping, No Parking alerts)
     - Direct button to **Zoom to Street Segment** and link to **Google Maps Navigation**.

4. **Interactive Price Graphs & Historical Trends**
   - **24-Hour Time-of-Day Rate Curve**: Stepped hourly area chart visualizing the parking rate from 12:00 AM to 11:59 PM. Includes day-of-week switcher pills (`Mon–Fri`, `Saturday`, `Sunday/Holiday`) and indicators for current rate, peak rate, and off-peak free parking windows.
   - **Historical Rate Trends & Sync Snapshots**: Longitudinal price evolution chart tracking peak daytime rate changes and demand-based price tier adjustments (2023–Present).
   - **Automatic Local Snapshots**: Automatically logs timestamped rate checkpoints on data sync and allows users to manually save or clear local price snapshots.
   - **Dark/Light Theme Adaptive**: Chart axes, tooltips, gridlines, and fills dynamically transition with the app's dark and light mode toggle.

5. **Street Polylines / Shapes**
   - Accurate polyline shapes drawn directly on top of the street layout.
   - Auto-projection: Handles Esri Web Mercator (EPSG:3857/102100) coordinates seamlessly converting them to WGS84 Lat/Lng.
   - Color-coded by Price Zone with an on-screen visual legend.
   - Hover effects and click interactions to select zones.

6. **"Get Latest Information" Live Sync**
   - Prominent header button with loading indicator to query the latest real-time data from the Calgary Parking Authority FeatureServer.
   - Live status indicator displaying connection state, record count, and timestamp of last synchronization.

7. **Search & Area Filters**
   - Instant search input to filter by Parking Zone # (e.g., `1008`, `1774`) or street name (e.g., `Eau Claire`, `10 St`).
   - Area dropdown filter to isolate specific neighborhoods and BRZ districts.

---

## 🚀 How to Run

### Option 1: Modern Full-Stack Webapp (Next.js 15 + Firebase + MapLibre GL)
```bash
npm run webapp:dev
```
Then visit [http://localhost:3000](http://localhost:3000).

- **Landing Page**: [http://localhost:3000](http://localhost:3000) (Interactive mini-map teaser, pricing tiers, FAQs)
- **Live Map Application**: [http://localhost:3000/app](http://localhost:3000/app) (MapLibre GL 60fps vector map, 1,600+ Calgary zones, Cheapest Spot Finder, Tow alarms)
- **Pricing & Pro Plan**: [http://localhost:3000/pricing](http://localhost:3000/pricing)
- **User Account & Vehicles**: [http://localhost:3000/account](http://localhost:3000/account)
- **Parking Expense Tracker (CSV Export)**: [http://localhost:3000/expenses](http://localhost:3000/expenses)

#### Run Webapp Engine Tests
```bash
npm run webapp:test
```

### Option 2: Standalone Parking Data Sync Service (`services/parking-sync`)
Fetches endpoints for all data providers (MyParking, Parkade, Impark, Indigo Neo, Precise ParkLink, Calgary Transit), stages in local SQLite first, hashes remote records, detects diffs, and immediately pushes changes to the remote database table `parking_data`:

```bash
# Run one-time sync & diff push
npm run sync:run

# Run sync engine test suite
npm run sync:test

# Run scheduled background daemon (e.g. every 15 minutes)
npm run sync:daemon
# Or with a custom interval:
npm run sync:daemon -- --interval=30
```
- **Automated Cloud Schedule**: Also runs every 30 minutes in GitHub Actions via `.github/workflows/parking-sync.yml`.

### Option 3: Legacy Static HTML (Leaflet)
```bash
npm start
```
Then visit [http://localhost:8080](http://localhost:8080).

### Run Automated Tests (Web)
```bash
npm test
```

### Option 3: Using Python
```bash
python -m http.server 8080
```
Then visit [http://localhost:8080](http://localhost:8080).

### Option 4: Native Android App (`android/`)
Open the `android/` directory in **Android Studio** or build and test from the command line:
```bash
cd android
./gradlew testDebugUnitTest
./gradlew assembleDebug
```

### Option 5: Native iOS App (`ios/`)
Open `ios/CalgaryParkingMap.xcodeproj` in **Xcode 16+** or run the Swift Package unit tests:
```bash
cd ios
swift test
```

---

## 🤖 Native Android App (Kotlin + Jetpack Compose + osmdroid)

The project includes a 100% feature-complete native Android application located in `android/`:

- **Native Architecture**: Built with **Kotlin**, **Jetpack Compose (Material 3)**, **Kotlin Coroutines**, and **osmdroid** (Android 8.0 / API 26+, targeting API 35).
- **Zero-API-Key Map Engine**: Uses `osmdroid` with interactive switching between **OpenStreetMap Standard**, **CARTO Positron (Clean Street)**, and **CARTO Dark Matter (Night)** tile layers.
- **All 6 Providers**: Curbside ParkPlus on-street, CPA off-street parkades/surface lots, 24 Calgary Transit Park & Ride stations, and commercial lots (Impark, Indigo, Precise ParkLink).
- **Map Features**: Dynamic spatial marker clustering, color-coded street polylines and parkade polygons, and dashed target location catchment radius circle.
- **Charts & History**: Custom Compose `Canvas` 24-hour stepped rate curve and longitudinal rate trend charts, with local snapshots in `SharedPreferences`.
- **Navigation**: Instant turn-by-turn routing via **Google Maps**.

### Building and Running on Android

1. Open the `android/` directory in **Android Studio**.
2. Select an Android Emulator or connected Android device.
3. Click **Run (`Shift+F10`)** or assemble the debug APK from the CLI:
   ```bash
   cd android
   ./gradlew assembleDebug
   ```

### Running Android Unit Tests

```bash
cd android
./gradlew testDebugUnitTest
```
Continuous Integration is automated via GitHub Actions in `.github/workflows/android-build.yml`.

---

## 📱 Native iOS App (SwiftUI + MapKit + Swift Charts)

The project includes a 100% feature-complete native iOS application located in `ios/`:

- **Native Architecture**: Built with **SwiftUI**, **MapKit**, **Swift Charts**, and **CoreLocation** (iOS 17.0+).
- **All 6 Providers**: Curbside ParkPlus on-street, CPA off-street parkades/surface lots, Calgary Transit Park & Ride stations, and commercial lots (Impark, Indigo, Precise ParkLink).
- **Map Features**: Dynamic marker clustering (`MKClusterAnnotationView`), color-coded street polylines and parkade polygons, and target location catchment radius circle.
- **Charts & History**: Stepped 24-hour rate curve and longitudinal rate trend charts powered by Swift Charts, with local snapshots in `UserDefaults`.
- **Navigation**: Instant turn-by-turn routing with both **Apple Maps** and **Google Maps**.

### Building and Running on iOS

1. Open `ios/CalgaryParkingMap.xcodeproj` in **Xcode 16+** on macOS.
2. Select an iOS Simulator (e.g., iPhone 16) or connected iOS device.
3. Press **Run (`⌘R`)** to launch the app.

### Running iOS Unit Tests

```bash
cd ios
swift test
```
The test suite validates the rate schedule parser, Web Mercator projection, provider registry, 24-hour profile restrictions, price filters, and Transit station data. Continuous Integration is automated via GitHub Actions in `.github/workflows/ios-build.yml`.

---

## 📡 API Endpoint Used

```
https://services1.arcgis.com/AVP60cs0Q9PEA8rH/arcgis/rest/services/Calgary_Parking_Authority_On_Street_Parking_Zones_with_Rates/FeatureServer/0/query?where=1%3D1&outFields=*&resultRecordCount=20000&f=json
```

Users can also customize or test alternative query URLs directly via the built-in Settings modal in the app header.

---

## 📁 File Structure

- `index.html`: Main HTML application structure and UI controls.
- `css/styles.css`: Modern CSS design, responsive layout, custom marker icons, and sidebar styles.
- `js/app.js`: Application logic, Leaflet map setup, coordinate conversion, ArcGIS data fetcher, and details drawer.
- `js/providers.js`: Multi-provider registry, branded pins, and Calgary Transit Park & Ride seed inventory.
- `data/commercial_parking.json`: Curated commercial parking dataset (Impark, Indigo, Precise ParkLink).
- `android/`: Native Android application built with Kotlin, Jetpack Compose (Material 3), and `osmdroid`.
- `ios/`: Native iOS application built with Swift, SwiftUI, MapKit, and Swift Charts.
- `server.js`: Lightweight local static file server.
- `package.json`: NPM scripts.
