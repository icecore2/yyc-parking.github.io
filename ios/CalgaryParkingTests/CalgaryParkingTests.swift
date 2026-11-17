import XCTest
#if canImport(CoreLocation)
import CoreLocation
#endif
@testable import CalgaryParkingCore

final class CalgaryParkingTests: XCTestCase {

    // MARK: - Provider Registry Tests

    func testProviderRegistryCompleteness() {
        XCTAssertEqual(ProviderRegistry.all.count, 6)
        let expectedIds: [ProviderId] = [
            .parkplusOnStreet,
            .cpaOffStreet,
            .calgaryTransit,
            .impark,
            .indigo,
            .preciseParklink
        ]
        for id in expectedIds {
            let p = ProviderRegistry.provider(for: id)
            XCTAssertEqual(p.id, id)
            XCTAssertFalse(p.name.isEmpty)
            XCTAssertFalse(p.operator.isEmpty)
            XCTAssertTrue(p.colorHex.starts(with: "#"))
        }
    }

    func testProviderFallback() {
        let fallback = ProviderRegistry.provider(for: "non_existent_provider_id")
        XCTAssertEqual(fallback.id, .parkplusOnStreet)
    }

    // MARK: - Transit Data Tests

    func testTransitStationsInventory() {
        let stations = TransitSeedData.stations
        XCTAssertGreaterThanOrEqual(stations.count, 20)
        var totalStalls = 0

        for stn in stations {
            XCTAssertFalse(stn.name.isEmpty)
            XCTAssertGreaterThan(stn.stalls, 0)
            totalStalls += stn.stalls

            // Bounding box check for Calgary Transit
            XCTAssertGreaterThanOrEqual(stn.coordinate.latitude, 50.8)
            XCTAssertLessThanOrEqual(stn.coordinate.latitude, 51.3)
            XCTAssertGreaterThanOrEqual(stn.coordinate.longitude, -114.4)
            XCTAssertLessThanOrEqual(stn.coordinate.longitude, -113.8)
        }

        XCTAssertGreaterThanOrEqual(totalStalls, 14000)
    }

    // MARK: - Coordinate & Geometry Tests

    func testWebMercatorConversion() {
        // Known Calgary Downtown Point: ~51.045, -114.071
        // In EPSG:3857, X approx -12698300, Y approx 6629200
        let x = -12698300.0
        let y = 6629200.0

        let coord = CoordinateUtils.webMercatorToLatLng(x: x, y: y)
        XCTAssertEqual(coord.latitude, 51.045, accuracy: 0.05)
        XCTAssertEqual(coord.longitude, -114.071, accuracy: 0.05)
    }

    func testNormalizeCoord() {
        // Large Mercator coord
        let c1 = CoordinateUtils.normalizeCoord(x: -12698300.0, y: 6629200.0)
        XCTAssertEqual(c1.latitude, 51.045, accuracy: 0.05)

        // Standard WGS84 coord [lng, lat]
        let c2 = CoordinateUtils.normalizeCoord(x: -114.07, y: 51.04)
        XCTAssertEqual(c2.latitude, 51.04, accuracy: 0.001)
        XCTAssertEqual(c2.longitude, -114.07, accuracy: 0.001)
    }

    func testPolygonCentroid() {
        let square: [CLLocationCoordinate2D] = [
            CLLocationCoordinate2D(latitude: 51.0, longitude: -114.0),
            CLLocationCoordinate2D(latitude: 51.0, longitude: -114.2),
            CLLocationCoordinate2D(latitude: 51.2, longitude: -114.2),
            CLLocationCoordinate2D(latitude: 51.2, longitude: -114.0)
        ]
        let centroid = CoordinateUtils.getPolygonCentroid(square)
        XCTAssertEqual(centroid.latitude, 51.1, accuracy: 0.0001)
        XCTAssertEqual(centroid.longitude, -114.1, accuracy: 0.0001)
    }

    func testPolylineMidpoint() {
        let line: [CLLocationCoordinate2D] = [
            CLLocationCoordinate2D(latitude: 51.0, longitude: -114.0),
            CLLocationCoordinate2D(latitude: 51.2, longitude: -114.0)
        ]
        let midpoint = CoordinateUtils.getPolylineMidpoint(line)
        XCTAssertEqual(midpoint.latitude, 51.1, accuracy: 0.0001)
        XCTAssertEqual(midpoint.longitude, -114.0, accuracy: 0.0001)
    }

    // MARK: - Rate Parser Tests

    func testParseTimeRangeToMinutes() {
        let r1 = RateParser.parseTimeRangeToMinutes("Mon-Fri 09:00 AM to 06:00 PM")
        XCTAssertNotNil(r1)
        XCTAssertEqual(r1?.start, 9 * 60)
        XCTAssertEqual(r1?.end, 18 * 60)

        let r2 = RateParser.parseTimeRangeToMinutes("Sat 11:30 AM to 03:45 PM")
        XCTAssertNotNil(r2)
        XCTAssertEqual(r2?.start, 11 * 60 + 30)
        XCTAssertEqual(r2?.end, 15 * 60 + 45)

        let r3 = RateParser.parseTimeRangeToMinutes("Invalid Header String")
        XCTAssertNil(r3)
    }

