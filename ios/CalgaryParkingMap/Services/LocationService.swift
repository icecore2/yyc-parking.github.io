import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
#if canImport(CoreLocation)
import CoreLocation
#endif

#if canImport(CoreLocation)
private final class GPSManager: NSObject, CLLocationManagerDelegate, @unchecked Sendable {
    private let locationManager = CLLocationManager()
    private var locationContinuation: CheckedContinuation<CLLocationCoordinate2D, Error>?

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
    }

    func requestLocation() async throws -> CLLocationCoordinate2D {
        return try await withCheckedThrowingContinuation { continuation in
            self.locationContinuation = continuation
            let status = locationManager.authorizationStatus
            if status == .notDetermined {
                locationManager.requestWhenInUseAuthorization()
            } else if status == .denied || status == .restricted {
                continuation.resume(throwing: NSError(domain: "LocationService", code: 1, userInfo: [NSLocalizedDescriptionKey: "Location permission denied"]))
                self.locationContinuation = nil
            } else {
                locationManager.requestLocation()
            }
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        if status == .authorizedWhenInUse || status == .authorizedAlways {
            manager.requestLocation()
        } else if status == .denied || status == .restricted {
            locationContinuation?.resume(throwing: NSError(domain: "LocationService", code: 1, userInfo: [NSLocalizedDescriptionKey: "Location permission denied"]))
            locationContinuation = nil
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        locationContinuation?.resume(returning: loc.coordinate)
        locationContinuation = nil
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        locationContinuation?.resume(throwing: error)
        locationContinuation = nil
    }
}
#endif

public final class LocationService: @unchecked Sendable {
    public static let shared = LocationService()

    #if canImport(CoreLocation)
    private let gpsManager = GPSManager()
    #endif

    private let locationsKey = "cpa_custom_locations"

    public init() {}

    public func requestCurrentLocation() async throws -> CLLocationCoordinate2D {
        #if canImport(CoreLocation)
        return try await gpsManager.requestLocation()
        #else
        throw NSError(domain: "LocationService", code: 1, userInfo: [NSLocalizedDescriptionKey: "Location services unavailable on this platform"])
        #endif
    }

    // MARK: - Geocoding (Nominatim & Raw Coords)

    public func geocodeAddress(_ input: String) async throws -> CLLocationCoordinate2D {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)

        // Try raw coordinate match: "51.045, -114.07"
        let rawPattern = #"^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$"#
        if let regex = try? NSRegularExpression(pattern: rawPattern),
           let match = regex.firstMatch(in: trimmed, range: NSRange(trimmed.startIndex..., in: trimmed)),
           let r1 = Range(match.range(at: 1), in: trimmed),
           let r2 = Range(match.range(at: 2), in: trimmed),
           let lat = Double(trimmed[r1]),
           let lng = Double(trimmed[r2]) {
            return CLLocationCoordinate2D(latitude: lat, longitude: lng)
        }

        // Query OpenStreetMap Nominatim restricted to Calgary bounding box
        guard let encoded = (trimmed + ", Calgary, Alberta").addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://nominatim.openstreetmap.org/search?format=json&q=\(encoded)&limit=1&viewbox=-114.35,51.25,-113.85,50.85&bounded=1") else {
            throw NSError(domain: "LocationService", code: 2, userInfo: [NSLocalizedDescriptionKey: "Invalid address query"])
        }

        var request = URLRequest(url: url)
        request.setValue("CalgaryParkingMap-iOS/1.0", forHTTPHeaderField: "User-Agent")
        request.timeoutInterval = 10.0

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode),
              let list = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]],
              let first = list.first,
              let latStr = first["lat"] as? String,
              let lonStr = first["lon"] as? String,
              let lat = Double(latStr),
              let lon = Double(lonStr) else {
            throw NSError(domain: "LocationService", code: 3, userInfo: [NSLocalizedDescriptionKey: "Could not geocode address in Calgary"])
        }

        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    // MARK: - Saved Locations (UserDefaults)

    public func loadSavedLocations() -> [CustomLocation] {
        if let data = UserDefaults.standard.data(forKey: locationsKey),
           let list = try? JSONDecoder().decode([CustomLocation].self, from: data) {
            return list
        }

        // Default seeds
        let seeds: [CustomLocation] = [
            CustomLocation(id: "loc_downtown", name: "Downtown Office", latitude: 51.0458, longitude: -114.0715),
            CustomLocation(id: "loc_stephen_ave", name: "Stephen Avenue Walk", latitude: 51.0449, longitude: -114.0628)
        ]
        saveLocations(seeds)
        return seeds
    }

    public func saveLocations(_ locations: [CustomLocation]) {
        if let data = try? JSONEncoder().encode(locations) {
            UserDefaults.standard.set(data, forKey: locationsKey)
        }
    }

    public func addLocation(name: String, coordinate: CLLocationCoordinate2D) -> CustomLocation {
        var list = loadSavedLocations()
        let newLoc = CustomLocation(name: name, latitude: coordinate.latitude, longitude: coordinate.longitude)
        list.append(newLoc)
        saveLocations(list)
        return newLoc
    }

    public func deleteLocation(id: String) {
        var list = loadSavedLocations()
        list.removeAll { $0.id == id }
        saveLocations(list)
    }
}
