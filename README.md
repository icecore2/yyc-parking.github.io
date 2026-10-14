# Calgary On-Street Parking Map

An interactive, responsive static map application built with **OpenStreetMap** (via Leaflet) that visualizes the City of Calgary's on-street parking zones, rates, street shapes, and parking restrictions using the Calgary Parking Authority ArcGIS FeatureServer API.

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

4. **Street Polylines / Shapes**
   - Accurate polyline shapes drawn directly on top of the street layout.
   - Auto-projection: Handles Esri Web Mercator (EPSG:3857/102100) coordinates seamlessly converting them to WGS84 Lat/Lng.
   - Color-coded by Price Zone with an on-screen visual legend.
   - Hover effects and click interactions to select zones.

5. **"Get Latest Information" Live Sync**
   - Prominent header button with loading indicator to query the latest real-time data from the Calgary Parking Authority FeatureServer.
   - Live status indicator displaying connection state, record count, and timestamp of last synchronization.

6. **Search & Area Filters**
   - Instant search input to filter by Parking Zone # (e.g., `1008`, `1774`) or street name (e.g., `Eau Claire`, `10 St`).
   - Area dropdown filter to isolate specific neighborhoods and BRZ districts.

---

## 🚀 How to Run

### Option 1: Direct File Open
Since the application is 100% static and the Calgary ArcGIS FeatureServer API has open CORS (`Access-Control-Allow-Origin: *`), you can simply double-click or open [index.html](file:///f:/Programming/Other/calgary-parking-map/index.html) in any web browser (Chrome, Edge, Firefox, Safari).

### Option 2: Using Node.js
```bash
npm start
```
Then visit [http://localhost:8080](http://localhost:8080).

### Option 3: Using Python
```bash
python -m http.server 8080
```
Then visit [http://localhost:8080](http://localhost:8080).

---

## 📡 API Endpoint Used

```
https://services1.arcgis.com/AVP60cs0Q9PEA8rH/arcgis/rest/services/Calgary_Parking_Authority_On_Street_Parking_Zones_with_Rates/FeatureServer/0/query?where=1%3D1&outFields=*&resultRecordCount=20000&f=json
```

Users can also customize or test alternative query URLs directly via the built-in Settings modal in the app header.

---

## 📁 File Structure

- [index.html](file:///f:/Programming/Other/calgary-parking-map/index.html): Main HTML application structure and UI controls.
- [css/styles.css](file:///f:/Programming/Other/calgary-parking-map/css/styles.css): Modern CSS design, responsive layout, custom marker icons, and sidebar styles.
- [js/app.js](file:///f:/Programming/Other/calgary-parking-map/js/app.js): Application logic, Leaflet map setup, coordinate conversion, ArcGIS data fetcher, and details drawer.
- [server.js](file:///f:/Programming/Other/calgary-parking-map/server.js): Lightweight local static file server.
- [package.json](file:///f:/Programming/Other/calgary-parking-map/package.json): NPM scripts.