    func testParseZoneRateSchedule() {
        let html = """
        Mon-Fri 07:00 AM to 09:00 AM<br>
        No Parking at this time<br>
        Mon-Fri 09:00 AM to 03:30 PM<br>
        $4.50 per Hour<br>
        Mon-Fri 03:30 PM to 06:00 PM<br>
        No Parking at this time<br>
        Saturday 09:00 AM to 06:00 PM<br>
        $1.00 per Hour
        """

        let rateInfo = RateParser.parseZoneRateSchedule(html)
        XCTAssertEqual(rateInfo.intervals.count, 4)
        XCTAssertEqual(rateInfo.maxRate, 4.50, accuracy: 0.001)
        XCTAssertEqual(rateInfo.minRate, 1.00, accuracy: 0.001)

        XCTAssertTrue(rateInfo.intervals[0].isNoParking)
        XCTAssertEqual(rateInfo.intervals[1].price, 4.50)
        XCTAssertEqual(rateInfo.intervals[1].appliesDays, "weekday")
        XCTAssertTrue(rateInfo.intervals[2].isNoParking)
        XCTAssertEqual(rateInfo.intervals[3].price, 1.00)
        XCTAssertEqual(rateInfo.intervals[3].appliesDays, "saturday")
    }

    func test24HourProfileWeekdayRestrictions() {
        let html = """
        Mon-Fri 07:00 AM to 09:00 AM<br>
        No Parking at this time<br>
        Mon-Fri 09:00 AM to 06:00 PM<br>
        $3.75 per Hour
        """
        let rateInfo = RateParser.parseZoneRateSchedule(html)
        let profile = RateParser.generate24HourProfile(rateInfo: rateInfo, dayType: .weekday)

        XCTAssertEqual(profile.count, 24)

        // 8 AM (hour 8) should be restricted
        let pt8 = profile[8]
        XCTAssertTrue(pt8.isRestricted)
        XCTAssertNil(pt8.rate)

        // 10 AM (hour 10) should be $3.75
        let pt10 = profile[10]
        XCTAssertFalse(pt10.isRestricted)
        XCTAssertEqual(pt10.rate, 3.75)

        // 11 PM (hour 23) should be free off-peak
        let pt23 = profile[23]
        XCTAssertFalse(pt23.isRestricted)
        XCTAssertEqual(pt23.rate, 0.0)
    }

    func test24HourProfileSundayFree() {
        let html = "Mon-Fri 09:00 AM to 06:00 PM<br>$4.00 per Hour"
        let rateInfo = RateParser.parseZoneRateSchedule(html)
        let profile = RateParser.generate24HourProfile(rateInfo: rateInfo, dayType: .sunday)

        XCTAssertEqual(profile.count, 24)
        for pt in profile {
            XCTAssertFalse(pt.isRestricted)
            XCTAssertEqual(pt.rate, 0.0)
            XCTAssertEqual(pt.label, "Free Parking")
        }
    }

    // MARK: - Price Filter Logic

    func testFilterZonesByPrice() {
        let dummyCoord = CLLocationCoordinate2D(latitude: 51.04, longitude: -114.07)

        let freeTransit = ParkingZone(
            id: "z1",
            providerId: .calgaryTransit,
            zoneNumber: "T1",
            name: "Transit Free",
            address: "Test St",
            rateInfo: ZoneRateInfo(currentRate: 0.0, maxRate: 0.0, minRate: 0.0, isCurrentlyFree: true),
            midpoint: dummyCoord,
            geometry: .point(dummyCoord)
        )

        let expensiveZone = ParkingZone(
            id: "z2",
            providerId: .parkplusOnStreet,
            zoneNumber: "1001",
            name: "Expensive",
            address: "Downtown Ave",
            rateInfo: ZoneRateInfo(currentRate: 1.0, maxRate: 4.50, minRate: 1.0, isCurrentlyFree: false),
            midpoint: dummyCoord,
            geometry: .point(dummyCoord)
        )

        let allZones = [freeTransit, expensiveZone]

        // 1. ALL filter returns all
        let resAll = RateParser.filterZonesByPrice(zones: allZones, filter: .all, mode: .max)
        XCTAssertEqual(resAll.count, 2)

        // 2. Free in max mode: only freeTransit (maxRate == 0)
        let resFreeMax = RateParser.filterZonesByPrice(zones: allZones, filter: .free, mode: .max)
        XCTAssertEqual(resFreeMax.count, 1)
        XCTAssertEqual(resFreeMax.first?.id, "z1")

        // 3. Numeric cap <= 2.0: expensiveZone has maxRate 4.50, so it must be excluded
        let resCap2 = RateParser.filterZonesByPrice(zones: allZones, filter: .two, mode: .live)
        XCTAssertEqual(resCap2.count, 1)
        XCTAssertEqual(resCap2.first?.id, "z1")
    }

    // MARK: - History Manager Baseline Tests

    func testHistoryManagerCalculations() {
        let (points, pct) = HistoryManager.getZoneHistoricalData(peakRate: 4.00)
        XCTAssertGreaterThanOrEqual(points.count, 7)
        XCTAssertEqual(points[0].period, "2023 Q1")
        XCTAssertEqual(points.last?.period, "2026 Q1")
        XCTAssertGreaterThanOrEqual(pct, 0.0)
    }
}
