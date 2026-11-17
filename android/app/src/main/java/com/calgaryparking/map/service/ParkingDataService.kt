package com.calgaryparking.map.service

import android.content.Context
import com.calgaryparking.map.model.LatLng
import com.calgaryparking.map.model.ParkingGeometryType
import com.calgaryparking.map.model.ParkingZone
import com.calgaryparking.map.model.ProviderId
import com.calgaryparking.map.model.ProviderRegistry
import com.calgaryparking.map.model.RateInterval
import com.calgaryparking.map.model.TransitSeedData
import com.calgaryparking.map.model.ZoneRateInfo
import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import kotlin.math.roundToInt

private data class CommercialItemDto(
    val id: String = "",
    val providerId: String = "",
    val facilityType: String? = null,
    val name: String = "",
    val lotNumber: String? = null,
    val paymentCode: String? = null,
    val address: String = "",
    val coordinates: List<Double> = emptyList(),
    val capacity: Int? = null,
    val stallType: String? = null,
    val heightLimit: String? = null,
    val ratesSummary: String? = null,
    val paymentApp: String? = null,
    val paymentUrl: String? = null,
    val operator: String? = null,
    val amenities: List<String>? = null
)

object ParkingDataService {
    const val DEFAULT_ARCGIS_URL =
        "https://services1.arcgis.com/AVP60cs0Q9PEA8rH/arcgis/rest/services/Calgary_Parking_Authority_On_Street_Parking_Zones_with_Rates/FeatureServer/0/query?where=1%3D1&outFields=*&resultRecordCount=20000&f=json"
    const val SOCRATA_URL = "https://data.calgary.ca/resource/ggxk-g2u3.json?\$limit=500"

    private val gson = Gson()

    suspend fun fetchAll(
        arcGisUrl: String = DEFAULT_ARCGIS_URL,
        context: Context? = null
    ): List<ParkingZone> = coroutineScope {
        val onStreetDeferred = async(Dispatchers.IO) {
            runCatching { fetchOnStreet(arcGisUrl) }.getOrDefault(emptyList())
        }
        val offStreetDeferred = async(Dispatchers.IO) {
            runCatching { fetchOffStreet() }.getOrDefault(emptyList())
        }
        val transitDeferred = async(Dispatchers.Default) {
            fetchTransit()
        }
        val commercialDeferred = async(Dispatchers.IO) {
            runCatching { fetchCommercial(context) }.getOrDefault(emptyList())
        }

        onStreetDeferred.await() +
            offStreetDeferred.await() +
            transitDeferred.await() +
            commercialDeferred.await()
    }

    suspend fun fetchOnStreet(url: String = DEFAULT_ARCGIS_URL): List<ParkingZone> = withContext(Dispatchers.IO) {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 35_000
            readTimeout = 35_000
        }

