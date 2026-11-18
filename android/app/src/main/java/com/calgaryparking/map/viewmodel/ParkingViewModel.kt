package com.calgaryparking.map.viewmodel

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.calgaryparking.map.model.CustomLocation
import com.calgaryparking.map.model.LatLng
import com.calgaryparking.map.model.ParkingZone
import com.calgaryparking.map.model.PriceFilterTier
import com.calgaryparking.map.model.ProviderId
import com.calgaryparking.map.model.ProviderRegistry
import com.calgaryparking.map.model.RadiusFilter
import com.calgaryparking.map.model.RateCalculationMode
import com.calgaryparking.map.model.SortCriterion
import com.calgaryparking.map.service.CoordinateUtils
import com.calgaryparking.map.service.HistoryManager
import com.calgaryparking.map.service.LocationService
import com.calgaryparking.map.service.ParkingDataService
import com.calgaryparking.map.service.RateParser
import kotlinx.coroutines.launch
import java.util.Date

class ParkingViewModel : ViewModel() {
    // Data State
    var allZones by mutableStateOf<List<ParkingZone>>(emptyList())
        private set
    var filteredZones by mutableStateOf<List<ParkingZone>>(emptyList())
        private set
    var bestValueZones by mutableStateOf<List<ParkingZone>>(emptyList())
        private set
    var providerCounts by mutableStateOf<Map<ProviderId, Int>>(emptyMap())
        private set
    var activeProviders by mutableStateOf<Set<ProviderId>>(ProviderId.entries.toSet())
        private set
    var allBRZs by mutableStateOf(listOf("ALL"))
        private set

    // Filter State
    var searchQuery by mutableStateOf("")
        private set
    var selectedBRZ by mutableStateOf("ALL")
        private set
    var priceFilter by mutableStateOf(PriceFilterTier.ALL)
        private set
    var rateMode by mutableStateOf(RateCalculationMode.MAX)
        private set
    var maxRadius by mutableStateOf(RadiusFilter.R500)
        private set
    var sortCriterion by mutableStateOf(SortCriterion.CLOSEST_CHEAPEST)
        private set

    // Target Location State
    var targetLocation by mutableStateOf<CustomLocation?>(null)
        private set
    var savedLocations by mutableStateOf<List<CustomLocation>>(emptyList())
        private set

    // Map Layer & UI State
    var showPins by mutableStateOf(true)
    var showShapes by mutableStateOf(true)
    var useClustering by mutableStateOf(true)
    var mapStyleIndex by mutableIntStateOf(0) // 0: OSM Standard, 1: CARTO Positron Clean, 2: CARTO Dark
    var isDarkTheme by mutableStateOf(false)
    var showBestValuePanel by mutableStateOf(true)
    var isPickingLocationOnMap by mutableStateOf(false)

    // Sheets & Selection
    var selectedZone by mutableStateOf<ParkingZone?>(null)
    var showZoneDetailsSheet by mutableStateOf(false)
    var showLocationsSheet by mutableStateOf(false)
    var showSettingsSheet by mutableStateOf(false)

    // Sync State
    var isLoading by mutableStateOf(false)
        private set
    var statusMessage by mutableStateOf("Ready")
        private set
    var lastSyncDate by mutableStateOf<Date?>(null)
        private set

    // Map Focus Trigger
    var mapFocusCoordinate by mutableStateOf<LatLng?>(null)

    init {
        savedLocations = LocationService.loadSavedLocations()
    }

    fun loadData(context: Context? = null) {
        if (isLoading) return
        isLoading = true
        statusMessage = "Syncing Calgary parking data..."

        viewModelScope.launch {
            try {
                val apiUrl = LocationService.getSavedApiUrl()
                val loaded = ParkingDataService.fetchAll(arcGisUrl = apiUrl, context = context)

                allZones = loaded
                lastSyncDate = Date()
                statusMessage = "${loaded.size} locations loaded"

                // Update provider counts
                val counts = mutableMapOf<ProviderId, Int>()
                for (p in ProviderId.entries) counts[p] = 0
                for (z in loaded) {
                    counts[z.providerId] = (counts[z.providerId] ?: 0) + 1
                }
                providerCounts = counts

                // Extract BRZs
                val brzs = loaded
                    .map { it.brzName }
                    .filter { it.isNotBlank() && !it.equals("None", ignoreCase = true) }
                    .distinct()
                    .sorted()
                allBRZs = listOf("ALL") + brzs

                // Auto snapshot peak rate for history
                val firstOnStreet = loaded.firstOrNull {
                    it.providerId == ProviderId.PARKPLUS_ON_STREET && it.rateInfo.maxRate > 0.0
                }
                if (firstOnStreet != null) {
                    HistoryManager.recordPriceSnapshot(peakRate = firstOnStreet.rateInfo.maxRate)
                }

                applyFilters()
            } finally {
                isLoading = false
            }
        }
    }

    fun updateSearchQuery(query: String) {
        searchQuery = query
        applyFilters()
    }

    fun updateSelectedBRZ(brz: String) {
        selectedBRZ = brz
        applyFilters()
    }

    fun updatePriceFilter(tier: PriceFilterTier) {
        priceFilter = tier
        applyFilters()
    }

    fun updateRateMode(mode: RateCalculationMode) {
        rateMode = mode
        applyFilters()
    }

    fun updateMaxRadius(radius: RadiusFilter) {
        maxRadius = radius
        applyFilters()
    }

