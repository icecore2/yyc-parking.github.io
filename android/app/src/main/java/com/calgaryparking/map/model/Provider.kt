package com.calgaryparking.map.model

enum class ProviderCategory(val rawValue: String) {
    MUNICIPAL("MUNICIPAL"),
    TRANSIT("TRANSIT"),
    COMMERCIAL("COMMERCIAL")
}

enum class ProviderId(val rawValue: String) {
    PARKPLUS_ON_STREET("parkplus_on_street"),
    CPA_OFF_STREET("cpa_off_street"),
    CALGARY_TRANSIT("calgary_transit"),
    IMPARK("impark"),
    INDIGO("indigo"),
    PRECISE_PARKLINK("precise_parklink");

    companion object {
        fun fromRawValue(raw: String?): ProviderId? {
            if (raw == null) return null
            return entries.firstOrNull { it.rawValue.equals(raw, ignoreCase = true) }
        }
    }
}

data class ParkingProvider(
    val id: ProviderId,
    val name: String,
    val shortName: String,
    val category: ProviderCategory,
    val operator: String,
    val colorHex: String,
    val borderHex: String,
    val paymentApp: String,
    val paymentUrl: String,
    val description: String,
    val badgeText: String
)

object ProviderRegistry {
    val all: Map<ProviderId, ParkingProvider> = mapOf(
        ProviderId.PARKPLUS_ON_STREET to ParkingProvider(
            id = ProviderId.PARKPLUS_ON_STREET,
            name = "ParkPlus On-Street",
            shortName = "ParkPlus",
            category = ProviderCategory.MUNICIPAL,
            operator = "Calgary Parking Authority",
            colorHex = "#10b981",
            borderHex = "#047857",
            paymentApp = "MyParking / ParkPlus",
            paymentUrl = "https://www.calgaryparking.com/parkplus",
            description = "Curbside metered on-street parking across Calgary",
            badgeText = "P"
        ),
        ProviderId.CPA_OFF_STREET to ParkingProvider(
            id = ProviderId.CPA_OFF_STREET,
            name = "City Parkades & Surface Lots",
            shortName = "City Lots",
            category = ProviderCategory.MUNICIPAL,
            operator = "Calgary Parking Authority",
            colorHex = "#2563eb",
            borderHex = "#1d4ed8",
            paymentApp = "MyParking / ParkPlus",
            paymentUrl = "https://www.calgaryparking.com/find-parking/lots-and-parkades",
            description = "Municipal off-street parkades and surface lots",
            badgeText = "C"
        ),
        ProviderId.CALGARY_TRANSIT to ParkingProvider(
            id = ProviderId.CALGARY_TRANSIT,
            name = "Calgary Transit Park & Ride",
            shortName = "Transit",
            category = ProviderCategory.TRANSIT,
            operator = "Calgary Transit",
            colorHex = "#dc2626",
            borderHex = "#b91c1c",
            paymentApp = "Calgary Transit / CPA",
            paymentUrl = "https://www.calgarytransit.com/content/transit/en/home/rider-information/parking.html",
            description = "CTrain station parking (free & reserved stalls)",
            badgeText = "T"
        ),
        ProviderId.IMPARK to ParkingProvider(
            id = ProviderId.IMPARK,
            name = "Impark (Reef Parking)",
            shortName = "Impark",
            category = ProviderCategory.COMMERCIAL,
            operator = "Impark / Reef",
            colorHex = "#0284c7",
            borderHex = "#0369a1",
            paymentApp = "hangTag",
            paymentUrl = "https://www.hangtag.io/",
            description = "Commercial lots and downtown parkades",
            badgeText = "I"
        ),
        ProviderId.INDIGO to ParkingProvider(
            id = ProviderId.INDIGO,
            name = "Indigo Park",
            shortName = "Indigo",
            category = ProviderCategory.COMMERCIAL,
            operator = "Indigo Park Canada",
            colorHex = "#7c3aed",
            borderHex = "#6d28d9",
            paymentApp = "Indigo Neo",
            paymentUrl = "https://indigoneo.ca/",
            description = "Commercial parkades and major office towers",
            badgeText = "IN"
        ),
        ProviderId.PRECISE_PARKLINK to ParkingProvider(
            id = ProviderId.PRECISE_PARKLINK,
            name = "Precise ParkLink",
            shortName = "ParkLink",
            category = ProviderCategory.COMMERCIAL,
            operator = "Precise ParkLink",
            colorHex = "#ea580c",
            borderHex = "#c2410c",
            paymentApp = "Parkedin",
            paymentUrl = "https://parkedin.com/",
            description = "Campus, institutional, and commercial facilities",
            badgeText = "PL"
        )
    )

