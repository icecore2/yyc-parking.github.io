import Foundation

public struct CalgaryNowInfo: Sendable {
    public let currentMinutes: Int
    public let dayStr: String
    public let isSunday: Bool
    public let isSaturday: Bool
    public let isWeekday: Bool
}

public enum RateParser {
    private static let calgaryTimeZone = TimeZone(identifier: "America/Edmonton") ?? TimeZone.current

    public static func getCalgaryNow(date: Date = Date()) -> CalgaryNowInfo {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = calgaryTimeZone

        let comps = cal.dateComponents([.weekday, .hour, .minute], from: date)
        let hour = comps.hour ?? 0
        let minute = comps.minute ?? 0
        let weekday = comps.weekday ?? 1 // 1 = Sunday, 7 = Saturday

        let currentMinutes = hour * 60 + minute
        let isSunday = (weekday == 1)
        let isSaturday = (weekday == 7)
        let isWeekday = !isSunday && !isSaturday

        let formatter = DateFormatter()
        formatter.timeZone = calgaryTimeZone
        formatter.dateFormat = "EEE"
        let dayStr = formatter.string(from: date)

        return CalgaryNowInfo(
            currentMinutes: currentMinutes,
            dayStr: dayStr,
            isSunday: isSunday,
            isSaturday: isSaturday,
            isWeekday: isWeekday
        )
    }

    public static func parseTimeRangeToMinutes(_ text: String) -> (start: Int, end: Int)? {
        let pattern = #"(\d{1,2}):(\d{2})\s*(AM|PM)\s*to\s*(\d{1,2}):(\d{2})\s*(AM|PM)"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) else {
            return nil
        }

        func extract(groupIndex: Int) -> String {
            let range = match.range(at: groupIndex)
            if let swiftRange = Range(range, in: text) {
                return String(text[swiftRange])
            }
            return ""
        }

        let startH = Int(extract(groupIndex: 1)) ?? 0
        let startM = Int(extract(groupIndex: 2)) ?? 0
        let startAmPm = extract(groupIndex: 3).uppercased()

        let endH = Int(extract(groupIndex: 4)) ?? 0
        let endM = Int(extract(groupIndex: 5)) ?? 0
        let endAmPm = extract(groupIndex: 6).uppercased()

        func to24(h: Int, ampm: String) -> Int {
            var res = h % 12
            if ampm == "PM" { res += 12 }
            return res
        }

        let startMinutes = to24(h: startH, ampm: startAmPm) * 60 + startM
        let endMinutes = to24(h: endH, ampm: endAmPm) * 60 + endM

