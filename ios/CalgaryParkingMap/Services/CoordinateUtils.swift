import Foundation
#if canImport(CoreLocation)
import CoreLocation
#endif

public enum CoordinateUtils {
    /// Converts Esri Web Mercator (EPSG:3857 / EPSG:102100) coordinates to WGS84 (EPSG:4326) Lat/Lng
    public static func webMercatorToLatLng(x: Double, y: Double) -> CLLocationCoordinate2D {
        let lng = (x / 20037508.34) * 180.0
        var lat = (y / 20037508.34) * 180.0
        lat = (180.0 / .pi) * (2.0 * atan(exp((lat * .pi) / 180.0)) - .pi / 2.0)
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    /// Normalizes coordinate pairs: detects if Web Mercator or WGS84 and returns CLLocationCoordinate2D
    public static func normalizeCoord(x: Double, y: Double) -> CLLocationCoordinate2D {
        if abs(x) > 180.0 || abs(y) > 90.0 {
            return webMercatorToLatLng(x: x, y: y)
        }
        // If already WGS84, GIS order is usually [lng, lat] -> latitude is y, longitude is x
        return CLLocationCoordinate2D(latitude: y, longitude: x)
    }

    /// Calculates Euclidean distance between two coordinates in degrees
    private static func coordDistance(_ c1: CLLocationCoordinate2D, _ c2: CLLocationCoordinate2D) -> Double {
        let dx = c1.latitude - c2.latitude
        let dy = c1.longitude - c2.longitude
        return sqrt(dx * dx + dy * dy)
    }

    /// Computes the midpoint along a polyline's path length (matching js/app.js getPolylineMidpoint)
    public static func getPolylineMidpoint(_ points: [CLLocationCoordinate2D]) -> CLLocationCoordinate2D {
        guard !points.isEmpty else {
            return CLLocationCoordinate2D(latitude: 51.0447, longitude: -114.0719) // Calgary Center
        }
        if points.count == 1 {
            return points[0]
        }

        var totalDist = 0.0
        var segDists: [Double] = []
        for i in 0..<(points.count - 1) {
            let d = coordDistance(points[i], points[i + 1])
            segDists.append(d)
            totalDist += d
        }

        if totalDist == 0 {
            return points[0]
        }

        let halfDist = totalDist / 2.0
        var accum = 0.0

        for i in 0..<segDists.count {
            if accum + segDists[i] >= halfDist {
                let remain = halfDist - accum
                let frac = segDists[i] > 0 ? (remain / segDists[i]) : 0.0
                let lat = points[i].latitude + frac * (points[i + 1].latitude - points[i].latitude)
                let lng = points[i].longitude + frac * (points[i + 1].longitude - points[i].longitude)
                return CLLocationCoordinate2D(latitude: lat, longitude: lng)
            }
            accum += segDists[i]
        }

        return points[points.count / 2]
    }

    /// Computes the arithmetic centroid of a polygon ring (matching js/app.js getPolygonCentroid)
    public static func getPolygonCentroid(_ points: [CLLocationCoordinate2D]) -> CLLocationCoordinate2D {
        guard !points.isEmpty else {
            return CLLocationCoordinate2D(latitude: 51.0447, longitude: -114.0719)
        }
        var sumLat = 0.0
        var sumLng = 0.0
        for pt in points {
            sumLat += pt.latitude
            sumLng += pt.longitude
        }
        return CLLocationCoordinate2D(
            latitude: sumLat / Double(points.count),
            longitude: sumLng / Double(points.count)
        )
    }

    /// Computes walking distance in meters using Great Circle / Haversine distance
    public static func distanceInMeters(from: CLLocationCoordinate2D, to: CLLocationCoordinate2D) -> Double {
        let loc1 = CLLocation(latitude: from.latitude, longitude: from.longitude)
        let loc2 = CLLocation(latitude: to.latitude, longitude: to.longitude)
        return loc1.distance(from: loc2)
    }

    /// Computes walking time in minutes based on average 80 meters/min (~4.8 km/h) walking speed
    public static func walkingMinutes(distanceInMeters: Double) -> Int {
        max(1, Int((distanceInMeters / 80.0).rounded()))
    }
}
