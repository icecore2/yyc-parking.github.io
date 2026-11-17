package com.calgaryparking.map.service

import com.calgaryparking.map.model.DayScheduleType
import com.calgaryparking.map.model.HourlyRatePoint
import com.calgaryparking.map.model.ParkingZone
import com.calgaryparking.map.model.PriceFilterTier
import com.calgaryparking.map.model.RateCalculationMode
import com.calgaryparking.map.model.RateInterval
import com.calgaryparking.map.model.ZoneRateInfo
import java.time.DayOfWeek
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.TextStyle
import java.util.Locale

data class CalgaryNowInfo(
    val currentMinutes: Int,
    val dayStr: String,
    val isSunday: Boolean,
    val isSaturday: Boolean,
    val isWeekday: Boolean
)

object RateParser {
    private val calgaryZoneId: ZoneId = ZoneId.of("America/Edmonton")
    private val timeRangeRegex = Regex("""(\d{1,2}):(\d{2})\s*(AM|PM)\s*to\s*(\d{1,2}):(\d{2})\s*(AM|PM)""", RegexOption.IGNORE_CASE)
    private val priceRegex = Regex("""\$([0-9]+(?:\.[0-9]{2})?)""")
    private val commercialPattern1 = Regex("""(?:Hourly|Weekday):\s*\$([0-9]+(?:\.[0-9]{2})?)""", RegexOption.IGNORE_CASE)
    private val commercialPattern2 = Regex("""\$([0-9]+(?:\.[0-9]{2})?)/hr""", RegexOption.IGNORE_CASE)
    private val enforceablePattern = Regex("""^(\d{2})(\d{2})-(\d{2})(\d{2})\s*(.*)$""")

    fun getCalgaryNow(instant: Instant = Instant.now()): CalgaryNowInfo {
        val zdt: ZonedDateTime = instant.atZone(calgaryZoneId)
        val currentMinutes = zdt.hour * 60 + zdt.minute
        val dow = zdt.dayOfWeek
        val isSunday = dow == DayOfWeek.SUNDAY
        val isSaturday = dow == DayOfWeek.SATURDAY
        val isWeekday = !isSunday && !isSaturday
        val dayStr = dow.getDisplayName(TextStyle.SHORT, Locale.US)

        return CalgaryNowInfo(
            currentMinutes = currentMinutes,
            dayStr = dayStr,
            isSunday = isSunday,
            isSaturday = isSaturday,
            isWeekday = isWeekday
        )
    }

    fun parseTimeRangeToMinutes(text: String): Pair<Int, Int>? {
        val match = timeRangeRegex.find(text) ?: return null
        val startH = match.groupValues[1].toIntOrNull() ?: 0
        val startM = match.groupValues[2].toIntOrNull() ?: 0
        val startAmPm = match.groupValues[3].uppercase(Locale.US)

        val endH = match.groupValues[4].toIntOrNull() ?: 0
        val endM = match.groupValues[5].toIntOrNull() ?: 0
        val endAmPm = match.groupValues[6].uppercase(Locale.US)

        fun to24(h: Int, ampm: String): Int {
            var res = h % 12
            if (ampm == "PM") res += 12
            return res
        }

        val startMinutes = to24(startH, startAmPm) * 60 + startM
        val endMinutes = to24(endH, endAmPm) * 60 + endM
        return Pair(startMinutes, endMinutes)
    }

    fun parseZoneRateSchedule(rawHtml: String, now: Instant = Instant.now()): ZoneRateInfo {
        val clean = rawHtml
            .replace(Regex("(?i)<br\\s*/?>"), "\n")
            .replace(Regex("(?i)</p>"), "\n")
            .replace(Regex("(?i)</div>"), "\n")
            .replace(Regex("<[^>]+>"), "")
            .replace("&nbsp;", " ")

        val lines = clean
            .lines()
            .map { it.trim() }
            .filter { it.isNotEmpty() }

        val intervals = mutableListOf<RateInterval>()
        val prices = mutableListOf<Double>()

        var idx = 0
        while (idx < lines.size) {
            val header = lines[idx]
            val rateText = if (idx + 1 < lines.size) lines[idx + 1] else ""
            idx += 2

            val headerLower = header.lowercase(Locale.US)
            val rateTextLower = rateText.lowercase(Locale.US)

            val isFree = rateTextLower.contains("free") || headerLower.contains("free")
            val isNoParking = rateTextLower.contains("no parking") || headerLower.contains("no parking")

            var price = 0.0
            if (!isNoParking && !isFree) {
                val match = priceRegex.find(rateText)
                if (match != null) {
                    price = match.groupValues[1].toDoubleOrNull() ?: 0.0
                }
            }

            if (!isNoParking) {
                prices.add(price)
            }

            val appliesDays = when {
                headerLower.contains("mon-fri") || headerLower.contains("mon to fri") -> "weekday"
                headerLower.contains("saturday") -> "saturday"
                headerLower.contains("sunday") || headerLower.contains("holiday") -> "sunday"
                else -> "all"
            }

            val range = parseTimeRangeToMinutes(header)
            val startMin = range?.first ?: 0
            val endMin = range?.second ?: 1440

            intervals.add(
                RateInterval(
                    header = header,
                    rateText = rateText,
                    price = price,
                    isFree = isFree,
                    isNoParking = isNoParking,
                    startMinutes = startMin,
                    endMinutes = endMin,
                    appliesDays = appliesDays
                )
            )
        }

        val maxRate = prices.maxOrNull() ?: 0.0
        val minRate = prices.minOrNull() ?: 0.0
        val calgary = getCalgaryNow(now)

        if (calgary.isSunday) {
            return ZoneRateInfo(
                currentRate = 0.0,
                maxRate = maxRate,
                minRate = minRate,
                isCurrentlyFree = true,
                currentSlotLabel = "Sunday (Free Parking)",
                isNoParkingNow = false,
                intervals = intervals
            )
        }

        val todayType = if (calgary.isSaturday) "saturday" else "weekday"
        val matched = intervals.firstOrNull { inv ->
            val dayMatch = (inv.appliesDays == todayType || inv.appliesDays == "all")
            val timeMatch = (calgary.currentMinutes >= inv.startMinutes && calgary.currentMinutes < inv.endMinutes)
            dayMatch && timeMatch
        }

        if (matched != null) {
            return if (matched.isNoParking) {
                ZoneRateInfo(
                    currentRate = null,
                    maxRate = maxRate,
                    minRate = minRate,
                    isCurrentlyFree = false,
                    currentSlotLabel = "${matched.header}: ${matched.rateText}",
                    isNoParkingNow = true,
                    intervals = intervals
                )
            } else {
                val isFreeNow = matched.isFree || matched.price == 0.0
                ZoneRateInfo(
                    currentRate = matched.price,
                    maxRate = maxRate,
                    minRate = minRate,
                    isCurrentlyFree = isFreeNow,
                    currentSlotLabel = "${matched.header}: ${matched.rateText}",
                    isNoParkingNow = false,
                    intervals = intervals
                )
            }
        }

        return ZoneRateInfo(
            currentRate = 0.0,
            maxRate = maxRate,
            minRate = minRate,
            isCurrentlyFree = true,
            currentSlotLabel = "After Hours (Free Parking)",
            isNoParkingNow = false,
            intervals = intervals
        )
    }

