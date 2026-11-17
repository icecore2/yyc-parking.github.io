import Foundation
#if canImport(SwiftUI)
import SwiftUI
#endif

public enum ProviderCategory: String, Codable, Sendable {
    case municipal = "MUNICIPAL"
    case transit = "TRANSIT"
    case commercial = "COMMERCIAL"
}

public enum ProviderId: String, CaseIterable, Identifiable, Codable, Sendable {
    case parkplusOnStreet = "parkplus_on_street"
    case cpaOffStreet = "cpa_off_street"
    case calgaryTransit = "calgary_transit"
    case impark = "impark"
    case indigo = "indigo"
    case preciseParklink = "precise_parklink"

    public var id: String { rawValue }
}

public struct ParkingProvider: Identifiable, Sendable {
    public let id: ProviderId
    public let name: String
    public let shortName: String
    public let category: ProviderCategory
    public let `operator`: String
    public let colorHex: String
    public let borderHex: String
    public let paymentApp: String
    public let paymentUrl: String
    public let description: String
    public let systemImage: String

#if canImport(SwiftUI)
    public var color: Color {
        Color(hex: colorHex)
    }

    public var borderColor: Color {
        Color(hex: borderHex)
    }
#endif
}

public enum ProviderRegistry {
    public static let all: [ProviderId: ParkingProvider] = [
        .parkplusOnStreet: ParkingProvider(
            id: .parkplusOnStreet,
            name: "ParkPlus On-Street",
            shortName: "ParkPlus",
            category: .municipal,
            operator: "Calgary Parking Authority",
            colorHex: "#10b981",
            borderHex: "#047857",
            paymentApp: "MyParking / ParkPlus",
            paymentUrl: "https://www.calgaryparking.com/parkplus",
            description: "Curbside metered on-street parking across Calgary",
            systemImage: "parkingsign"
        ),
        .cpaOffStreet: ParkingProvider(
            id: .cpaOffStreet,
            name: "City Parkades & Surface Lots",
            shortName: "City Lots",
            category: .municipal,
            operator: "Calgary Parking Authority",
            colorHex: "#2563eb",
            borderHex: "#1d4ed8",
            paymentApp: "MyParking / ParkPlus",
            paymentUrl: "https://www.calgaryparking.com/find-parking/lots-and-parkades",
            description: "Municipal off-street parkades and surface lots",
            systemImage: "building.2"
        ),
        .calgaryTransit: ParkingProvider(
            id: .calgaryTransit,
            name: "Calgary Transit Park & Ride",
            shortName: "Transit",
            category: .transit,
            operator: "Calgary Transit",
            colorHex: "#dc2626",
            borderHex: "#b91c1c",
            paymentApp: "Calgary Transit / CPA",
            paymentUrl: "https://www.calgarytransit.com/content/transit/en/home/rider-information/parking.html",
            description: "CTrain station parking (free & reserved stalls)",
            systemImage: "tram.fill"
        ),
        .impark: ParkingProvider(
            id: .impark,
            name: "Impark (Reef Parking)",
            shortName: "Impark",
            category: .commercial,
            operator: "Impark / Reef",
            colorHex: "#0284c7",
            borderHex: "#0369a1",
            paymentApp: "hangTag",
            paymentUrl: "https://www.hangtag.io/",
            description: "Commercial lots and downtown parkades",
            systemImage: "creditcard.fill"
        ),
        .indigo: ParkingProvider(
            id: .indigo,
            name: "Indigo Park",
            shortName: "Indigo",
            category: .commercial,
            operator: "Indigo Park Canada",
            colorHex: "#7c3aed",
            borderHex: "#6d28d9",
            paymentApp: "Indigo Neo",
            paymentUrl: "https://indigoneo.ca/",
            description: "Commercial parkades and major office towers",
            systemImage: "building.columns.fill"
        ),
        .preciseParklink: ParkingProvider(
            id: .preciseParklink,
            name: "Precise ParkLink",
            shortName: "ParkLink",
            category: .commercial,
            operator: "Precise ParkLink",
            colorHex: "#ea580c",
            borderHex: "#c2410c",
            paymentApp: "Parkedin",
            paymentUrl: "https://parkedin.com/",
            description: "Campus, institutional, and commercial facilities",
            systemImage: "car.circle.fill"
        )
    ]

    public static func provider(for id: ProviderId) -> ParkingProvider {
        all[id] ?? all[.parkplusOnStreet]!
    }

    public static func provider(for rawString: String) -> ParkingProvider {
        guard let id = ProviderId(rawValue: rawString) else {
            return all[.parkplusOnStreet]!
        }
        return provider(for: id)
    }
}