    fun updateSortCriterion(criterion: SortCriterion) {
        sortCriterion = criterion
        applyFilters()
    }

    fun setTarget(loc: CustomLocation?) {
        targetLocation = loc
        if (loc != null) {
            mapFocusCoordinate = loc.coordinate
        }
        applyFilters()
    }

    fun refreshSavedLocations() {
        savedLocations = LocationService.loadSavedLocations()
    }

    fun onMapPickedCoordinate(coord: LatLng) {
        val newLoc = LocationService.addLocation("Selected Point", coord)
        savedLocations = LocationService.loadSavedLocations()
        targetLocation = newLoc
        isPickingLocationOnMap = false
        applyFilters()
    }

    fun selectZone(zone: ParkingZone) {
        selectedZone = zone
        showZoneDetailsSheet = true
        mapFocusCoordinate = zone.midpoint
    }

    fun toggleProvider(id: ProviderId) {
        activeProviders = if (activeProviders.contains(id)) {
            activeProviders - id
        } else {
            activeProviders + id
        }
        applyFilters()
    }

    fun selectAllProviders() {
        activeProviders = ProviderId.entries.toSet()
        applyFilters()
    }

    fun clearAllProviders() {
        activeProviders = emptySet()
        applyFilters()
    }

    fun toggleTheme() {
        isDarkTheme = !isDarkTheme
        if (isDarkTheme && mapStyleIndex == 1) {
            mapStyleIndex = 2
        } else if (!isDarkTheme && mapStyleIndex == 2) {
            mapStyleIndex = 1
        }
    }

    fun resetFilters() {
        searchQuery = ""
        selectedBRZ = "ALL"
        priceFilter = PriceFilterTier.ALL
        rateMode = RateCalculationMode.MAX
        maxRadius = RadiusFilter.R500
        sortCriterion = SortCriterion.CLOSEST_CHEAPEST
        targetLocation = null
        activeProviders = ProviderId.entries.toSet()
        applyFilters()
    }

    fun applyFilters() {
        var zones = allZones

        // 1. Filter by Active Providers
        zones = zones.filter { activeProviders.contains(it.providerId) }

        // 2. Filter by BRZ
        if (selectedBRZ != "ALL") {
            zones = zones.filter { it.brzName.equals(selectedBRZ, ignoreCase = true) }
        }

        // 3. Filter by Search Query
        val q = searchQuery.trim().lowercase()
        if (q.isNotEmpty()) {
            zones = zones.filter { zone ->
                val provider = ProviderRegistry.provider(zone.providerId)
                zone.zoneNumber.lowercase().contains(q) ||
                    zone.name.lowercase().contains(q) ||
                    zone.address.lowercase().contains(q) ||
                    zone.brzName.lowercase().contains(q) ||
                    (zone.operator?.lowercase()?.contains(q) == true) ||
                    provider.name.lowercase().contains(q) ||
                    provider.shortName.lowercase().contains(q)
            }
        }

        // 4. Compute Distance to Target (if active)
        val target = targetLocation
        if (target != null) {
            val targetCoord = target.coordinate
            zones = zones.map { z ->
                val dist = CoordinateUtils.distanceInMeters(targetCoord, z.midpoint)
                val mins = CoordinateUtils.walkingMinutes(dist)
                z.copy(distanceToTarget = dist, walkingMinutes = mins)
            }

            val maxMeters = maxRadius.meters
            if (maxMeters != null) {
                zones = zones.filter { (it.distanceToTarget ?: Double.POSITIVE_INFINITY) <= maxMeters }
            }
        } else {
            zones = zones.map { z ->
                if (z.distanceToTarget != null || z.walkingMinutes != null) {
                    z.copy(distanceToTarget = null, walkingMinutes = null)
                } else {
                    z
                }
            }
        }

        // 5. Filter by Price & Rate Mode
        zones = RateParser.filterZonesByPrice(zones, priceFilter, rateMode)

        // 6. Sorting
        zones = zones.sortedWith { a, b ->
            val distA = a.distanceToTarget ?: Double.POSITIVE_INFINITY
            val distB = b.distanceToTarget ?: Double.POSITIVE_INFINITY
            val rateA = if (rateMode == RateCalculationMode.LIVE) (a.rateInfo.currentRate ?: 0.0) else a.rateInfo.maxRate
            val rateB = if (rateMode == RateCalculationMode.LIVE) (b.rateInfo.currentRate ?: 0.0) else b.rateInfo.maxRate

            when (sortCriterion) {
                SortCriterion.CLOSEST -> distA.compareTo(distB)
                SortCriterion.CHEAPEST -> {
                    val cmp = rateA.compareTo(rateB)
                    if (cmp != 0) cmp else distA.compareTo(distB)
                }
                SortCriterion.CLOSEST_CHEAPEST -> {
                    if (maxRadius.meters != null) {
                        val cmp = rateA.compareTo(rateB)
                        if (cmp != 0) cmp else distA.compareTo(distB)
                    } else if (targetLocation != null) {
                        val scoreA = (distA / 500.0) * 0.4 + (rateA / 4.0) * 0.6
                        val scoreB = (distB / 500.0) * 0.4 + (rateB / 4.0) * 0.6
                        scoreA.compareTo(scoreB)
                    } else {
                        rateA.compareTo(rateB)
                    }
                }
            }
        }

        filteredZones = zones
        bestValueZones = if (targetLocation != null) zones.take(5) else emptyList()
    }
}
