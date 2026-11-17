import Foundation
#if canImport(SwiftUI)
import SwiftUI
#endif

public enum ParkingGeometryType: Sendable {
    case onStreetPolyline([[CLLocationCoordinate2D]])
    case offStreetPolygon([CLLocationCoordinate2D])
    case point(CLLocationCoordinate2D)
}

public struct RateInterval: Identifiable, Sendable {
    public let id: String
    public let header: String
    public let rateText: String
    public let price: Double
    public let isFree: Bool
    public let isNoParking: Bool
    public let startMinutes: Int
    public let endMinutes: Int
    public let appliesDays: String // "weekday", "saturday", "sunday", "all"

    public init(
        header: String,
        rateText: String,
        price: Double,
        isFree: Bool,
        isNoParking: Bool,
        startMinutes: Int,
        endMinutes: Int,
        appliesDays: String
    ) {
        self.id = "\(header)_\(rateText)_\(startMinutes)_\(endMinutes)"
        self.header = header
        self.rateText = rateText
        self.price = price
        self.isFree = isFree
        self.isNoParking = isNoParking
        self.startMinutes = startMinutes
        self.endMinutes = endMinutes
        self.appliesDays = appliesDays
    }
}

public struct ZoneRateInfo: Sendable {
    public var currentRate: Double?
    public var maxRate: Double
    public var minRate: Double
    public var isCurrentlyFree: Bool
    public var currentSlotLabel: String
    public var isNoParkingNow: Bool
    public var intervals: [RateInterval]

    public init(
        currentRate: Double? = 0.0,
        maxRate: Double = 0.0,
        minRate: Double = 0.0,
        isCurrentlyFree: Bool = false,
        currentSlotLabel: String = "Free Parking",
        isNoParkingNow: Bool = false,
        intervals: [RateInterval] = []
    ) {
        self.currentRate = currentRate
        self.maxRate = maxRate
        self.minRate = minRate
        self.isCurrentlyFree = isCurrentlyFree
        self.currentSlotLabel = currentSlotLabel
        self.isNoParkingNow = isNoParkingNow
        self.intervals = intervals
    }
}

public struct ParkingZone: Identifiable, Sendable {
    public let id: String
    public let providerId: ProviderId
    public let zoneNumber: String
    public let name: String
    public let address: String
    public let blockSide: String
    public let zoneType: String
    public let stallType: String
    public let zoneCapacity: Int
    public let segCapacity: Int
    public let zoneLength: Int
    public let segLength: Int
    public let brzName: String
    public let priceZone: String
    public let maxTime: Int
    public let enforceableTime: String
    public let htmlRates: String
    public var rateInfo: ZoneRateInfo
    public let restrictTime: String
    public let restrictType: String
    public let noParking: String
    public let noStopping: String
    public let permitZone: String
    public let comments: String
    public let globalId: String
    public let status: String

    // Commercial / Off-Street Extra Fields
    public let facilityType: String?
    public let paymentApp: String?
    public let paymentUrl: String?
    public let `operator`: String?
    public let heightLimit: String?
    public let amenities: [String]

    // Geometry
    public let midpoint: CLLocationCoordinate2D
    public let geometry: ParkingGeometryType

    // Computed / Dynamic State
    public var distanceToTarget: Double?
    public var walkingMinutes: Int?

    public init(
        id: String,
        providerId: ProviderId,
        zoneNumber: String,
        name: String,
        address: String,
        blockSide: String = "",
        zoneType: String = "Parking Zone",
        stallType: String = "Parallel",
        zoneCapacity: Int = 0,
        segCapacity: Int = 0,
        zoneLength: Int = 0,
        segLength: Int = 0,
        brzName: String = "None",
        priceZone: String = "Standard",
        maxTime: Int = 0,
        enforceableTime: String = "",
        htmlRates: String = "",
        rateInfo: ZoneRateInfo = ZoneRateInfo(),
        restrictTime: String = "none",
        restrictType: String = "none",
        noParking: String = "",
        noStopping: String = "",
        permitZone: String = "",
        comments: String = "",
        globalId: String = "",
        status: String = "Active",
        facilityType: String? = nil,
        paymentApp: String? = nil,
        paymentUrl: String? = nil,
        operator: String? = nil,
        heightLimit: String? = nil,
        amenities: [String] = [],
        midpoint: CLLocationCoordinate2D,
        geometry: ParkingGeometryType,
        distanceToTarget: Double? = nil,
        walkingMinutes: Int? = nil
    ) {
        self.id = id
        self.providerId = providerId
        self.zoneNumber = zoneNumber
        self.name = name
        self.address = address
        self.blockSide = blockSide
        self.zoneType = zoneType
        self.stallType = stallType
        self.zoneCapacity = zoneCapacity
        self.segCapacity = segCapacity
        self.zoneLength = zoneLength
        self.segLength = segLength
        self.brzName = brzName
        self.priceZone = priceZone
        self.maxTime = maxTime
        self.enforceableTime = enforceableTime
        self.htmlRates = htmlRates
        self.rateInfo = rateInfo
        self.restrictTime = restrictTime
        self.restrictType = restrictType
        self.noParking = noParking
        self.noStopping = noStopping
        self.permitZone = permitZone
        self.comments = comments
        self.globalId = globalId
        self.status = status
        self.facilityType = facilityType
        self.paymentApp = paymentApp
        self.paymentUrl = paymentUrl
        self.operator = `operator`
        self.heightLimit = heightLimit
        self.amenities = amenities
        self.midpoint = midpoint
        self.geometry = geometry
        self.distanceToTarget = distanceToTarget
        self.walkingMinutes = walkingMinutes
    }
}

