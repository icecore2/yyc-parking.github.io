import SwiftUI

public struct StatusPillView: View {
    let message: String
    let count: Int

    public var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(Color.green)
                .frame(width: 7, height: 7)
            Text("\(count) zones")
                .font(.caption2)
                .fontWeight(.bold)
            Text("•")
                .font(.caption2)
                .foregroundColor(.secondary)
            Text(message)
                .font(.caption2)
                .foregroundColor(.secondary)
                .lineLimit(1)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(.ultraThinMaterial)
        .cornerRadius(14)
        .shadow(color: .black.opacity(0.12), radius: 3, x: 0, y: 1)
    }
}

public struct MapPickerBannerView: View {
    let onCancel: () -> Void

    public var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "hand.tap.fill")
                .foregroundColor(.blue)
            Text("Tap anywhere on the map to place location")
                .font(.caption)
                .fontWeight(.medium)
            Spacer()
            Button("Cancel") {
                onCancel()
            }
            .font(.caption)
            .foregroundColor(.red)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
        .background(Color.yellow.opacity(0.2))
        .background(.ultraThinMaterial)
        .cornerRadius(10)
        .shadow(radius: 2)
    }
}

public struct BestValuePanelView: View {
    @Bindable var viewModel: ParkingViewModel

    public var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "sparkles")
                    .foregroundColor(.yellow)
                Text("Best Value Near Target")
                    .font(.caption)
                    .fontWeight(.bold)
                Spacer()
                Button {
                    withAnimation { viewModel.showBestValuePanel.toggle() }
                } label: {
                    Image(systemName: viewModel.showBestValuePanel ? "chevron.up.circle.fill" : "chevron.down.circle.fill")
                        .foregroundColor(.secondary)
                }
            }

            if viewModel.showBestValuePanel {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Array(viewModel.bestValueZones.enumerated()), id: \.element.id) { index, zone in
                            Button {
                                viewModel.selectZone(zone)
                            } label: {
                                VStack(alignment: .leading, spacing: 3) {
                                    HStack {
                                        Text("#\(index + 1)")
                                            .font(.caption2)
                                            .fontWeight(.bold)
                                            .padding(.horizontal, 4)
                                            .padding(.vertical, 1)
                                            .background(Color.blue.opacity(0.2))
                                            .cornerRadius(4)
                                        Spacer()
                                        if let rate = zone.rateInfo.currentRate {
                                            Text(rate == 0 ? "FREE" : "$\(String(format: "%.2f", rate))/hr")
                                                .font(.caption2)
                                                .fontWeight(.bold)
                                                .foregroundColor(rate == 0 ? .green : .primary)
                                        }
                                    }

                                    Text(zone.name)
                                        .font(.caption)
                                        .fontWeight(.semibold)
                                        .lineLimit(1)
                                    Text(zone.address)
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                        .lineLimit(1)

                                    if let mins = zone.walkingMinutes {
                                        HStack(spacing: 2) {
                                            Image(systemName: "figure.walk")
                                                .font(.system(size: 9))
                                            Text("~\(mins) min (\(Int(zone.distanceToTarget ?? 0))m)")
                                                .font(.system(size: 9))
                                        }
                                        .foregroundColor(.secondary)
                                    }
                                }
                                .padding(8)
                                .frame(width: 140)
                                .background(Color(.secondarySystemBackground))
                                .cornerRadius(8)
                            }
                            .buttonStyle(PlainButtonStyle())
                        }
                    }
                }
            }
        }
        .padding(8)
        .background(.ultraThinMaterial)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.12), radius: 4, x: 0, y: 2)
    }
}

public struct MapLayerControlsView: View {
    @Bindable var viewModel: ParkingViewModel

    public var body: some View {
        VStack(spacing: 6) {
            Button {
                viewModel.showPins.toggle()
            } label: {
                Image(systemName: viewModel.showPins ? "mappin.circle.fill" : "mappin.circle")
                    .foregroundColor(viewModel.showPins ? .blue : .secondary)
            }
            .frame(width: 32, height: 32)
            .background(.ultraThinMaterial)
            .clipShape(Circle())

            Button {
                viewModel.showShapes.toggle()
            } label: {
                Image(systemName: viewModel.showShapes ? "point.filled.topleft.down.curvedto.point.bottomright.up" : "point.topleft.down.curvedto.point.bottomright.up")
                    .foregroundColor(viewModel.showShapes ? .blue : .secondary)
            }
            .frame(width: 32, height: 32)
            .background(.ultraThinMaterial)
            .clipShape(Circle())

            Button {
                viewModel.useClustering.toggle()
            } label: {
                Image(systemName: viewModel.useClustering ? "circle.grid.2x2.fill" : "circle.grid.2x2")
                    .foregroundColor(viewModel.useClustering ? .blue : .secondary)
            }
            .frame(width: 32, height: 32)
            .background(.ultraThinMaterial)
            .clipShape(Circle())

            Menu {
                Picker("Map Style", selection: $viewModel.mapStyleIndex) {
                    Text("Standard").tag(0)
                    Text("Muted Clean").tag(1)
                    Text("Dark Mode").tag(2)
                }
            } label: {
                Image(systemName: "map")
                    .foregroundColor(.primary)
            }
            .frame(width: 32, height: 32)
            .background(.ultraThinMaterial)
            .clipShape(Circle())
        }
        .shadow(radius: 2)
    }
}

public struct ProviderLegendView: View {
    @State private var isExpanded = false

    public var body: some View {
        VStack(alignment: .trailing, spacing: 4) {
            Button {
                withAnimation { isExpanded.toggle() }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "info.circle")
                    Text("Legend")
                        .font(.caption2)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(.ultraThinMaterial)
                .cornerRadius(12)
            }

            if isExpanded {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(ProviderId.allCases) { pId in
                        let p = ProviderRegistry.provider(for: pId)
                        HStack(spacing: 6) {
                            Circle()
                                .fill(p.color)
                                .frame(width: 8, height: 8)
                            Text(p.shortName)
                                .font(.caption2)
                        }
                    }
                }
                .padding(8)
                .background(.ultraThinMaterial)
                .cornerRadius(8)
            }
        }
    }
}
