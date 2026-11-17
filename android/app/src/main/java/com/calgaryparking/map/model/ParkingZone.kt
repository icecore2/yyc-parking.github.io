package com.calgaryparking.map.model

import java.util.UUID

data class LatLng(
    val latitude: Double,
    val longitude: Double
)

sealed class ParkingGeometryType {
    data class OnStreetPolyline(val segments: List<List<LatLng>>) : ParkingGeometryType()
    data class OffStreetPolygon(val ring: List<LatLng>) : ParkingGeometryType()
    data class Point(val coordinate: LatLng) : ParkingGeometryType()
}

data class RateInterval(
    val header: String,
    val rateText: String,
    val price: Double,
    val isFree: Boolean,
    val isNoParking: Boolean,
    val startMinutes: Int,
    val endMinutes: Int,
    val appliesDays: String // "weekday", "saturday", "sunday", "all"
) {
    val id: String = "${header}_${rateText}_${startMinutes}_${endMinutes}"
}

data class ZoneRateInfo(
    val currentRate: Double? = 0.0,
    val maxRate: Double = 0.0,
    val minRate: Double = 0.0,
    val isCurrentlyFree: Boolean = false,
    val currentSlotLabel: String = "Free Parking",
    val isNoParkingNow: Boolean = false,
    val intervals: List<RateInterval> = emptyList()
)

data class ParkingZone(
    val id: String,
    val providerId: ProviderId,
    val zoneNumber: String,
    val name: String,
    val address: String,
    val blockSide: String = "",
    val zoneType: String = "Parking Zone",
    val stallType: String = "Parallel",
    val zoneCapacity: Int = 0,
    val segCapacity: Int = 0,
    val zoneLength: Int = 0,
    val segLength: Int = 0,
    val brzName: String = "None",
    val priceZone: String = "Standard",
    val maxTime: Int = 0,
    val enforceableTime: String = "",
    val htmlRates: String = "",
    val rateInfo: ZoneRateInfo = ZoneRateInfo(),
    val restrictTime: String = "none",
    val restrictType: String = "none",
    val noParking: String = "",
    val noStopping: String = "",
    val permitZone: String = "",
    val comments: String = "",
    val globalId: String = "",
    val status: String = "Active",
    // Commercial / Off-Street Extra Fields
    val facilityType: String? = null,
    val paymentApp: String? = null,
    val paymentUrl: String? = null,
    val operator: String? = null,
    val heightLimit: String? = null,
    val amenities: List<String> = emptyList(),
    // Geometry
    val midpoint: LatLng,
    val geometry: ParkingGeometryType,
    // Computed / Dynamic State
    val distanceToTarget: Double? = null,
    val walkingMinutes: Int? = null
)

enum class RateCalculationMode(val rawValue: String, val title: String) {
    MAX("max", "Peak Daytime Rate"),
    LIVE("live", "Live Rate (Now)")
}

enum class PriceFilterTier(val rawValue: String, val title: String, val numericCap: Double?) {
    ALL("ALL", "All Rates", null),
    FREE("free", "Free Parking Only", null),
    ONE("1", "≤ $1.00 / hr", 1.0),
    TWO("2", "≤ $2.00 / hr", 2.0),
    THREE("3", "≤ $3.00 / hr", 3.0),
    FOUR("4", "≤ $4.00 / hr", 4.0),
    FIVE("5", "≤ $5.00 / hr", 5.0)
}

enum class SortCriterion(val rawValue: String, val title: String) {
    CLOSEST_CHEAPEST("closest_cheapest", "Best Value (Distance + Price)"),
    CLOSEST("closest", "Closest First"),
    CHEAPEST("cheapest", "Cheapest First")
}

enum class RadiusFilter(val rawValue: String, val title: String, val meters: Double?) {
    R300("300", "300 meters (~4 min)", 300.0),
    R500("500", "500 meters (~6 min)", 500.0),
    R1000("1000", "1.0 km (~12 min)", 1000.0),
    R2000("2000", "2.0 km (~25 min)", 2000.0),
    ALL("ALL", "No Distance Limit", null)
}

data class CustomLocation(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val latitude: Double,
    val longitude: Double
) {
    val coordinate: LatLng
        get() = LatLng(latitude, longitude)
}

enum class DayScheduleType(val rawValue: String, val title: String) {
    WEEKDAY("weekday", "Mon–Fri"),
    SATURDAY("saturday", "Saturday"),
    SUNDAY("sunday", "Sun / Holiday")
}

data class HourlyRatePoint(
    val hour: Int,
    val hourLabel: String,
    val rate: Double?,
    val isRestricted: Boolean,
    val label: String
)

data class HistoricalDataPoint(
    val period: String,
    val rate: Double,
    val isLocalSnapshot: Boolean = false,
    val timestampMillis: Long? = null
)
