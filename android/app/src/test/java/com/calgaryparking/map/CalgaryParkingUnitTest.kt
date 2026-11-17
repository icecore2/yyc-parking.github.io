package com.calgaryparking.map

import com.calgaryparking.map.model.DayScheduleType
import com.calgaryparking.map.model.LatLng
import com.calgaryparking.map.model.ParkingGeometryType
import com.calgaryparking.map.model.ParkingZone
import com.calgaryparking.map.model.PriceFilterTier
import com.calgaryparking.map.model.ProviderId
import com.calgaryparking.map.model.ProviderRegistry
import com.calgaryparking.map.model.RateCalculationMode
import com.calgaryparking.map.model.TransitSeedData
import com.calgaryparking.map.model.ZoneRateInfo
import com.calgaryparking.map.service.CoordinateUtils
import com.calgaryparking.map.service.HistoryManager
import com.calgaryparking.map.service.ParkingDataService
import com.calgaryparking.map.service.RateParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CalgaryParkingUnitTest {

    // MARK: - Provider Registry Tests

    @Test
    fun testProviderRegistryCompleteness() {
        assertEquals(6, ProviderRegistry.all.size)
        val expectedIds = listOf(
            ProviderId.PARKPLUS_ON_STREET,
            ProviderId.CPA_OFF_STREET,
            ProviderId.CALGARY_TRANSIT,
            ProviderId.IMPARK,
            ProviderId.INDIGO,
            ProviderId.PRECISE_PARKLINK
        )
        for (id in expectedIds) {
            val p = ProviderRegistry.provider(id)
            assertEquals(id, p.id)
            assertTrue(p.name.isNotEmpty())
            assertTrue(p.operator.isNotEmpty())
            assertTrue(p.colorHex.startsWith("#"))
        }
    }

    @Test
    fun testProviderFallback() {
        val fallback = ProviderRegistry.provider("non_existent_provider_id")
        assertEquals(ProviderId.PARKPLUS_ON_STREET, fallback.id)
    }

    // MARK: - Transit Data Tests

    @Test
    fun testTransitStationsInventory() {
        val stations = TransitSeedData.stations
        assertTrue(stations.size >= 20)
        var totalStalls = 0

        for (stn in stations) {
            assertTrue(stn.name.isNotEmpty())
            assertTrue(stn.stalls > 0)
            totalStalls += stn.stalls

            // Bounding box check for Calgary Transit
            assertTrue(stn.coordinate.latitude in 50.8..51.3)
            assertTrue(stn.coordinate.longitude in -114.4..-113.8)
        }

        assertTrue(totalStalls >= 15000)
    }

    // MARK: - Commercial Dataset Tests

    @Test
    fun testCommercialParkingJsonLoading() {
        val commercialZones = ParkingDataService.fetchCommercial()
        assertEquals(15, commercialZones.size)
        assertTrue(commercialZones.any { it.providerId == ProviderId.IMPARK })
        assertTrue(commercialZones.any { it.providerId == ProviderId.INDIGO })
        assertTrue(commercialZones.any { it.providerId == ProviderId.PRECISE_PARKLINK })
    }

    // MARK: - Coordinate & Geometry Tests

    @Test
    fun testWebMercatorConversion() {
        val x = -12698300.0
        val y = 6629200.0

        val coord = CoordinateUtils.webMercatorToLatLng(x, y)
        assertEquals(51.045, coord.latitude, 0.05)
        assertEquals(-114.071, coord.longitude, 0.05)
    }

    @Test
    fun testNormalizeCoord() {
        // Large Mercator coord
        val c1 = CoordinateUtils.normalizeCoord(-12698300.0, 6629200.0)
        assertEquals(51.045, c1.latitude, 0.05)

        // Standard WGS84 coord [lng, lat]
        val c2 = CoordinateUtils.normalizeCoord(-114.07, 51.04)
        assertEquals(51.04, c2.latitude, 0.001)
        assertEquals(-114.07, c2.longitude, 0.001)
    }

    @Test
    fun testPolygonCentroid() {
        val square = listOf(
            LatLng(51.0, -114.0),
            LatLng(51.0, -114.2),
            LatLng(51.2, -114.2),
            LatLng(51.2, -114.0)
        )
        val centroid = CoordinateUtils.getPolygonCentroid(square)
        assertEquals(51.1, centroid.latitude, 0.0001)
        assertEquals(-114.1, centroid.longitude, 0.0001)
    }

    @Test
    fun testPolylineMidpoint() {
        val line = listOf(
            LatLng(51.0, -114.0),
            LatLng(51.2, -114.0)
        )
        val midpoint = CoordinateUtils.getPolylineMidpoint(line)
        assertEquals(51.1, midpoint.latitude, 0.0001)
        assertEquals(-114.0, midpoint.longitude, 0.0001)
    }

    @Test
    fun testDistanceAndWalkingMinutes() {
        val a = LatLng(51.0458, -114.0715)
        val b = LatLng(51.0449, -114.0628)
        val dist = CoordinateUtils.distanceInMeters(a, b)
        assertTrue(dist in 500.0..700.0)
        val mins = CoordinateUtils.walkingMinutes(dist)
        assertTrue(mins in 6..10)
    }

    // MARK: - Rate Parser Tests

    @Test
    fun testParseTimeRangeToMinutes() {
        val r1 = RateParser.parseTimeRangeToMinutes("Mon-Fri 09:00 AM to 06:00 PM")
        assertNotNull(r1)
        assertEquals(9 * 60, r1!!.first)
        assertEquals(18 * 60, r1.second)

        val r2 = RateParser.parseTimeRangeToMinutes("Sat 11:30 AM to 03:45 PM")
        assertNotNull(r2)
        assertEquals(11 * 60 + 30, r2!!.first)
        assertEquals(15 * 60 + 45, r2.second)

        val r3 = RateParser.parseTimeRangeToMinutes("Invalid Header String")
        assertNull(r3)
    }

    @Test
    fun testParseZoneRateSchedule() {
        val html = """
            Mon-Fri 07:00 AM to 09:00 AM<br>
            No Parking at this time<br>
            Mon-Fri 09:00 AM to 03:30 PM<br>
            $4.50 per Hour<br>
            Mon-Fri 03:30 PM to 06:00 PM<br>
            No Parking at this time<br>
            Saturday 09:00 AM to 06:00 PM<br>
            $1.00 per Hour
        """.trimIndent()

        val rateInfo = RateParser.parseZoneRateSchedule(html)
        assertEquals(4, rateInfo.intervals.size)
        assertEquals(4.50, rateInfo.maxRate, 0.001)
        assertEquals(1.00, rateInfo.minRate, 0.001)

        assertTrue(rateInfo.intervals[0].isNoParking)
        assertEquals(4.50, rateInfo.intervals[1].price, 0.001)
        assertEquals("weekday", rateInfo.intervals[1].appliesDays)
        assertTrue(rateInfo.intervals[2].isNoParking)
        assertEquals(1.00, rateInfo.intervals[3].price, 0.001)
        assertEquals("saturday", rateInfo.intervals[3].appliesDays)
    }

    @Test
    fun test24HourProfileWeekdayRestrictions() {
        val html = """
            Mon-Fri 07:00 AM to 09:00 AM<br>
            No Parking at this time<br>
            Mon-Fri 09:00 AM to 06:00 PM<br>
            $3.75 per Hour
        """.trimIndent()

        val rateInfo = RateParser.parseZoneRateSchedule(html)
        val profile = RateParser.generate24HourProfile(rateInfo, DayScheduleType.WEEKDAY)

        assertEquals(24, profile.size)

        // 8 AM (hour 8) should be restricted
        val pt8 = profile[8]
        assertTrue(pt8.isRestricted)
        assertNull(pt8.rate)

        // 10 AM (hour 10) should be $3.75
        val pt10 = profile[10]
        assertFalse(pt10.isRestricted)
        assertEquals(3.75, pt10.rate!!, 0.001)

        // 11 PM (hour 23) should be free off-peak
        val pt23 = profile[23]
        assertFalse(pt23.isRestricted)
        assertEquals(0.0, pt23.rate!!, 0.001)
    }

    @Test
    fun test24HourProfileSundayFree() {
        val html = "Mon-Fri 09:00 AM to 06:00 PM<br>$4.00 per Hour"
        val rateInfo = RateParser.parseZoneRateSchedule(html)
        val profile = RateParser.generate24HourProfile(rateInfo, DayScheduleType.SUNDAY)

        assertEquals(24, profile.size)
        for (pt in profile) {
            assertFalse(pt.isRestricted)
            assertEquals(0.0, pt.rate!!, 0.001)
            assertEquals("Free Parking", pt.label)
        }
    }

    // MARK: - Price Filter Logic

    @Test
    fun testFilterZonesByPrice() {
        val dummyCoord = LatLng(51.04, -114.07)

        val freeTransit = ParkingZone(
            id = "z1",
            providerId = ProviderId.CALGARY_TRANSIT,
            zoneNumber = "T1",
            name = "Transit Free",
            address = "Test St",
            rateInfo = ZoneRateInfo(currentRate = 0.0, maxRate = 0.0, minRate = 0.0, isCurrentlyFree = true),
            midpoint = dummyCoord,
            geometry = ParkingGeometryType.Point(dummyCoord)
        )

        val expensiveZone = ParkingZone(
            id = "z2",
            providerId = ProviderId.PARKPLUS_ON_STREET,
            zoneNumber = "1001",
            name = "Expensive",
            address = "Downtown Ave",
            rateInfo = ZoneRateInfo(currentRate = 1.0, maxRate = 4.50, minRate = 1.0, isCurrentlyFree = false),
            midpoint = dummyCoord,
            geometry = ParkingGeometryType.Point(dummyCoord)
        )

        val allZones = listOf(freeTransit, expensiveZone)

        // 1. ALL filter returns all
        val resAll = RateParser.filterZonesByPrice(allZones, PriceFilterTier.ALL, RateCalculationMode.MAX)
        assertEquals(2, resAll.size)

        // 2. Free in max mode: only freeTransit (maxRate == 0)
        val resFreeMax = RateParser.filterZonesByPrice(allZones, PriceFilterTier.FREE, RateCalculationMode.MAX)
        assertEquals(1, resFreeMax.size)
        assertEquals("z1", resFreeMax.first().id)

        // 3. Numeric cap <= 2.0: expensiveZone has maxRate 4.50, so it must be excluded
        val resCap2 = RateParser.filterZonesByPrice(allZones, PriceFilterTier.TWO, RateCalculationMode.LIVE)
        assertEquals(1, resCap2.size)
        assertEquals("z1", resCap2.first().id)
    }

    // MARK: - History Manager Baseline Tests

    @Test
    fun testHistoryManagerCalculations() {
        HistoryManager.clearLocalHistory()
        val res = HistoryManager.getZoneHistoricalData(peakRate = 4.00)
        assertTrue(res.points.size >= 7)
        assertEquals("2023 Q1", res.points.first().period)
        assertEquals("2026 Q1", res.points.last().period)
        assertTrue(res.percentChange >= 0.0)

        HistoryManager.takeSnapshotNow(4.50)
        val resWithSnap = HistoryManager.getZoneHistoricalData(peakRate = 4.00)
        assertEquals(8, resWithSnap.points.size)
        assertTrue(resWithSnap.points.last().isLocalSnapshot)
        HistoryManager.clearLocalHistory()
    }
}
