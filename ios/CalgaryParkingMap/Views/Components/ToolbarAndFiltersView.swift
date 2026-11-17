import SwiftUI

public struct TopHeaderBarView: View {
    @Bindable var viewModel: ParkingViewModel
    @Binding var isFilterBarExpanded: Bool

    public var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 10) {
                Image(systemName: "car.circle.fill")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundColor(.blue)

                VStack(alignment: .leading, spacing: 1) {
                    Text("Calgary Parking")
                        .font(.headline)
                        .fontWeight(.bold)
                    Text("On-Street & Multi-Provider")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                Spacer()

                // Sync Button
                Button {
                    Task { await viewModel.loadData() }
                } label: {
                    if viewModel.isLoading {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle())
                            .scaleEffect(0.8)
                    } else {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 14, weight: .medium))
                    }
                }
                .frame(width: 34, height: 34)
                .background(Color(.secondarySystemBackground))
                .clipShape(Circle())
                .disabled(viewModel.isLoading)

                // Toggle Secondary Filters Bar
                Button {
                    withAnimation { isFilterBarExpanded.toggle() }
                } label: {
                    Image(systemName: isFilterBarExpanded ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                        .font(.system(size: 18))
                        .foregroundColor(isFilterBarExpanded ? .blue : .primary)
                }
                .frame(width: 34, height: 34)
                .background(Color(.secondarySystemBackground))
                .clipShape(Circle())

                // Settings Button
                Button {
                    viewModel.showSettingsSheet = true
                } label: {
                    Image(systemName: "gearshape")
                        .font(.system(size: 16))
                }
                .frame(width: 34, height: 34)
                .background(Color(.secondarySystemBackground))
                .clipShape(Circle())
            }

            // Search Bar & BRZ Picker
            HStack(spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.secondary)
                    TextField("Search Zone #, street, BRZ...", text: $viewModel.searchQuery)
                        .textFieldStyle(PlainTextFieldStyle())
                        .font(.subheadline)
                    if !viewModel.searchQuery.isEmpty {
                        Button {
                            viewModel.searchQuery = ""
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .background(Color(.secondarySystemBackground))
                .cornerRadius(10)

                // BRZ Filter Picker Menu
                Menu {
                    Picker("BRZ District", selection: $viewModel.selectedBRZ) {
                        ForEach(viewModel.allBRZs, id: \.self) { brz in
                            Text(brz).tag(brz)
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "mappin.and.ellipse")
                            .font(.caption)
                        Text(viewModel.selectedBRZ == "ALL" ? "All Areas" : viewModel.selectedBRZ)
                            .font(.caption)
                            .lineLimit(1)
                        Image(systemName: "chevron.down")
                            .font(.caption2)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 8)
                    .background(Color(.secondarySystemBackground))
                    .cornerRadius(8)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial)
    }
}

public struct SecondaryFilterBarView: View {
    @Bindable var viewModel: ParkingViewModel

    public var body: some View {
        VStack(spacing: 8) {
            // Target Location row
            HStack(spacing: 8) {
                Menu {
                    Button("No Target (Citywide)") {
                        viewModel.setTargetLocation(nil)
                    }
                    Divider()
                    ForEach(viewModel.savedLocations) { loc in
                        Button(loc.name) {
                            viewModel.setTargetLocation(loc)
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "target")
                            .font(.caption)
                        Text(viewModel.targetLocation?.name ?? "Set Target Destination")
                            .font(.caption)
                            .lineLimit(1)
                        Image(systemName: "chevron.down")
                            .font(.caption2)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .background(Color(.tertiarySystemBackground))
                    .cornerRadius(8)
                }

                Button {
                    viewModel.showLocationsSheet = true
                } label: {
                    Image(systemName: "slider.horizontal.3")
                        .font(.caption)
                    Text("Manage")
                        .font(.caption2)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(Color(.tertiarySystemBackground))
                .cornerRadius(8)

                if viewModel.targetLocation != nil {
                    // Radius Selector
                    Menu {
                        Picker("Radius", selection: $viewModel.maxRadius) {
                            ForEach(RadiusFilter.allCases) { r in
                                Text(r.title).tag(r)
                            }
                        }
                    } label: {
                        HStack(spacing: 2) {
                            Text(viewModel.maxRadius.title.components(separatedBy: " ").first ?? "Radius")
                                .font(.caption2)
                            Image(systemName: "chevron.down")
                                .font(.caption2)
                        }
                        .padding(.horizontal, 6)
                        .padding(.vertical, 6)
                        .background(Color(.tertiarySystemBackground))
                        .cornerRadius(8)
                    }
                }

                Spacer()

                Button("Reset") {
                    viewModel.resetFilters()
                }
                .font(.caption2)
                .foregroundColor(.red)
            }

            // Price & Sorting row
            HStack(spacing: 8) {
                // Price Filter
                Menu {
                    Picker("Max Price", selection: $viewModel.priceFilter) {
                        ForEach(PriceFilterTier.allCases) { tier in
                            Text(tier.title).tag(tier)
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text(viewModel.priceFilter.title)
                            .font(.caption2)
                        Image(systemName: "chevron.down")
                            .font(.caption2)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .background(Color(.tertiarySystemBackground))
                    .cornerRadius(8)
                }

                // Rate Mode (Peak vs Live)
                Picker("Rate Mode", selection: $viewModel.rateMode) {
                    ForEach(RateCalculationMode.allCases) { mode in
                        Text(mode == .max ? "Peak" : "Live").tag(mode)
                    }
                }
                .pickerStyle(SegmentedPickerStyle())
                .frame(width: 120)

                // Sort Order
                Menu {
                    Picker("Sort", selection: $viewModel.sortCriterion) {
                        ForEach(SortCriterion.allCases) { sort in
                            Text(sort.title).tag(sort)
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.up.arrow.down")
                            .font(.caption2)
                        Image(systemName: "chevron.down")
                            .font(.caption2)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .background(Color(.tertiarySystemBackground))
                    .cornerRadius(8)
                }

                Spacer()
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color(.secondarySystemBackground))
    }
}

public struct ProviderFilterPillsBarView: View {
    @Bindable var viewModel: ParkingViewModel

    public var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                Button {
                    viewModel.selectAllProviders()
                } label: {
                    Text("All")
                        .font(.caption2)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 5)
                        .background(Color(.secondarySystemBackground))
                        .cornerRadius(12)
                }

                Button {
                    viewModel.clearAllProviders()
                } label: {
                    Text("Clear")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 5)
                        .background(Color(.secondarySystemBackground))
                        .cornerRadius(12)
                }

                ForEach(ProviderId.allCases) { pId in
                    let provider = ProviderRegistry.provider(for: pId)
                    let isActive = viewModel.activeProviders.contains(pId)
                    let count = viewModel.providerCounts[pId] ?? 0

                    Button {
                        viewModel.toggleProvider(pId)
                    } label: {
                        HStack(spacing: 4) {
                            Circle()
                                .fill(provider.color)
                                .frame(width: 8, height: 8)
                            Text(provider.shortName)
                                .font(.caption2)
                                .fontWeight(isActive ? .semibold : .regular)
                            Text("(\(count))")
                                .font(.system(size: 9))
                                .foregroundColor(.secondary)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 5)
                        .background(isActive ? provider.color.opacity(0.18) : Color(.tertiarySystemBackground))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(isActive ? provider.color : Color.clear, lineWidth: 1.5)
                        )
                        .cornerRadius(12)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 4)
        }
        .background(.ultraThinMaterial)
    }
}
