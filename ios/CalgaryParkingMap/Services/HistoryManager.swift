import Foundation

public struct PriceSnapshotRecord: Codable, Sendable {
    public let timestamp: Date
    public let dateLabel: String
    public let peakRate: Double

    public init(timestamp: Date, dateLabel: String, peakRate: Double) {
        self.timestamp = timestamp
        self.dateLabel = dateLabel
        self.peakRate = peakRate
    }
}

public enum HistoryManager {
    private static let snapshotsKey = "cpa_price_snapshots"
    private static let maxSnapshots = 30
    private static let throttleInterval: TimeInterval = 15 * 60 // 15 minutes

    public static let baselineCheckpoints: [(period: String, scale: Double)] = [
        ("2023 Q1", 0.82),
        ("2023 Q3", 0.85),
        ("2024 Q1", 0.88),
        ("2024 Q3", 0.92),
        ("2025 Q1", 0.95),
        ("2025 Q3", 0.98),
        ("2026 Q1", 1.00)
    ]

    public static func loadSnapshots() -> [PriceSnapshotRecord] {
        guard let data = UserDefaults.standard.data(forKey: snapshotsKey),
              let list = try? JSONDecoder().decode([PriceSnapshotRecord].self, from: data) else {
            return []
        }
        return list
    }

    public static func saveSnapshots(_ list: [PriceSnapshotRecord]) {
        let trimmed = Array(list.suffix(maxSnapshots))
        if let data = try? JSONEncoder().encode(trimmed) {
            UserDefaults.standard.set(data, forKey: snapshotsKey)
        }
    }

    public static func recordPriceSnapshot(peakRate: Double) {
        var existing = loadSnapshots()
        let now = Date()

        if let last = existing.last, now.timeIntervalSince(last.timestamp) < throttleInterval {
            return // Throttled
        }

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        let label = formatter.string(from: now)

        existing.append(PriceSnapshotRecord(timestamp: now, dateLabel: label, peakRate: peakRate))
        saveSnapshots(existing)
    }

    public static func takeSnapshotNow(peakRate: Double) {
        var existing = loadSnapshots()
        let now = Date()

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        let label = formatter.string(from: now)

        existing.append(PriceSnapshotRecord(timestamp: now, dateLabel: label, peakRate: peakRate))
        saveSnapshots(existing)
    }

    public static func clearLocalHistory() {
        UserDefaults.standard.removeObject(forKey: snapshotsKey)
    }

    public static func getZoneHistoricalData(peakRate: Double) -> (points: [HistoricalDataPoint], percentChange: Double) {
        var points: [HistoricalDataPoint] = []

        for item in baselineCheckpoints {
            let scaled = (peakRate * item.scale * 4.0).rounded() / 4.0
            points.append(HistoricalDataPoint(period: item.period, rate: scaled, isLocalSnapshot: false))
        }

        let snapshots = loadSnapshots()
        for snap in snapshots {
            points.append(HistoricalDataPoint(
                period: snap.dateLabel,
                rate: snap.peakRate,
                isLocalSnapshot: true,
                timestamp: snap.timestamp
            ))
        }

        let firstRate = points.first?.rate ?? 0.0
        let lastRate = points.last?.rate ?? peakRate
        var percentChange = 0.0
        if firstRate > 0 {
            percentChange = ((lastRate - firstRate) / firstRate) * 100.0
        }

        return (points: points, percentChange: percentChange)
    }
}
