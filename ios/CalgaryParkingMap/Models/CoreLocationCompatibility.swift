import Foundation

#if canImport(CoreLocation)
@_exported import CoreLocation
#else
public struct CLLocationCoordinate2D: Sendable, Equatable {
    public var latitude: Double
    public var longitude: Double

    public init(latitude: Double, longitude: Double) {
        self.latitude = latitude
        self.longitude = longitude
    }
}

public class CLLocation: @unchecked Sendable {
    public let coordinate: CLLocationCoordinate2D

    public init(latitude: Double, longitude: Double) {
        self.coordinate = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    public func distance(from other: CLLocation) -> Double {
        let lat1 = self.coordinate.latitude * .pi / 180.0
        let lon1 = self.coordinate.longitude * .pi / 180.0
        let lat2 = other.coordinate.latitude * .pi / 180.0
        let lon2 = other.coordinate.longitude * .pi / 180.0

        let dLat = lat2 - lat1
        let dLon = lon2 - lon1

        let a = sin(dLat / 2) * sin(dLat / 2) + cos(lat1) * cos(lat2) * sin(dLon / 2) * sin(dLon / 2)
        let c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return 6371000.0 * c // Earth radius in meters
    }
}
#endif