public struct TransitStationSeed: Identifiable, Sendable {
    public let id: String
    public let name: String
    public let stalls: Int
    public let coordinate: CLLocationCoordinate2D
    public let leg: String
    public let reservedFee: String

    public init(name: String, stalls: Int, lat: Double, lng: Double, leg: String, reservedFee: String) {
        self.id = "transit_\(name.lowercased().replacingOccurrences(of: " ", with: "_"))"
        self.name = name
        self.stalls = stalls
        self.coordinate = CLLocationCoordinate2D(latitude: lat, longitude: lng)
        self.leg = leg
        self.reservedFee = reservedFee
    }
}

public enum TransitSeedData {
    public static let stations: [TransitStationSeed] = [
        // South Red Line
        TransitStationSeed(name: "Somerset-Bridlewood", stalls: 917, lat: 50.8992, lng: -114.0700, leg: "South", reservedFee: "$85/mo"),
        TransitStationSeed(name: "Shawnessy", stalls: 500, lat: 50.9100, lng: -114.0683, leg: "South", reservedFee: "$85/mo"),
        TransitStationSeed(name: "Fish Creek-Lacombe", stalls: 545, lat: 50.9239, lng: -114.0728, leg: "South", reservedFee: "$85/mo"),
        TransitStationSeed(name: "Canyon Meadows", stalls: 275, lat: 50.9365, lng: -114.0703, leg: "South", reservedFee: "$85/mo"),
        TransitStationSeed(name: "Anderson", stalls: 1729, lat: 50.9568, lng: -114.0683, leg: "South", reservedFee: "$85/mo"),
        TransitStationSeed(name: "Southland", stalls: 630, lat: 50.9639, lng: -114.0722, leg: "South", reservedFee: "$85/mo"),
        TransitStationSeed(name: "Heritage", stalls: 605, lat: 50.9786, lng: -114.0747, leg: "South", reservedFee: "$85/mo"),
        TransitStationSeed(name: "Chinook", stalls: 367, lat: 50.9972, lng: -114.0689, leg: "South", reservedFee: "$85/mo"),

        // NW Red Line
        TransitStationSeed(name: "Tuscany", stalls: 544, lat: 51.1158, lng: -114.2289, leg: "NW", reservedFee: "$85/mo"),
        TransitStationSeed(name: "Crowfoot", stalls: 1345, lat: 51.1278, lng: -114.2081, leg: "NW", reservedFee: "$85/mo"),
        TransitStationSeed(name: "Dalhousie", stalls: 760, lat: 51.1033, lng: -114.1606, leg: "NW", reservedFee: "$85/mo"),
        TransitStationSeed(name: "Brentwood", stalls: 947, lat: 51.0875, lng: -114.1331, leg: "NW", reservedFee: "$85/mo"),
        TransitStationSeed(name: "University", stalls: 230, lat: 51.0797, lng: -114.1239, leg: "NW", reservedFee: "$85/mo"),

        // West Blue Line
        TransitStationSeed(name: "69 Street", stalls: 808, lat: 51.0375, lng: -114.1869, leg: "West", reservedFee: "$85/mo"),
        TransitStationSeed(name: "Sirocco", stalls: 350, lat: 51.0378, lng: -114.1681, leg: "West", reservedFee: "$85/mo"),
        TransitStationSeed(name: "Westbrook", stalls: 164, lat: 51.0422, lng: -114.1394, leg: "West", reservedFee: "$85/mo"),

        // NE / East Blue Line
        TransitStationSeed(name: "Saddletowne", stalls: 140, lat: 51.1256, lng: -113.9483, leg: "NE", reservedFee: "$85/mo"),
        TransitStationSeed(name: "McKnight-Westwinds", stalls: 963, lat: 51.0964, lng: -113.9781, leg: "NE", reservedFee: "$85/mo"),
        TransitStationSeed(name: "Whitehorn", stalls: 826, lat: 51.0858, lng: -113.9883, leg: "NE", reservedFee: "$85/mo"),
        TransitStationSeed(name: "Rundle", stalls: 400, lat: 51.0744, lng: -113.9986, leg: "NE", reservedFee: "$85/mo"),
        TransitStationSeed(name: "Marlborough", stalls: 485, lat: 51.0583, lng: -113.9822, leg: "NE", reservedFee: "$85/mo"),
        TransitStationSeed(name: "Barlow / Max Bell", stalls: 50, lat: 51.0456, lng: -114.0108, leg: "East", reservedFee: "Free"),
        TransitStationSeed(name: "Franklin", stalls: 530, lat: 51.0489, lng: -114.0200, leg: "East", reservedFee: "$85/mo")
    ]
}

#if canImport(SwiftUI)
// SwiftUI Color extension for Hex strings
extension Color {
    public init(hex: String) {
        let cleanHex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: cleanHex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch cleanHex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
#endif