    fun generate24HourProfile(rateInfo: ZoneRateInfo, dayType: DayScheduleType): List<HourlyRatePoint> {
        val points = mutableListOf<HourlyRatePoint>()

        for (hour in 0 until 24) {
            val hour12 = when {
                hour == 0 -> 12
                hour > 12 -> hour - 12
                else -> hour
            }
            val ampm = if (hour < 12) "AM" else "PM"
            val hourLabel = "$hour12 $ampm"
            val currentMin = hour * 60 + 30

            if (dayType == DayScheduleType.SUNDAY) {
                points.add(
                    HourlyRatePoint(
                        hour = hour,
                        hourLabel = hourLabel,
                        rate = 0.0,
                        isRestricted = false,
                        label = "Free Parking"
                    )
                )
                continue
            }

            val todayTypeStr = if (dayType == DayScheduleType.SATURDAY) "saturday" else "weekday"
            val matched = rateInfo.intervals.firstOrNull { inv ->
                val dayMatch = (inv.appliesDays == todayTypeStr || inv.appliesDays == "all")
                val timeMatch = (currentMin >= inv.startMinutes && currentMin < inv.endMinutes)
                dayMatch && timeMatch
            }

            if (matched != null) {
                if (matched.isNoParking) {
                    points.add(
                        HourlyRatePoint(
                            hour = hour,
                            hourLabel = hourLabel,
                            rate = null,
                            isRestricted = true,
                            label = "No Parking (Restriction)"
                        )
                    )
                } else {
                    points.add(
                        HourlyRatePoint(
                            hour = hour,
                            hourLabel = hourLabel,
                            rate = matched.price,
                            isRestricted = false,
                            label = String.format(Locale.US, "$%.2f/hr", matched.price)
                        )
                    )
                }
            } else {
                points.add(
                    HourlyRatePoint(
                        hour = hour,
                        hourLabel = hourLabel,
                        rate = 0.0,
                        isRestricted = false,
                        label = "Free Parking (Off-Peak)"
                    )
                )
            }
        }

        return points
    }

    fun filterZonesByPrice(
        zones: List<ParkingZone>,
        filter: PriceFilterTier,
        mode: RateCalculationMode
    ): List<ParkingZone> {
        return when (filter) {
            PriceFilterTier.ALL -> zones
            PriceFilterTier.FREE -> {
                if (mode == RateCalculationMode.LIVE) {
                    zones.filter { zone ->
                        zone.rateInfo.isCurrentlyFree || (zone.rateInfo.currentRate ?: 0.0) == 0.0
                    }
                } else {
                    zones.filter { zone ->
                        zone.rateInfo.maxRate == 0.0
                    }
                }
            }
            PriceFilterTier.ONE,
            PriceFilterTier.TWO,
            PriceFilterTier.THREE,
            PriceFilterTier.FOUR,
            PriceFilterTier.FIVE -> {
                val cap = filter.numericCap ?: return zones
                zones.filter { zone ->
                    zone.rateInfo.maxRate <= cap
                }
            }
        }
    }

    fun extractCommercialRate(ratesSummary: String, facilityType: String?): Double {
        commercialPattern1.find(ratesSummary)?.let { match ->
            return match.groupValues[1].toDoubleOrNull() ?: 5.0
        }
        commercialPattern2.find(ratesSummary)?.let { match ->
            return match.groupValues[1].toDoubleOrNull() ?: 5.0
        }
        return if (facilityType?.uppercase(Locale.US) == "PARKADE") 5.0 else 4.0
    }

    fun formatEnforceableTime(raw: String): String {
        val match = enforceablePattern.find(raw)
            ?: return if (raw.isEmpty()) "Standard Hours" else raw

        val startH = match.groupValues[1]
        val startM = match.groupValues[2]
        val endH = match.groupValues[3]
        val endM = match.groupValues[4]
        val rest = match.groupValues[5].trim()

        val suffix = if (rest.isEmpty()) "" else " ($rest)"
        return "$startH:$startM - $endH:$endM$suffix"
    }
}
