import SwiftUI
import Charts
import CoreLocation

public struct ZoneDetailsSheetView: View {
    let zone: ParkingZone
    let onZoom: () -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var selectedTab: Int = 0
    @State private var scheduleDay: DayScheduleType = .weekday
    @State private var historicalData: (points: [HistoricalDataPoint], percentChange: Double) = ([], 0.0)

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Segmented Tab Picker
                Picker("Tab", selection: $selectedTab) {
                    Text("Overview").tag(0)
                    Text("Rates").tag(1)
                    Text("History").tag(2)
                    Text("Rules").tag(3)
                }
                .pickerStyle(SegmentedPickerStyle())
                .padding(.horizontal)
                .padding(.top, 8)
                .padding(.bottom, 6)

                // Tab Content
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        switch selectedTab {
                        case 0:
                            overviewTab
                        case 1:
                            ratesTab
                        case 2:
                            historyTab
                        case 3:
                            rulesTab
                        default:
                            EmptyView()
                        }
                    }
                    .padding()
                }

                Divider()

                // Footer Actions
                footerActions
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                    .background(Color(.secondarySystemBackground))
            }
            .navigationTitle(zone.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .onAppear {
                loadHistory()
            }
        }
    }

    private func loadHistory() {
        self.historicalData = HistoryManager.getZoneHistoricalData(peakRate: zone.rateInfo.maxRate)
    }

    // MARK: - Overview Tab

    private var overviewTab: View {
        VStack(alignment: .leading, spacing: 12) {
            // Header provider & location
            HStack(spacing: 8) {
                let provider = ProviderRegistry.provider(for: zone.providerId)
                Text(provider.name)
                    .font(.caption)
                    .fontWeight(.bold)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(provider.color.opacity(0.18))
                    .foregroundColor(provider.color)
                    .cornerRadius(8)

                if !zone.priceZone.isEmpty {
                    Text(zone.priceZone)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 4)
                        .background(Color(.tertiarySystemBackground))
                        .cornerRadius(6)
                }
                Spacer()
            }

            Text(zone.address)
                .font(.headline)
                .foregroundColor(.primary)

            if !zone.blockSide.isEmpty {
                Text("Block Side: \(fullBlockSide(zone.blockSide))")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            // Live Rate Hero Card
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("CURRENT STATUS")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.secondary)
                    if let rate = zone.rateInfo.currentRate {
                        Text(rate == 0 ? "FREE PARKING" : "$\(String(format: "%.2f", rate)) / hr")
                            .font(.title2)
                            .fontWeight(.bold)
                            .foregroundColor(rate == 0 ? .green : .blue)
                    } else if zone.rateInfo.isNoParkingNow {
                        Text("NO PARKING (RESTRICTED)")
                            .font(.headline)
                            .fontWeight(.bold)
                            .foregroundColor(.red)
                    }
                    Text(zone.rateInfo.currentSlotLabel)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("PEAK DAYTIME")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.secondary)
                    Text("$\(String(format: "%.2f", zone.rateInfo.maxRate))/hr")
                        .font(.headline)
                        .fontWeight(.semibold)
                    if let mins = zone.walkingMinutes {
                        HStack(spacing: 2) {
                            Image(systemName: "figure.walk")
                            Text("~\(mins) min walk")
                        }
                        .font(.caption2)
                        .foregroundColor(.blue)
                    }
                }
            }
            .padding()
            .background(Color(.secondarySystemBackground))
            .cornerRadius(12)

            // 2x2 Metrics Grid
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                metricCard(title: "STALL CAPACITY", value: "\(zone.zoneCapacity > 0 ? zone.zoneCapacity : zone.segCapacity) Stalls", icon: "car.2")
                metricCard(title: "STALL TYPE", value: zone.stallType.isEmpty ? "Standard" : zone.stallType, icon: "rectangle.split.3x3")
                metricCard(title: "AREA / BRZ", value: zone.brzName, icon: "building.2")
                metricCard(title: "CATEGORY", value: zone.facilityType ?? "On-Street", icon: "signpost.right")
            }

            // Commercial Extras (if any)
            if let height = zone.heightLimit {
                metricCard(title: "HEIGHT CLEARANCE", value: height, icon: "arrow.up.and.down")
            }

            if !zone.amenities.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("AMENITIES")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.secondary)
                    WrapView(items: zone.amenities) { am in
                        Text(am)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 3)
                            .background(Color(.tertiarySystemBackground))
                            .cornerRadius(6)
                    }
                }
                .padding()
                .background(Color(.secondarySystemBackground))
                .cornerRadius(10)
            }

            // Enforceable Hours
            if !zone.enforceableTime.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("ENFORCEABLE HOURS")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.secondary)
                    Text(RateParser.formatEnforceableTime(zone.enforceableTime))
                        .font(.subheadline)
                        .fontWeight(.medium)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.secondarySystemBackground))
                .cornerRadius(10)
            }

            // Permit Zone Banner
            if !zone.permitZone.isEmpty {
                HStack {
                    Image(systemName: "exclamationmark.shield.fill")
                        .foregroundColor(.orange)
                    Text("Residential Permit Zone: \(zone.permitZone)")
                        .font(.caption)
                        .fontWeight(.medium)
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.orange.opacity(0.12))
                .cornerRadius(8)
            }
        }
    }

    // MARK: - Rates Tab (Swift Charts 24h Profile)

    private var ratesTab: View {
        let profile = RateParser.generate24HourProfile(rateInfo: zone.rateInfo, dayType: scheduleDay)

        return VStack(alignment: .leading, spacing: 12) {
            // Day selector pills
            Picker("Day", selection: $scheduleDay) {
                ForEach(DayScheduleType.allCases) { d in
                    Text(d.title).tag(d)
                }
            }
            .pickerStyle(SegmentedPickerStyle())

            // 24-Hour Stepped Area Chart
            VStack(alignment: .leading, spacing: 6) {
                Text("24-Hour Rate Curve")
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundColor(.secondary)

                Chart {
                    ForEach(profile) { pt in
                        if let rate = pt.rate {
                            LineMark(
                                x: .value("Hour", pt.hour),
                                y: .value("Rate", rate)
                            )
                            .interpolationMethod(.stepStart)
                            .foregroundStyle(Color.blue)

                            AreaMark(
                                x: .value("Hour", pt.hour),
                                y: .value("Rate", rate)
                            )
                            .interpolationMethod(.stepStart)
                            .foregroundStyle(Color.blue.opacity(0.15))
                        } else if pt.isRestricted {
                            PointMark(
                                x: .value("Hour", pt.hour),
                                y: .value("Rate", 0.0)
                            )
                            .symbolSize(36)
                            .foregroundStyle(Color.red)
                        }
                    }
                }
                .chartYAxis {
                    AxisMarks(format: Decimal.FormatStyle.Currency.currency(code: "USD"))
                }
                .chartXAxis {
                    AxisMarks(values: [0, 6, 12, 18, 23]) { val in
                        if let h = val.as(Int.self) {
                            AxisValueLabel("\(h == 0 ? "12A" : (h == 12 ? "12P" : (h < 12 ? "\(h)A" : "\(h-12)P")))")
                        }
                    }
                }
                .frame(height: 180)
            }
            .padding()
            .background(Color(.secondarySystemBackground))
            .cornerRadius(12)

            // Intervals Timetable
            VStack(alignment: .leading, spacing: 6) {
                Text("Schedule Intervals")
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundColor(.secondary)

                ForEach(zone.rateInfo.intervals) { inv in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(inv.header)
                                .font(.caption)
                                .fontWeight(.medium)
                            Text(inv.rateText)
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                        if inv.isNoParking {
                            Text("RESTRICTED")
                                .font(.caption2)
                                .fontWeight(.bold)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 3)
                                .background(Color.red.opacity(0.15))
                                .foregroundColor(.red)
                                .cornerRadius(6)
                        } else {
                            Text(inv.price == 0 ? "FREE" : "$\(String(format: "%.2f", inv.price))/hr")
                                .font(.caption)
                                .fontWeight(.bold)
                                .foregroundColor(inv.price == 0 ? .green : .blue)
                        }
                    }
                    .padding(8)
                    .background(Color(.tertiarySystemBackground))
                    .cornerRadius(8)
                }
            }
        }
    }

    // MARK: - History Tab (Swift Charts Historical Trend)

    private var historyTab: View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("HISTORICAL PRICE TREND")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(.secondary)
                    Text("Longitudinal rate changes (2023 - Present)")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                Spacer()
                Text(String(format: "%+.1f%%", historicalData.percentChange))
                    .font(.subheadline)
                    .fontWeight(.bold)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(historicalData.percentChange >= 0 ? Color.green.opacity(0.18) : Color.red.opacity(0.18))
                    .foregroundColor(historicalData.percentChange >= 0 ? .green : .red)
                    .cornerRadius(8)
            }

            Chart {
                ForEach(historicalData.points) { pt in
                    LineMark(
                        x: .value("Period", pt.period),
                        y: .value("Rate", pt.rate)
                    )
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(Color.purple)

                    PointMark(
                        x: .value("Period", pt.period),
                        y: .value("Rate", pt.rate)
                    )
                    .foregroundStyle(pt.isLocalSnapshot ? Color.orange : Color.purple)
                }
            }
            .chartYAxis {
                AxisMarks(format: Decimal.FormatStyle.Currency.currency(code: "USD"))
            }
            .frame(height: 180)
            .padding()
            .background(Color(.secondarySystemBackground))
            .cornerRadius(12)

            HStack(spacing: 10) {
                Button {
                    HistoryManager.takeSnapshotNow(peakRate: zone.rateInfo.maxRate)
                    loadHistory()
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "camera")
                        Text("Save Snapshot Now")
                    }
                    .font(.caption)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(Color(.secondarySystemBackground))
                    .cornerRadius(8)
                }

                Button {
                    HistoryManager.clearLocalHistory()
                    loadHistory()
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "trash")
                        Text("Clear History")
                    }
                    .font(.caption)
                    .foregroundColor(.red)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(Color(.secondarySystemBackground))
                    .cornerRadius(8)
                }
            }
        }
    }

    // MARK: - Rules Tab

    private var rulesTab: View {
        VStack(alignment: .leading, spacing: 12) {
            if zone.restrictType != "none" || zone.restrictTime != "none" {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.orange)
                        Text("PARKING RESTRICTION")
                            .font(.caption)
                            .fontWeight(.bold)
                    }
                    Text("\(zone.restrictType) (\(zone.restrictTime))")
                        .font(.subheadline)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.orange.opacity(0.12))
                .cornerRadius(10)
            }

            if !zone.noStopping.isEmpty || !zone.noParking.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Image(systemName: "nosign")
                            .foregroundColor(.red)
                        Text("PROHIBITION ALERT")
                            .font(.caption)
                            .fontWeight(.bold)
                    }
                    if !zone.noStopping.isEmpty {
                        Text("No Stopping: \(zone.noStopping)").font(.subheadline)
                    }
                    if !zone.noParking.isEmpty {
                        Text("No Parking: \(zone.noParking)").font(.subheadline)
                    }
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.red.opacity(0.12))
                .cornerRadius(10)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("TECHNICAL IDENTIFIERS")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.secondary)
                Text("Status: \(zone.status)").font(.caption)
                if zone.segLength > 0 {
                    Text("Segment Length: \(zone.segLength) meters").font(.caption)
                }
                if zone.segCapacity > 0 {
                    Text("Segment Capacity: \(zone.segCapacity) stalls").font(.caption)
                }
                Text(String(format: "Coordinates: %.5f, %.5f", zone.midpoint.latitude, zone.midpoint.longitude))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.secondarySystemBackground))
            .cornerRadius(10)
        }
    }

    // MARK: - Footer Actions & Turn-by-Turn Navigation

    private var footerActions: View {
        HStack(spacing: 8) {
            // Payment Link
            if let payUrlStr = zone.paymentUrl ?? ProviderRegistry.provider(for: zone.providerId).paymentUrl,
               let url = URL(string: payUrlStr) {
                Link(destination: url) {
                    HStack(spacing: 4) {
                        Image(systemName: "creditcard")
                        Text(zone.paymentApp ?? "Pay")
                            .lineLimit(1)
                    }
                    .font(.caption)
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                }
            }

            // Zoom button
            Button {
                onZoom()
                dismiss()
            } label: {
                Image(systemName: "viewfinder")
                    .font(.subheadline)
                    .frame(width: 40, height: 40)
                    .background(Color(.tertiarySystemBackground))
                    .cornerRadius(8)
            }

            // Navigation Menu (Apple Maps + Google Maps)
            Menu {
                Button {
                    openAppleMaps()
                } label: {
                    Label("Apple Maps", systemImage: "map")
                }

                Button {
                    openGoogleMaps()
                } label: {
                    Label("Google Maps", systemImage: "arrow.triangle.turn.up.right.diamond")
                }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "location.fill")
                    Text("Navigate")
                }
                .font(.caption)
                .fontWeight(.semibold)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(Color.green)
                .foregroundColor(.white)
                .cornerRadius(8)
            }
        }
    }

    private func openAppleMaps() {
        let lat = zone.midpoint.latitude
        let lng = zone.midpoint.longitude
        if let url = URL(string: "http://maps.apple.com/?daddr=\(lat),\(lng)&dirflg=d") {
            UIApplication.shared.open(url)
        }
    }

    private func openGoogleMaps() {
        let lat = zone.midpoint.latitude
        let lng = zone.midpoint.longitude
        let appUrl = URL(string: "comgooglemaps://?daddr=\(lat),\(lng)&directionsmode=driving")
        let webUrl = URL(string: "https://www.google.com/maps/search/?api=1&query=\(lat),\(lng)")

        if let appUrl = appUrl, UIApplication.shared.canOpenURL(appUrl) {
            UIApplication.shared.open(appUrl)
        } else if let webUrl = webUrl {
            UIApplication.shared.open(webUrl)
        }
    }

    private func metricCard(title: String, value: String, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                Text(title)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(.secondary)
            }
            Text(value)
                .font(.subheadline)
                .fontWeight(.semibold)
                .lineLimit(1)
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground))
        .cornerRadius(8)
    }

    private func fullBlockSide(_ side: String) -> String {
        switch side.uppercased() {
        case "N": return "North"
        case "S": return "South"
        case "E": return "East"
        case "W": return "West"
        default: return side
        }
    }
}

// Simple Flow/Wrap View for Amenities
private struct WrapView<Item: Hashable, Content: View>: View {
    let items: [Item]
    let content: (Item) -> Content

    var body: some View {
        HStack(spacing: 6) {
            ForEach(items, id: \.self) { item in
                content(item)
            }
        }
    }
}
