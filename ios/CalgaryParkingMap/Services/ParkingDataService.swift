import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking

extension URLSession {
    public func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        return try await withCheckedThrowingContinuation { continuation in
            let task = self.dataTask(with: request) { data, response, error in
                if let error = error {
                    continuation.resume(throwing: error)
                } else if let data = data, let response = response {
                    continuation.resume(returning: (data, response))
                } else {
                    continuation.resume(throwing: URLError(.unknown))
                }
            }
            task.resume()
        }
    }
}
#endif
#if canImport(CoreLocation)
import CoreLocation
#endif

// MARK: - Decodable Structs for ArcGIS API

private struct ArcGISResponse: Decodable {
    let features: [ArcGISFeature]?
}

private struct ArcGISFeature: Decodable {
    let attributes: ArcGISAttributes?
    let geometry: ArcGISGeometry?
}

private struct ArcGISAttributes: Decodable {
    let OBJECTID: Int?
    let PARKING_ZONE: StringOrInt?
    let ADDRESS_DESC: String?
    let BLOCK_SIDE: String?
    let ZONE_TYPE: String?
    let STALL_TYPE: String?
    let ZONE_CAP: Int?
    let SEG_CAP: Int?
    let ZONE_LENGTH: Double?
    let SEG_LENGTH: Double?
    let BRZ_NAME: String?
    let PRICE_ZONE: String?
    let MAX_TIME: Int?
    let ENFORCEABLE_TIME: String?
    let HTML_ZONE_RATE: String?
    let PARKING_RESTRICT_TIME: String?
    let PARKING_RESTRICT_TYPE: String?
    let NO_PARKING: String?
    let NO_STOPPING: String?
    let PERMIT_ZONE: String?
    let COMMENTS: String?
    let GLOBALID: String?
    let STATUS: String?
}

private enum StringOrInt: Decodable {
    case string(String)
    case int(Int)

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let val = try? container.decode(String.self) {
            self = .string(val)
        } else if let val = try? container.decode(Int.self) {
            self = .int(val)
        } else {
            self = .string("")
        }
    }

    var value: String {
        switch self {
        case .string(let s): return s
        case .int(let i): return String(i)
        }
    }
}

private struct ArcGISGeometry: Decodable {
    let paths: [[[Double]]]?
    let coordinates: [[[Double]]]?
}

// MARK: - Decodable Structs for Socrata API

private struct SocrataParkadeItem: Decodable {
    let globalid: String?
    let lot_num: String?
    let lot_name: String?
    let address_desc: String?
    let parking_type: String?
    let stall_type: String?
    let home_page: SocrataHomePage?
    let multipolygon: SocrataMultipolygon?
}

private struct SocrataHomePage: Decodable {
    let url: String?
}

private struct SocrataMultipolygon: Decodable {
    let type: String?
    // Geometry can be MultiPolygon (4 levels) or Polygon (3 levels)
    // We decode generic JSON array
    let coordinates: [[[[Double]]]]?
}

// MARK: - Decodable Structs for Commercial JSON

private struct CommercialItem: Decodable {
    let id: String
    let providerId: String
    let facilityType: String?
    let name: String
    let lotNumber: String?
    let paymentCode: String?
    let address: String
    let coordinates: [Double] // [lng, lat]
    let capacity: Int?
    let stallType: String?
    let heightLimit: String?
    let ratesSummary: String?
    let paymentApp: String?
    let paymentUrl: String?
    let `operator`: String?
    let amenities: [String]?
}

// MARK: - Service Implementation