        try {
            if (connection.responseCode !in 200..299) return@withContext emptyList()
            val body = connection.inputStream.bufferedReader().use { it.readText() }
            val root = JsonParser.parseString(body).asJsonObject
            if (root.has("error")) return@withContext emptyList()
            val features = root.getAsJsonArray("features") ?: return@withContext emptyList()

            val result = mutableListOf<ParkingZone>()

            for (i in 0 until features.size()) {
                val feat = features[i].asJsonObject
                val attrs = feat.getAsJsonObject("attributes") ?: continue

                val status = attrs.optString("STATUS", "Active").trim()
                if (status.equals("removed", ignoreCase = true) || status.equals("inactive", ignoreCase = true)) {
                    continue
                }

                val geom = feat.getAsJsonObject("geometry")
                val rawPaths = geom?.getAsJsonArray("paths") ?: geom?.getAsJsonArray("coordinates")
                if (rawPaths == null || rawPaths.isEmpty) continue

                val lineSegments = mutableListOf<List<LatLng>>()
                for (pIdx in 0 until rawPaths.size()) {
                    val pathArr = rawPaths[pIdx].asJsonArray
                    val seg = mutableListOf<LatLng>()
                    for (ptIdx in 0 until pathArr.size()) {
                        val pt = pathArr[ptIdx].asJsonArray
                        if (pt.size() >= 2) {
                            val x = pt[0].asDouble
                            val y = pt[1].asDouble
                            seg.add(CoordinateUtils.normalizeCoord(x, y))
                        }
                    }
                    if (seg.size >= 2) {
                        lineSegments.add(seg)
                    }
                }

                val firstSeg = lineSegments.firstOrNull()
                if (firstSeg.isNullOrEmpty()) continue

                val midpoint = CoordinateUtils.getPolylineMidpoint(firstSeg)
                val zoneNum = attrs.optString("PARKING_ZONE", "N/A").ifBlank { "N/A" }
                val htmlRates = attrs.optString("HTML_ZONE_RATE", "")
                val rateInfo = RateParser.parseZoneRateSchedule(htmlRates)

                val objectId = attrs.optInt("OBJECTID", i)
                val globalId = attrs.optString("GLOBALID", "")
                val id = globalId.ifBlank { "onstreet_$objectId" }
                val brzRaw = attrs.optString("BRZ_NAME", "")

                result.add(
                    ParkingZone(
                        id = id,
                        providerId = ProviderId.PARKPLUS_ON_STREET,
                        zoneNumber = zoneNum,
                        name = "Zone #$zoneNum",
                        address = attrs.optString("ADDRESS_DESC", "Unknown Location"),
                        blockSide = attrs.optString("BLOCK_SIDE", ""),
                        zoneType = attrs.optString("ZONE_TYPE", "Parking Zone"),
                        stallType = attrs.optString("STALL_TYPE", "Parallel"),
                        zoneCapacity = attrs.optInt("ZONE_CAP", 0),
                        segCapacity = attrs.optInt("SEG_CAP", 0),
                        zoneLength = attrs.optDouble("ZONE_LENGTH", 0.0).roundToInt(),
                        segLength = attrs.optDouble("SEG_LENGTH", 0.0).roundToInt(),
                        brzName = brzRaw.ifBlank { "None" },
                        priceZone = attrs.optString("PRICE_ZONE", "Standard").ifBlank { "Standard" },
                        maxTime = attrs.optInt("MAX_TIME", 0),
                        enforceableTime = attrs.optString("ENFORCEABLE_TIME", ""),
                        htmlRates = htmlRates,
                        rateInfo = rateInfo,
                        restrictTime = attrs.optString("PARKING_RESTRICT_TIME", "none").ifBlank { "none" },
                        restrictType = attrs.optString("PARKING_RESTRICT_TYPE", "none").ifBlank { "none" },
                        noParking = attrs.optString("NO_PARKING", ""),
                        noStopping = attrs.optString("NO_STOPPING", ""),
                        permitZone = attrs.optString("PERMIT_ZONE", ""),
                        comments = attrs.optString("COMMENTS", ""),
                        globalId = globalId,
                        status = status,
                        facilityType = "ON-STREET",
                        paymentApp = "MyParking / ParkPlus",
                        paymentUrl = "https://www.calgaryparking.com/parkplus",
                        operator = "Calgary Parking Authority",
                        midpoint = midpoint,
                        geometry = ParkingGeometryType.OnStreetPolyline(lineSegments)
                    )
                )
            }

            result
        } finally {
            connection.disconnect()
        }
    }

    suspend fun fetchOffStreet(): List<ParkingZone> = withContext(Dispatchers.IO) {
        val connection = (URL(SOCRATA_URL).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 20_000
            readTimeout = 20_000
        }

        try {
            if (connection.responseCode !in 200..299) return@withContext emptyList()
            val body = connection.inputStream.bufferedReader().use { it.readText() }
            val jsonArray = JsonParser.parseString(body).asJsonArray
            val result = mutableListOf<ParkingZone>()

            for (i in 0 until jsonArray.size()) {
                val item = jsonArray[i].asJsonObject
                val polygonCoords = extractPolygonRing(item.getAsJsonObject("multipolygon"))
                if (polygonCoords.isEmpty()) continue

                val midpoint = CoordinateUtils.getPolygonCentroid(polygonCoords)
                val pType = item.optString("parking_type", "").uppercase(Locale.US)
                val isParkade = pType.contains("PARKADE")
                val facilityType = if (isParkade) "PARKADE" else "SURFACE LOT"
                val capacity = if (isParkade) 350 else 120
                val currentRate = if (isParkade) 3.50 else 2.50
                val maxRate = if (isParkade) 4.50 else 3.50

                val lotNum = item.optString("lot_num", "N/A")
                val lotName = item.optString("lot_name", "Lot #$lotNum")
                val address = item.optString("address_desc", "Calgary, AB")
                val stallType = item.optString("stall_type", "Stalls")
                val globalId = item.optString("globalid", "cpa_lot_$i")

                val homePageObj = item.getAsJsonObject("home_page")
                val homePageUrl = homePageObj?.optString("url", "")?.takeIf { it.isNotBlank() }
                    ?: "https://www.calgaryparking.com/find-parking/lots-and-parkades"

                val rateInfo = ZoneRateInfo(
                    currentRate = currentRate,
                    maxRate = maxRate,
                    minRate = 1.50,
                    isCurrentlyFree = false,
                    currentSlotLabel = String.format(Locale.US, "Standard Daytime Rate: $%.2f/hr", currentRate),
                    isNoParkingNow = false,
                    intervals = listOf(
                        RateInterval(
                            header = "Mon-Fri 06:00 AM to 06:00 PM",
                            rateText = String.format(Locale.US, "$%.2f per Hour", maxRate),
                            price = maxRate,
                            isFree = false,
                            isNoParking = false,
                            startMinutes = 360,
                            endMinutes = 1080,
                            appliesDays = "weekday"
                        ),
                        RateInterval(
                            header = "Evenings & Weekends",
                            rateText = String.format(Locale.US, "$%.2f per Hour", currentRate),
                            price = currentRate,
                            isFree = false,
                            isNoParking = false,
                            startMinutes = 1080,
                            endMinutes = 1440,
                            appliesDays = "all"
                        )
                    )
                )

                result.add(
                    ParkingZone(
                        id = globalId,
                        providerId = ProviderId.CPA_OFF_STREET,
                        zoneNumber = lotNum,
                        name = lotName,
                        address = address,
                        zoneType = facilityType,
                        stallType = stallType,
                        zoneCapacity = capacity,
                        segCapacity = capacity,
                        brzName = "Downtown Core",
                        priceZone = if (isParkade) "Tier 4" else "Tier 3",
                        maxTime = 720,
                        enforceableTime = "0600-2200 Mon-Sun",
                        htmlRates = String.format(Locale.US, "Daytime: $%.2f/hr<br>Evening: $%.2f/hr", maxRate, currentRate),
                        rateInfo = rateInfo,
                        comments = "Calgary Parking Authority Municipal Facility",
                        globalId = globalId,
                        status = "Active",
                        facilityType = facilityType,
                        paymentApp = "MyParking / ParkPlus",
                        paymentUrl = homePageUrl,
                        operator = "Calgary Parking Authority",
                        heightLimit = if (isParkade) "2.05 m (6'9\")" else "Open / No Limit",
                        amenities = if (isParkade) {
                            listOf("EV Charging", "Elevator", "CCTV", "Underground/Covered")
                        } else {
                            listOf("Surface Parking", "Pay Machine")
                        },
                        midpoint = midpoint,
                        geometry = ParkingGeometryType.OffStreetPolygon(polygonCoords)
                    )
                )
            }

            result
        } finally {
            connection.disconnect()
        }
    }

    fun fetchTransit(): List<ParkingZone> {
        return TransitSeedData.stations.map { stn ->
            val rateInfo = ZoneRateInfo(
                currentRate = 0.0,
                maxRate = 0.0,
                minRate = 0.0,
                isCurrentlyFree = true,
                currentSlotLabel = "Free Commuter Parking (${stn.reservedFee} Reserved)",
                isNoParkingNow = false,
                intervals = listOf(
                    RateInterval(
                        header = "Mon-Sun All Day",
                        rateText = "Free (Reserved fee ${stn.reservedFee})",
                        price = 0.0,
                        isFree = true,
                        isNoParking = false,
                        startMinutes = 0,
                        endMinutes = 1440,
                        appliesDays = "all"
                    )
                )
            )

            ParkingZone(
                id = stn.id,
                providerId = ProviderId.CALGARY_TRANSIT,
                zoneNumber = stn.name,
                name = "${stn.name} CTrain Station",
                address = "${stn.name} Station, Calgary, AB",
                zoneType = "Park & Ride",
                stallType = "Park & Ride Stalls",
                zoneCapacity = stn.stalls,
                segCapacity = stn.stalls,
                brzName = "${stn.leg} CTrain Corridor",
                priceZone = "Transit Free",
                maxTime = 1440,
                enforceableTime = "0200-1100 (Mon-Fri Reserved Stalls)",
                htmlRates = "Free Parking<br>Reserved stalls ${stn.reservedFee}",
                rateInfo = rateInfo,
                permitZone = "Transit Permit Required 2am-11am for Reserved Stalls",
                comments = "Calgary Transit Light Rail Commuter Park and Ride Facility",
                globalId = stn.id,
                status = "Active",
                facilityType = "TRANSIT LOT",
                paymentApp = "Calgary Transit / CPA",
                paymentUrl = "https://www.calgarytransit.com/content/transit/en/home/rider-information/parking.html",
                operator = "Calgary Transit",
                heightLimit = "Open / Surface Lot",
                amenities = listOf("Direct CTrain Connection", "Heated Waiting Area", "Bus Loop", "Bike Racks"),
                midpoint = stn.coordinate,
                geometry = ParkingGeometryType.Point(stn.coordinate)
            )
        }
    }

    fun fetchCommercial(context: Context? = null): List<ParkingZone> {
        val rawJson = readCommercialJson(context) ?: return emptyList()
        val listType = object : TypeToken<List<CommercialItemDto>>() {}.type
        val items: List<CommercialItemDto> = try {
            gson.fromJson(rawJson, listType) ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }

        return items.mapNotNull { item ->
            if (item.coordinates.size < 2) return@mapNotNull null
            val coord = LatLng(latitude = item.coordinates[1], longitude = item.coordinates[0])
            val providerId = ProviderId.fromRawValue(item.providerId) ?: ProviderId.IMPARK
            val provider = ProviderRegistry.provider(providerId)

            val hourlyRate = RateParser.extractCommercialRate(
                ratesSummary = item.ratesSummary ?: "",
                facilityType = item.facilityType
            )

            val rateInfo = ZoneRateInfo(
                currentRate = hourlyRate,
                maxRate = hourlyRate,
                minRate = hourlyRate,
                isCurrentlyFree = false,
                currentSlotLabel = item.ratesSummary ?: String.format(Locale.US, "$%.2f/hr", hourlyRate),
                isNoParkingNow = false,
                intervals = listOf(
                    RateInterval(
                        header = "Mon-Sun Daily",
                        rateText = String.format(Locale.US, "$%.2f per Hour", hourlyRate),
                        price = hourlyRate,
                        isFree = false,
                        isNoParking = false,
                        startMinutes = 0,
                        endMinutes = 1440,
                        appliesDays = "all"
                    )
                )
            )

            ParkingZone(
                id = item.id,
                providerId = providerId,
                zoneNumber = item.lotNumber ?: item.paymentCode ?: item.id,
                name = item.name,
                address = item.address,
                zoneType = item.facilityType ?: "COMMERCIAL LOT",
                stallType = item.stallType ?: "Stalls",
                zoneCapacity = item.capacity ?: 0,
                segCapacity = item.capacity ?: 0,
                brzName = "Commercial District",
                priceZone = "Commercial",
                maxTime = 1440,
                enforceableTime = "24/7 Enforced",
                htmlRates = item.ratesSummary ?: String.format(Locale.US, "$%.2f/hr", hourlyRate),
                rateInfo = rateInfo,
                comments = "Commercial Parking Facility operated by ${item.operator ?: provider.name}",
                globalId = item.id,
                status = "Active",
                facilityType = item.facilityType,
                paymentApp = item.paymentApp ?: provider.paymentApp,
                paymentUrl = item.paymentUrl ?: provider.paymentUrl,
                operator = item.operator ?: provider.operator,
                heightLimit = item.heightLimit,
                amenities = item.amenities ?: emptyList(),
                midpoint = coord,
                geometry = ParkingGeometryType.Point(coord)
            )
        }
    }

    private fun readCommercialJson(context: Context?): String? {
        if (context != null) {
            runCatching {
                return context.assets.open("commercial_parking.json").bufferedReader().use { it.readText() }
            }
        }
        runCatching {
            val stream = ParkingDataService::class.java.classLoader?.getResourceAsStream("commercial_parking.json")
            if (stream != null) {
                return stream.bufferedReader().use { it.readText() }
            }
        }
        val fallbackFiles = listOf(
            File("src/main/assets/commercial_parking.json"),
            File("app/src/main/assets/commercial_parking.json"),
            File("../data/commercial_parking.json"),
            File("data/commercial_parking.json")
        )
        for (f in fallbackFiles) {
            if (f.exists()) {
                return runCatching { f.readText() }.getOrNull()
            }
        }
        return null
    }

    private fun extractPolygonRing(multipolygon: JsonObject?): List<LatLng> {
        if (multipolygon == null || !multipolygon.has("coordinates")) return emptyList()
        val coordsElem = multipolygon.get("coordinates") ?: return emptyList()
        if (!coordsElem.isJsonArray) return emptyList()

        val ringArray = findCoordinateRing(coordsElem.asJsonArray) ?: return emptyList()
        val points = mutableListOf<LatLng>()
        for (i in 0 until ringArray.size()) {
            val ptElem = ringArray[i]
            if (ptElem.isJsonArray) {
                val pt = ptElem.asJsonArray
                if (pt.size() >= 2 && pt[0].isJsonPrimitive && pt[1].isJsonPrimitive) {
                    points.add(LatLng(latitude = pt[1].asDouble, longitude = pt[0].asDouble))
                }
            }
        }
        return points
    }

    private fun findCoordinateRing(arr: JsonArray): JsonArray? {
        if (arr.isEmpty) return null
        val first: JsonElement = arr[0]
        if (!first.isJsonArray) return null
        val firstArr = first.asJsonArray
        if (firstArr.isEmpty) return null
        return if (firstArr[0].isJsonPrimitive) {
            arr
        } else {
            findCoordinateRing(firstArr)
        }
    }

    private fun JsonObject.optString(key: String, default: String): String {
        val el = this.get(key)
        return if (el != null && !el.isJsonNull && el.isJsonPrimitive) el.asString else default
    }

    private fun JsonObject.optInt(key: String, default: Int): Int {
        val el = this.get(key)
        return if (el != null && !el.isJsonNull && el.isJsonPrimitive) {
            runCatching { el.asInt }.getOrDefault(default)
        } else default
    }

    private fun JsonObject.optDouble(key: String, default: Double): Double {
        val el = this.get(key)
        return if (el != null && !el.isJsonNull && el.isJsonPrimitive) {
            runCatching { el.asDouble }.getOrDefault(default)
        } else default
    }
}
