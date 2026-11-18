import Foundation
import SwiftUI
import CoreLocation
import Combine

@MainActor
@Observable
public final class ParkingViewModel {
    // MARK: - Data State
    public var allZones: [ParkingZone] = []
    public var filteredZones: [ParkingZone] = []
    public var bestValueZones: [ParkingZone] = []
    public var providerCounts: [ProviderId: Int] = [:]
    public var activeProviders: Set<ProviderId> = Set(ProviderId.allCases)
    public var allBRZs: [String] = ["ALL"]

    // MARK: - Filter State
    public var searchQuery: String = "" {
        didSet { applyFilters() }
    }
    public var selectedBRZ: String = "ALL" {
        didSet { applyFilters() }
    }
    public var priceFilter: PriceFilterTier = .all {
        didSet { applyFilters() }
    }
    public var rateMode: RateCalculationMode = .max {
        didSet { applyFilters() }
    }
    public var maxRadius: RadiusFilter = .r500 {
        didSet { applyFilters() }
    }
    public var sortCriterion: SortCriterion = .closestCheapest {
        didSet { applyFilters() }
    }

    // MARK: - Target Location State
    public var targetLocation: CustomLocation? {
        didSet { applyFilters() }
    }
    public var savedLocations: [CustomLocation] = []

    // MARK: - Map Layer & UI State
    public var showPins: Bool = true
    public var showShapes: Bool = true
    public var useClustering: Bool = true
    public var mapStyleIndex: Int = 0 // 0: Standard, 1: Muted, 2: Dark
    public var showBestValuePanel: Bool = true
    public var isPickingLocationOnMap: Bool = false

    // MARK: - Sheets & Selection
    public var selectedZone: ParkingZone? = nil
    public var showZoneDetailsSheet: Bool = false
    public var showLocationsSheet: Bool = false
    public var showSettingsSheet: Bool = false

    // MARK: - Sync State
    public var isLoading: Bool = false
    public var statusMessage: String = "Ready"
    public var lastSyncDate: Date? = nil

    // MARK: - Map Center / Region Trigger
    public var mapFocusCoordinate: CLLocationCoordinate2D? = nil

    public init() {
        self.savedLocations = LocationService.shared.loadSavedLocations()
    }

    public func loadData() async {
        guard !isLoading else { return }
        isLoading = true
        statusMessage = "Syncing Calgary parking data..."
        defer { isLoading = false }

        let apiUrl = UserDefaults.standard.string(forKey: "cpa_api_url") ?? ParkingDataService.defaultArcGISUrl
        let loaded = await ParkingDataService.shared.fetchAll(arcGisUrl: apiUrl)

        self.allZones = loaded
        self.lastSyncDate = Date()
        self.statusMessage = "\(loaded.count) locations loaded"

        // Update provider counts
        var counts: [ProviderId: Int] = [:]
        for p in ProviderId.allCases { counts[p] = 0 }
        for zone in loaded {
            counts[zone.providerId, default: 0] += 1
        }
        self.providerCounts = counts

        // Extract BRZs
        var brzs = Set<String>()
        for zone in loaded where zone.brzName != "None" && !zone.brzName.isEmpty {
            brzs.insert(zone.brzName)
        }
        self.allBRZs = ["ALL"] + Array(brzs).sorted()

        // Auto snapshot peak rate for history
        if let firstOnStreet = loaded.first(where: { $0.providerId == .parkplusOnStreet && $0.rateInfo.maxRate > 0 }) {
            HistoryManager.recordPriceSnapshot(peakRate: firstOnStreet.rateInfo.maxRate)
        }

        applyFilters()
    }