// MARK: - Enums for Filtering & Sorting

public enum RateCalculationMode: String, CaseIterable, Identifiable, Sendable {
    case max = "max"
    case live = "live"

    public var id: String { rawValue }
    public var title: String {
        switch self {
        case .max: return "Peak Daytime Rate"
        case .live: return "Live Rate (Now)"
        }
    }
}

public enum PriceFilterTier: String, CaseIterable, Identifiable, Sendable {
    case all = "ALL"
    case free = "free"
    case one = "1"
    case two = "2"
    case three = "3"
    case four = "4"
    case five = "5"

    public var id: String { rawValue }
    public var title: String {
        switch self {
        case .all: return "All Rates"
        case .free: return "Free Parking Only"
        case .one: return "≤ $1.00 / hr"
        case .two: return "≤ $2.00 / hr"
        case .three: return "≤ $3.00 / hr"
        case .four: return "≤ $4.00 / hr"
        case .five: return "≤ $5.00 / hr"
        }
    }

    public var numericCap: Double? {
        switch self {
        case .all, .free: return nil
        case .one: return 1.0
        case .two: return 2.0
        case .three: return 3.0
        case .four: return 4.0
        case .five: return 5.0
        }
    }
}

public enum SortCriterion: String, CaseIterable, Identifiable, Sendable {
    case closestCheapest = "closest_cheapest"
    case closest = "closest"
    case cheapest = "cheapest"

    public var id: String { rawValue }
    public var title: String {
        switch self {
        case .closestCheapest: return "Best Value (Distance + Price)"
        case .closest: return "Closest First"
        case .cheapest: return "Cheapest First"
        }
    }
}

public enum RadiusFilter: String, CaseIterable, Identifiable, Sendable {
    case r300 = "300"
    case r500 = "500"
    case r1000 = "1000"
    case r2000 = "2000"
    case all = "ALL"

    public var id: String { rawValue }
    public var title: String {
        switch self {
        case .r300: return "300 meters (~4 min)"
        case .r500: return "500 meters (~6 min)"
        case .r1000: return "1.0 km (~12 min)"
        case .r2000: return "2.0 km (~25 min)"
        case .all: return "No Distance Limit"
        }
    }

    public var meters: Double? {
        switch self {
        case .r300: return 300.0
        case .r500: return 500.0
        case .r1000: return 1000.0
        case .r2000: return 2000.0
        case .all: return nil
        }
    }
}

public struct CustomLocation: Identifiable, Codable, Equatable, Sendable {
    public let id: String
    public var name: String
    public var latitude: Double
    public var longitude: Double

    public var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    public init(id: String = UUID().uuidString, name: String, latitude: Double, longitude: Double) {
        self.id = id
        self.name = name
        self.latitude = latitude
        self.longitude = longitude
    }
}

public enum DayScheduleType: String, CaseIterable, Identifiable, Sendable {
    case weekday = "weekday"
    case saturday = "saturday"
    case sunday = "sunday"

    public var id: String { rawValue }
    public var title: String {
        switch self {
        case .weekday: return "Mon–Fri"
        case .saturday: return "Saturday"
        case .sunday: return "Sun / Holiday"
        }
    }
}

public struct HourlyRatePoint: Identifiable, Sendable {
    public var id: Int { hour }
    public let hour: Int
    public let hourLabel: String
    public let rate: Double?
    public let isRestricted: Bool
    public let label: String

    public init(hour: Int, hourLabel: String, rate: Double?, isRestricted: Bool, label: String) {
        self.hour = hour
        self.hourLabel = hourLabel
        self.rate = rate
        self.isRestricted = isRestricted
        self.label = label
    }
}

public struct HistoricalDataPoint: Identifiable, Sendable {
    public var id: String { period }
    public let period: String
    public let rate: Double
    public let isLocalSnapshot: Bool
    public let timestamp: Date?

    public init(period: String, rate: Double, isLocalSnapshot: Bool = false, timestamp: Date? = nil) {
        self.period = period
        self.rate = rate
        self.isLocalSnapshot = isLocalSnapshot
        self.timestamp = timestamp
    }
}