    fun provider(id: ProviderId): ParkingProvider {
        return all[id] ?: all.getValue(ProviderId.PARKPLUS_ON_STREET)
    }

    fun provider(rawString: String?): ParkingProvider {
        val id = ProviderId.fromRawValue(rawString) ?: ProviderId.PARKPLUS_ON_STREET
        return provider(id)
    }

    fun parseColorInt(hex: String): Int {
        val clean = hex.trim().removePrefix("#")
        return when (clean.length) {
            6 -> (0xFF000000L or clean.toLong(16)).toInt()
            8 -> clean.toLong(16).toInt()
            else -> 0xFF10B981.toInt()
        }
    }
}

data class TransitStationSeed(
    val name: String,
    val stalls: Int,
    val lat: Double,
    val lng: Double,
    val leg: String,
    val reservedFee: String
) {
    val id: String = "transit_${name.lowercase().replace(" ", "_")}"
    val coordinate: LatLng = LatLng(lat, lng)
}

object TransitSeedData {
    val stations: List<TransitStationSeed> = listOf(
        // South Red Line
        TransitStationSeed("Somerset-Bridlewood", 917, 50.8992, -114.0700, "South", "$85/mo"),
        TransitStationSeed("Shawnessy", 500, 50.9100, -114.0683, "South", "$85/mo"),
        TransitStationSeed("Fish Creek-Lacombe", 1100, 50.9239, -114.0728, "South", "$85/mo"),
        TransitStationSeed("Canyon Meadows", 900, 50.9365, -114.0703, "South", "$85/mo"),
        TransitStationSeed("Anderson", 1729, 50.9568, -114.0683, "South", "$85/mo"),
        TransitStationSeed("Southland", 650, 50.9639, -114.0722, "South", "$85/mo"),
        TransitStationSeed("Heritage", 605, 50.9786, -114.0747, "South", "$85/mo"),
        TransitStationSeed("Chinook", 367, 50.9972, -114.0689, "South", "$85/mo"),

        // NW Red Line
        TransitStationSeed("Tuscany", 550, 51.1158, -114.2289, "NW", "$85/mo"),
        TransitStationSeed("Crowfoot", 1350, 51.1278, -114.2081, "NW", "$85/mo"),
        TransitStationSeed("Dalhousie", 850, 51.1033, -114.1606, "NW", "$85/mo"),
        TransitStationSeed("Brentwood", 950, 51.0875, -114.1331, "NW", "$85/mo"),
        TransitStationSeed("University", 230, 51.0797, -114.1239, "NW", "$85/mo"),

        // West Blue Line
        TransitStationSeed("69 Street", 808, 51.0375, -114.1869, "West", "$85/mo"),
        TransitStationSeed("Sirocco", 350, 51.0378, -114.1681, "West", "$85/mo"),
        TransitStationSeed("Westbrook", 200, 51.0422, -114.1394, "West", "$85/mo"),

        // NE / East Blue Line
        TransitStationSeed("Saddletowne", 150, 51.1256, -113.9483, "NE", "$85/mo"),
        TransitStationSeed("Martindale", 150, 51.1158, -113.9582, "NE", "$85/mo"),
        TransitStationSeed("McKnight-Westwinds", 963, 51.0964, -113.9781, "NE", "$85/mo"),
        TransitStationSeed("Whitehorn", 850, 51.0858, -113.9883, "NE", "$85/mo"),
        TransitStationSeed("Rundle", 550, 51.0744, -113.9986, "NE", "$85/mo"),
        TransitStationSeed("Marlborough", 485, 51.0583, -113.9822, "NE", "$85/mo"),
        TransitStationSeed("Barlow / Max Bell", 50, 51.0456, -114.0108, "East", "Free"),
        TransitStationSeed("Franklin", 600, 51.0489, -114.0200, "East", "$85/mo")
    )
}