public actor ParkingDataService {
    public static let shared = ParkingDataService()

    public static let defaultArcGISUrl = "https://services1.arcgis.com/AVP60cs0Q9PEA8rH/arcgis/rest/services/Calgary_Parking_Authority_On_Street_Parking_Zones_with_Rates/FeatureServer/0/query?where=1%3D1&outFields=*&resultRecordCount=20000&f=json"
    public static let socrataUrl = "https://data.calgary.ca/resource/ggxk-g2u3.json?$limit=500"

    private let urlSession: URLSession

    public init(session: URLSession = .shared) {
        self.urlSession = session
    }

    public func fetchAll(arcGisUrl: String = defaultArcGISUrl) async -> [ParkingZone] {
        async let onStreetTask = fetchOnStreet(url: arcGisUrl)
        async let offStreetTask = fetchOffStreet()
        async let transitTask = fetchTransit()
        async let commercialTask = fetchCommercial()

        let onStreet = (try? await onStreetTask) ?? []
        let offStreet = (try? await offStreetTask) ?? []
        let transit = await transitTask
        let commercial = await commercialTask

        return onStreet + offStreet + transit + commercial
    }

    public func fetchOnStreet(url: String) async throws -> [ParkingZone] {
        guard let requestUrl = URL(string: url) else { return [] }
        var request = URLRequest(url: requestUrl)
        request.timeoutInterval = 35.0

        let (data, response) = try await urlSession.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            return []
        }

        let decoded = try JSONDecoder().decode(ArcGISResponse.self, from: data)
        guard let features = decoded.features else { return [] }

        var result: [ParkingZone] = []

        for (index, feat) in features.enumerated() {
            guard let attrs = feat.attributes else { continue }
            let status = (attrs.STATUS ?? "Active").trimmingCharacters(in: .whitespacesAndNewlines)
            if status.lowercased() == "removed" || status.lowercased() == "inactive" {
                continue
            }

            var lineSegments: [[CLLocationCoordinate2D]] = []
            let rawPaths = feat.geometry?.paths ?? feat.geometry?.coordinates ?? []

            for path in rawPaths {
                var segment: [CLLocationCoordinate2D] = []
                for pt in path {
                    if pt.count >= 2 {
                        let coord = CoordinateUtils.normalizeCoord(x: pt[0], y: pt[1])
                        segment.append(coord)
                    }
                }
                if segment.count >= 2 {
                    lineSegments.append(segment)
                }
            }

            guard let firstSeg = lineSegments.first, !firstSeg.isEmpty else {
                continue
            }

            let midpoint = CoordinateUtils.getPolylineMidpoint(firstSeg)
            let zoneNum = attrs.PARKING_ZONE?.value ?? "N/A"
            let htmlRates = attrs.HTML_ZONE_RATE ?? ""
            let rateInfo = RateParser.parseZoneRateSchedule(htmlRates)

            let id = attrs.GLOBALID ?? (attrs.OBJECTID != nil ? "onstreet_\(attrs.OBJECTID!)" : "onstreet_\(index)")

            let zone = ParkingZone(
                id: id,
                providerId: .parkplusOnStreet,
                zoneNumber: zoneNum,
                name: "Zone #\(zoneNum)",
                address: attrs.ADDRESS_DESC ?? "Unknown Location",
                blockSide: attrs.BLOCK_SIDE ?? "",
                zoneType: attrs.ZONE_TYPE ?? "Parking Zone",
                stallType: attrs.STALL_TYPE ?? "Parallel",
                zoneCapacity: attrs.ZONE_CAP ?? 0,
                segCapacity: attrs.SEG_CAP ?? 0,
                zoneLength: Int((attrs.ZONE_LENGTH ?? 0).rounded()),
                segLength: Int((attrs.SEG_LENGTH ?? 0).rounded()),
                brzName: (attrs.BRZ_NAME?.isEmpty == false) ? attrs.BRZ_NAME! : "None",
                priceZone: attrs.PRICE_ZONE ?? "Standard",
                maxTime: attrs.MAX_TIME ?? 0,
                enforceableTime: attrs.ENFORCEABLE_TIME ?? "",
                htmlRates: htmlRates,
                rateInfo: rateInfo,
                restrictTime: attrs.PARKING_RESTRICT_TIME ?? "none",
                restrictType: attrs.PARKING_RESTRICT_TYPE ?? "none",
                noParking: attrs.NO_PARKING ?? "",
                noStopping: attrs.NO_STOPPING ?? "",
                permitZone: attrs.PERMIT_ZONE ?? "",
                comments: attrs.COMMENTS ?? "",
                globalId: attrs.GLOBALID ?? "",
                status: status,
                facilityType: "ON-STREET",
                paymentApp: "MyParking / ParkPlus",
                paymentUrl: "https://www.calgaryparking.com/parkplus",
                operator: "Calgary Parking Authority",
                midpoint: midpoint,
                geometry: .onStreetPolyline(lineSegments)
            )

            result.append(zone)
        }

        return result
    }

    public func fetchOffStreet() async throws -> [ParkingZone] {
        guard let requestUrl = URL(string: Self.socrataUrl) else { return [] }
        var request = URLRequest(url: requestUrl)
        request.timeoutInterval = 20.0

        let (data, response) = try await urlSession.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            return []
        }

        // Decode as generic JSON array
        guard let jsonArray = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return []
        }

        var result: [ParkingZone] = []

        for (index, item) in jsonArray.enumerated() {
            var polygonCoords: [CLLocationCoordinate2D] = []

            if let multipolygon = item["multipolygon"] as? [String: Any],
               let coordinates = multipolygon["coordinates"] as? [Any] {
                // Determine structure: MultiPolygon (coordinates[0][0]) or Polygon (coordinates[0])
                var ring: [[Double]] = []
                if let multi = coordinates as? [[[[Double]]]], let firstPoly = multi.first, let firstRing = firstPoly.first {
                    ring = firstRing
                } else if let poly = coordinates as? [[[Double]]], let firstRing = poly.first {
                    ring = firstRing
                }

                for pt in ring {
                    if pt.count >= 2 {
                        // Socrata GeoJSON is [lng, lat]
                        polygonCoords.append(CLLocationCoordinate2D(latitude: pt[1], longitude: pt[0]))
                    }
                }
            }

            guard !polygonCoords.isEmpty else { continue }
            let midpoint = CoordinateUtils.getPolygonCentroid(polygonCoords)

            let pType = (item["parking_type"] as? String ?? "").uppercased()
            let isParkade = pType.contains("PARKADE")
            let facilityType = isParkade ? "PARKADE" : "SURFACE LOT"
            let capacity = isParkade ? 350 : 120
            let currentRate = isParkade ? 3.50 : 2.50
            let maxRate = isParkade ? 4.50 : 3.50

            let lotNum = item["lot_num"] as? String ?? "N/A"
            let lotName = item["lot_name"] as? String ?? "Lot #\(lotNum)"
            let address = item["address_desc"] as? String ?? "Calgary, AB"
            let stallType = item["stall_type"] as? String ?? "Stalls"
            let globalId = item["globalid"] as? String ?? "cpa_lot_\(index)"

            var homePageUrl = "https://www.calgaryparking.com/find-parking/lots-and-parkades"
            if let hp = item["home_page"] as? [String: Any], let u = hp["url"] as? String, !u.isEmpty {
                homePageUrl = u
            }

            let rateInfo = ZoneRateInfo(
                currentRate: currentRate,
                maxRate: maxRate,
                minRate: 1.50,
                isCurrentlyFree: false,
                currentSlotLabel: "Standard Daytime Rate: $\(String(format: "%.2f", currentRate))/hr",
                isNoParkingNow: false,
                intervals: [
                    RateInterval(
                        header: "Mon-Fri 06:00 AM to 06:00 PM",
                        rateText: "$\(String(format: "%.2f", maxRate)) per Hour",
                        price: maxRate,
                        isFree: false,
                        isNoParking: false,
                        startMinutes: 360,
                        endMinutes: 1080,
                        appliesDays: "weekday"
                    ),
                    RateInterval(
                        header: "Evenings & Weekends",
                        rateText: "$\(String(format: "%.2f", currentRate)) per Hour",
                        price: currentRate,
                        isFree: false,
                        isNoParking: false,
                        startMinutes: 1080,
                        endMinutes: 1440,
                        appliesDays: "all"
                    )
                ]
            )

            let zone = ParkingZone(
                id: globalId,
                providerId: .cpaOffStreet,
                zoneNumber: lotNum,
                name: lotName,
                address: address,
                zoneType: facilityType,
                stallType: stallType,
                zoneCapacity: capacity,
                segCapacity: capacity,
                zoneLength: 0,
                segLength: 0,
                brzName: "Downtown Core",
                priceZone: isParkade ? "Tier 4" : "Tier 3",
                maxTime: 720,
                enforceableTime: "0600-2200 Mon-Sun",
                htmlRates: "Daytime: $\(String(format: "%.2f", maxRate))/hr<br>Evening: $\(String(format: "%.2f", currentRate))/hr",
                rateInfo: rateInfo,
                restrictTime: "none",
                restrictType: "none",
                noParking: "",
                noStopping: "",
                permitZone: "",
                comments: "Calgary Parking Authority Municipal Facility",
                globalId: globalId,
                status: "Active",
                facilityType: facilityType,
                paymentApp: "MyParking / ParkPlus",
                paymentUrl: homePageUrl,
                operator: "Calgary Parking Authority",
                heightLimit: isParkade ? "2.05 m (6'9\")" : "Open / No Limit",
                amenities: isParkade ? ["EV Charging", "Elevator", "CCTV", "Underground/Covered"] : ["Surface Parking", "Pay Machine"],
                midpoint: midpoint,
                geometry: .offStreetPolygon(polygonCoords)
            )

            result.append(zone)
        }

        return result
    }

    public func fetchTransit() -> [ParkingZone] {
        TransitSeedData.stations.map { stn in
            let rateInfo = ZoneRateInfo(
                currentRate: 0.0,
                maxRate: 0.0,
                minRate: 0.0,
                isCurrentlyFree: true,
                currentSlotLabel: "Free Commuter Parking (\(stn.reservedFee) Reserved)",
                isNoParkingNow: false,
                intervals: [
                    RateInterval(
                        header: "Mon-Sun All Day",
                        rateText: "Free (Reserved fee \(stn.reservedFee))",
                        price: 0.0,
                        isFree: true,
                        isNoParking: false,
                        startMinutes: 0,
                        endMinutes: 1440,
                        appliesDays: "all"
                    )
                ]
            )

            return ParkingZone(
                id: stn.id,
                providerId: .calgaryTransit,
                zoneNumber: stn.name,
                name: "\(stn.name) CTrain Station",
                address: "\(stn.name) Station, Calgary, AB",
                zoneType: "Park & Ride",
                stallType: "Park & Ride Stalls",
                zoneCapacity: stn.stalls,
                segCapacity: stn.stalls,
                zoneLength: 0,
                segLength: 0,
                brzName: "\(stn.leg) CTrain Corridor",
                priceZone: "Transit Free",
                maxTime: 1440,
                enforceableTime: "0200-1100 (Mon-Fri Reserved Stalls)",
                htmlRates: "Free Parking<br>Reserved stalls \(stn.reservedFee)",
                rateInfo: rateInfo,
                restrictTime: "none",
                restrictType: "none",
                noParking: "",
                noStopping: "",
                permitZone: "Transit Permit Required 2am-11am for Reserved Stalls",
                comments: "Calgary Transit Light Rail Commuter Park and Ride Facility",
                globalId: stn.id,
                status: "Active",
                facilityType: "TRANSIT LOT",
                paymentApp: "Calgary Transit / CPA",
                paymentUrl: "https://www.calgarytransit.com/content/transit/en/home/rider-information/parking.html",
                operator: "Calgary Transit",
                heightLimit: "Open / Surface Lot",
                amenities: ["Direct CTrain Connection", "Heated Waiting Area", "Bus Loop", "Bike Racks"],
                midpoint: stn.coordinate,
                geometry: .point(stn.coordinate)
            )
        }
    }

    public func fetchCommercial(bundle: Bundle = .main) -> [ParkingZone] {
        guard let url = bundle.url(forResource: "commercial_parking", withExtension: "json") ??
              Bundle.module.url(forResource: "commercial_parking", withExtension: "json") ??
              Bundle.main.url(forResource: "commercial_parking", withExtension: "json", subdirectory: "Resources"),
              let data = try? Data(contentsOf: url),
              let list = try? JSONDecoder().decode([CommercialItem].self, from: data) else {
            return []
        }

        return list.compactMap { item in
            guard item.coordinates.count >= 2 else { return nil }
            // JSON is [lng, lat]
            let coord = CLLocationCoordinate2D(latitude: item.coordinates[1], longitude: item.coordinates[0])
            let providerId = ProviderId(rawValue: item.providerId) ?? .impark
            let provider = ProviderRegistry.provider(for: providerId)

            let hourlyRate = RateParser.extractCommercialRate(
                ratesSummary: item.ratesSummary ?? "",
                facilityType: item.facilityType
            )

            let rateInfo = ZoneRateInfo(
                currentRate: hourlyRate,
                maxRate: hourlyRate,
                minRate: hourlyRate,
                isCurrentlyFree: false,
                currentSlotLabel: item.ratesSummary ?? "$\(String(format: "%.2f", hourlyRate))/hr",
                isNoParkingNow: false,
                intervals: [
                    RateInterval(
                        header: "Mon-Sun Daily",
                        rateText: "$\(String(format: "%.2f", hourlyRate)) per Hour",
                        price: hourlyRate,
                        isFree: false,
                        isNoParking: false,
                        startMinutes: 0,
                        endMinutes: 1440,
                        appliesDays: "all"
                    )
                ]
            )

            return ParkingZone(
                id: item.id,
                providerId: providerId,
                zoneNumber: item.lotNumber ?? item.paymentCode ?? item.id,
                name: item.name,
                address: item.address,
                zoneType: item.facilityType ?? "COMMERCIAL LOT",
                stallType: item.stallType ?? "Stalls",
                zoneCapacity: item.capacity ?? 0,
                segCapacity: item.capacity ?? 0,
                zoneLength: 0,
                segLength: 0,
                brzName: "Commercial District",
                priceZone: "Commercial",
                maxTime: 1440,
                enforceableTime: "24/7 Enforced",
                htmlRates: item.ratesSummary ?? "$\(String(format: "%.2f", hourlyRate))/hr",
                rateInfo: rateInfo,
                restrictTime: "none",
                restrictType: "none",
                noParking: "",
                noStopping: "",
                permitZone: "",
                comments: "Commercial Parking Facility operated by \(item.operator ?? provider.name)",
                globalId: item.id,
                status: "Active",
                facilityType: item.facilityType,
                paymentApp: item.paymentApp ?? provider.paymentApp,
                paymentUrl: item.paymentUrl ?? provider.paymentUrl,
                operator: item.operator ?? provider.operator,
                heightLimit: item.heightLimit,
                amenities: item.amenities ?? [],
                midpoint: coord,
                geometry: .point(coord)
            )
        }
    }
}
