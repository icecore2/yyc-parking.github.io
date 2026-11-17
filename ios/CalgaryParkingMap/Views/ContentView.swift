import SwiftUI

public struct ContentView: View {
    @State private var viewModel = ParkingViewModel()
    @State private var isFilterBarExpanded = false

    public init() {}

    public var body: some View {
        VStack(spacing: 0) {
            // Header Bar
            TopHeaderBarView(viewModel: viewModel, isFilterBarExpanded: $isFilterBarExpanded)

            // Collapsible Secondary Filters Bar
            if isFilterBarExpanded {
                SecondaryFilterBarView(viewModel: viewModel)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }

            // Provider Pills Bar
            ProviderFilterPillsBarView(viewModel: viewModel)

            // Main Map with Overlays
            ZStack(alignment: .topLeading) {
                ParkingMapView(viewModel: viewModel)
                    .ignoresSafeArea(edges: .bottom)

                // Overlays container
                VStack(alignment: .leading, spacing: 8) {
                    if viewModel.isPickingLocationOnMap {
                        MapPickerBannerView {
                            viewModel.isPickingLocationOnMap = false
                        }
                    }

                    StatusPillView(message: viewModel.statusMessage, count: viewModel.filteredZones.count)

                    if viewModel.targetLocation != nil && !viewModel.bestValueZones.isEmpty {
                        BestValuePanelView(viewModel: viewModel)
                            .frame(maxWidth: 320)
                    }

                    Spacer()

                    // Bottom controls row
                    HStack(alignment: .bottom) {
                        MapLayerControlsView(viewModel: viewModel)
                        Spacer()
                        ProviderLegendView()
                    }
                    .padding(.bottom, 20)
                }
                .padding(10)
            }
        }
        .task {
            await viewModel.loadData()
        }
        .sheet(isPresented: $viewModel.showZoneDetailsSheet) {
            if let zone = viewModel.selectedZone {
                ZoneDetailsSheetView(zone: zone) {
                    viewModel.mapFocusCoordinate = zone.midpoint
                }
                .presentationDetents([.medium, .large])
            }
        }
        .sheet(isPresented: $viewModel.showLocationsSheet) {
            LocationsManagerSheetView(viewModel: viewModel)
        }
        .sheet(isPresented: $viewModel.showSettingsSheet) {
            SettingsSheetView(viewModel: viewModel)
        }
    }
}