        return (start: startMinutes, end: endMinutes)
    }

    public static func parseZoneRateSchedule(_ rawHtml: String, now: Date = Date()) -> ZoneRateInfo {
        let clean = rawHtml
            .replacingOccurrences(of: "(?i)<br\\s*/?>", with: "\n", options: .regularExpression)
            .replacingOccurrences(of: "(?i)</p>", with: "\n", options: .regularExpression)
            .replacingOccurrences(of: "(?i)</div>", with: "\n", options: .regularExpression)
            .replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
            .replacingOccurrences(of: "&nbsp;", with: " ")

        let lines = clean
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        var intervals: [RateInterval] = []
        var prices: [Double] = []

        let priceRegex = try? NSRegularExpression(pattern: #"\$([0-9]+(?:\.[0-9]{2})?)"#)

        var idx = 0
        while idx < lines.count {
            let header = lines[idx]
            let rateText = (idx + 1 < lines.count) ? lines[idx + 1] : ""
            idx += 2

            let headerLower = header.lowercased()
            let rateTextLower = rateText.lowercased()

            let isFree = rateTextLower.contains("free") || headerLower.contains("free")
            let isNoParking = rateTextLower.contains("no parking") || headerLower.contains("no parking")

            var price = 0.0
            if !isNoParking && !isFree, let priceRegex = priceRegex {
                let range = NSRange(rateText.startIndex..., in: rateText)
                if let match = priceRegex.firstMatch(in: rateText, range: range),
                   let matchRange = Range(match.range(at: 1), in: rateText) {
                    price = Double(rateText[matchRange]) ?? 0.0
                }
            }

            if !isNoParking {
                prices.append(price)
            }

            var appliesDays = "all"
            if headerLower.contains("mon-fri") || headerLower.contains("mon to fri") {
                appliesDays = "weekday"
            } else if headerLower.contains("saturday") {
                appliesDays = "saturday"
            } else if headerLower.contains("sunday") || headerLower.contains("holiday") {
                appliesDays = "sunday"
            }

            var startMin = 0
            var endMin = 1440
            if let range = parseTimeRangeToMinutes(header) {
                startMin = range.start
                endMin = range.end
            }

            intervals.append(RateInterval(
                header: header,
                rateText: rateText,
                price: price,
                isFree: isFree,
                isNoParking: isNoParking,
                startMinutes: startMin,
                endMinutes: endMin,
                appliesDays: appliesDays
            ))
        }

        let maxRate = prices.max() ?? 0.0
        let minRate = prices.min() ?? 0.0

        let calgary = getCalgaryNow(date: now)

        if calgary.isSunday {
            return ZoneRateInfo(
                currentRate: 0.0,
                maxRate: maxRate,
                minRate: minRate,
                isCurrentlyFree: true,
                currentSlotLabel: "Sunday (Free Parking)",
                isNoParkingNow: false,
                intervals: intervals
            )
        }

        let todayType = calgary.isSaturday ? "saturday" : "weekday"
        let matched = intervals.first { inv in
            let dayMatch = (inv.appliesDays == todayType || inv.appliesDays == "all")
            let timeMatch = (calgary.currentMinutes >= inv.startMinutes && calgary.currentMinutes < inv.endMinutes)
            return dayMatch && timeMatch
        }

        if let matched = matched {
            if matched.isNoParking {
                return ZoneRateInfo(
                    currentRate: nil,
                    maxRate: maxRate,
                    minRate: minRate,
                    isCurrentlyFree: false,
                    currentSlotLabel: "\(matched.header): \(matched.rateText)",
                    isNoParkingNow: true,
                    intervals: intervals
                )
            } else {
                let isFree = matched.isFree || matched.price == 0
                return ZoneRateInfo(
                    currentRate: matched.price,
                    maxRate: maxRate,
                    minRate: minRate,
                    isCurrentlyFree: isFree,
                    currentSlotLabel: "\(matched.header): \(matched.rateText)",
                    isNoParkingNow: false,
                    intervals: intervals
                )
            }
        }

        return ZoneRateInfo(
            currentRate: 0.0,
            maxRate: maxRate,
            minRate: minRate,
            isCurrentlyFree: true,
            currentSlotLabel: "After Hours (Free Parking)",
            isNoParkingNow: false,
            intervals: intervals
        )
    }

    public static func generate24HourProfile(rateInfo: ZoneRateInfo, dayType: DayScheduleType) -> [HourlyRatePoint] {
        var points: [HourlyRatePoint] = []

        for hour in 0..<24 {
            let hour12 = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour)
            let ampm = hour < 12 ? "AM" : "PM"
            let hourLabel = "\(hour12) \(ampm)"
            let currentMin = hour * 60 + 30

            if dayType == .sunday {
                points.append(HourlyRatePoint(
                    hour: hour,
                    hourLabel: hourLabel,
                    rate: 0.0,
                    isRestricted: false,
                    label: "Free Parking"
                ))
                continue
            }

            let todayTypeStr = (dayType == .saturday) ? "saturday" : "weekday"
            let matched = rateInfo.intervals.first { inv in
                let dayMatch = (inv.appliesDays == todayTypeStr || inv.appliesDays == "all")
                let timeMatch = (currentMin >= inv.startMinutes && currentMin < inv.endMinutes)
                return dayMatch && timeMatch
            }

            if let matched = matched {
                if matched.isNoParking {
                    points.append(HourlyRatePoint(
                        hour: hour,
                        hourLabel: hourLabel,
                        rate: nil,
                        isRestricted: true,
                        label: "No Parking (Restriction)"
                    ))
                } else {
                    points.append(HourlyRatePoint(
                        hour: hour,
                        hourLabel: hourLabel,
                        rate: matched.price,
                        isRestricted: false,
                        label: "$\(String(format: "%.2f", matched.price))/hr"
                    ))
                }
            } else {
                points.append(HourlyRatePoint(
                    hour: hour,
                    hourLabel: hourLabel,
                    rate: 0.0,
                    isRestricted: false,
                    label: "Free Parking (Off-Peak)"
                ))
            }
        }

        return points
    }

    public static func filterZonesByPrice(
        zones: [ParkingZone],
        filter: PriceFilterTier,
        mode: RateCalculationMode
    ) -> [ParkingZone] {
        switch filter {
        case .all:
            return zones

        case .free:
            if mode == .live {
                return zones.filter { zone in
                    zone.rateInfo.isCurrentlyFree || (zone.rateInfo.currentRate ?? 0.0) == 0.0
                }
            } else {
                return zones.filter { zone in
                    zone.rateInfo.maxRate == 0.0
                }
            }

        case .one, .two, .three, .four, .five:
            guard let cap = filter.numericCap else { return zones }
            // Note: Per existing web app logic & test suite, numeric caps filter by maxRate
            return zones.filter { zone in
                zone.rateInfo.maxRate <= cap
            }
        }
    }

    public static func extractCommercialRate(ratesSummary: String, facilityType: String?) -> Double {
        let pattern1 = #"(?:Hourly|Weekday):\s*\$([0-9]+(?:\.[0-9]{2})?)"#
        let pattern2 = #"\$([0-9]+(?:\.[0-9]{2})?)\/hr"#

        if let regex1 = try? NSRegularExpression(pattern: pattern1, options: .caseInsensitive),
           let match = regex1.firstMatch(in: ratesSummary, range: NSRange(ratesSummary.startIndex..., in: ratesSummary)),
           let range = Range(match.range(at: 1), in: ratesSummary) {
            return Double(ratesSummary[range]) ?? 5.0
        }

        if let regex2 = try? NSRegularExpression(pattern: pattern2, options: .caseInsensitive),
           let match = regex2.firstMatch(in: ratesSummary, range: NSRange(ratesSummary.startIndex..., in: ratesSummary)),
           let range = Range(match.range(at: 1), in: ratesSummary) {
            return Double(ratesSummary[range]) ?? 5.0
        }

        return (facilityType?.uppercased() == "PARKADE") ? 5.0 : 4.0
    }

    public static func formatEnforceableTime(_ raw: String) -> String {
        let pattern = #"^(\d{2})(\d{2})-(\d{2})(\d{2})\s*(.*)$"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: raw, range: NSRange(raw.startIndex..., in: raw)) else {
            return raw.isEmpty ? "Standard Hours" : raw
        }

        func extract(group: Int) -> String {
            let r = match.range(at: group)
            if let sw = Range(r, in: raw) {
                return String(raw[sw])
            }
            return ""
        }

        let startH = extract(group: 1)
        let startM = extract(group: 2)
        let endH = extract(group: 3)
        let endM = extract(group: 4)
        let rest = extract(group: 5).trimmingCharacters(in: .whitespaces)

        let suffix = rest.isEmpty ? "" : " (\(rest))"
        return "\(startH):\(startM) - \(endH):\(endM)\(suffix)"
    }
}