    public func applyFilters() {
        var zones = allZones

        // 1. Filter by Active Providers
        zones = zones.filter { activeProviders.contains($0.providerId) }

        // 2. Filter by BRZ
        if selectedBRZ != "ALL" {
            zones = zones.filter { $0.brzName.caseInsensitiveCompare(selectedBRZ) == .orderedSame }
        }

        // 3. Filter by Search Query
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !query.isEmpty {
            zones = zones.filter { zone in
                let provider = ProviderRegistry.provider(for: zone.providerId)
                return zone.zoneNumber.lowercased().contains(query) ||
                       zone.name.lowercased().contains(query) ||
                       zone.address.lowercased().contains(query) ||
                       zone.brzName.lowercased().contains(query) ||
                       (zone.operator?.lowercased().contains(query) == true) ||
                       provider.name.lowercased().contains(query) ||
                       provider.shortName.lowercased().contains(query)
            }
        }

        // 4. Compute Distance to Target (if active)
        if let target = targetLocation {
            let targetCoord = target.coordinate
            for i in 0..<zones.count {
                let dist = CoordinateUtils.distanceInMeters(from: targetCoord, to: zones[i].midpoint)
                zones[i].distanceToTarget = dist
                zones[i].walkingMinutes = CoordinateUtils.walkingMinutes(distanceInMeters: dist)
            }

            // Filter by radius
            if let maxMeters = maxRadius.meters {
                zones = zones.filter { ($0.distanceToTarget ?? Double.infinity) <= maxMeters }
            }
        } else {
            for i in 0..<zones.count {
                zones[i].distanceToTarget = nil
                zones[i].walkingMinutes = nil
            }
        }

        // 5. Filter by Price & Rate Mode
        zones = RateParser.filterZonesByPrice(zones: zones, filter: priceFilter, mode: rateMode)

        // 6. Sorting
        zones.sort { a, b in
            let distA = a.distanceToTarget ?? Double.infinity
            let distB = b.distanceToTarget ?? Double.infinity
            let rateA = (rateMode == .live ? (a.rateInfo.currentRate ?? 0.0) : a.rateInfo.maxRate)
            let rateB = (rateMode == .live ? (b.rateInfo.currentRate ?? 0.0) : b.rateInfo.maxRate)

            switch sortCriterion {
            case .closest:
                return distA < distB

            case .cheapest:
                if rateA != rateB { return rateA < rateB }
                return distA < distB

            case .closestCheapest:
                if maxRadius.meters != nil {
                    // Radius capped: rank cheapest then closest
                    if rateA != rateB { return rateA < rateB }
                    return distA < distB
                } else if targetLocation != nil {
                    // Composite score: normalized distance (500m) + rate ($4/hr)
                    let scoreA = (distA / 500.0) * 0.4 + (rateA / 4.0) * 0.6
                    let scoreB = (distB / 500.0) * 0.4 + (rateB / 4.0) * 0.6
                    return scoreA < scoreB
                } else {
                    return rateA < rateB
                }
            }
        }

        self.filteredZones = zones

        // 7. Best Value Panel (Top 5)
        if targetLocation != nil {
            self.bestValueZones = Array(zones.prefix(5))
        } else {
            self.bestValueZones = []
        }
    }

    public func selectZone(_ zone: ParkingZone) {
        self.selectedZone = zone
        self.showZoneDetailsSheet = true
        self.mapFocusCoordinate = zone.midpoint
    }

    public func setTargetLocation(_ loc: CustomLocation?) {
        self.targetLocation = loc
        if let loc = loc {
            self.mapFocusCoordinate = loc.coordinate
        }
    }

    public func toggleProvider(_ id: ProviderId) {
        if activeProviders.contains(id) {
            activeProviders.remove(id)
        } else {
            activeProviders.insert(id)
        }
        applyFilters()
    }

    public func selectAllProviders() {
        activeProviders = Set(ProviderId.allCases)
        applyFilters()
    }

    public func clearAllProviders() {
        activeProviders.removeAll()
        applyFilters()
    }

    public func resetFilters() {
        searchQuery = ""
        selectedBRZ = "ALL"
        priceFilter = .all
        rateMode = .max
        maxRadius = .r500
        sortCriterion = .closestCheapest
        targetLocation = nil
        activeProviders = Set(ProviderId.allCases)
        applyFilters()
    }
}
