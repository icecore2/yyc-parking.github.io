import SwiftUI
import CoreLocation

public struct LocationsManagerSheetView: View {
    @Bindable var viewModel: ParkingViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var newLocationName = ""
    @State private var newAddressInput = ""
    @State private var isGeocoding = false
    @State private var errorMessage: String? = nil

    public var body: some View {
        NavigationStack {
            List {
                Section(header: Text("Saved Target Destinations")) {
                    if viewModel.savedLocations.isEmpty {
                        Text("No saved locations yet").foregroundColor(.secondary)
                    } else {
                        ForEach(viewModel.savedLocations) { loc in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(loc.name).font(.subheadline).fontWeight(.semibold)
                                    Text(String(format: "%.4f, %.4f", loc.latitude, loc.longitude))
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                }
                                Spacer()
                                if viewModel.targetLocation?.id == loc.id {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(.blue)
                                }
                            }
                            .contentShape(Rectangle())
                            .onTapGesture {
                                viewModel.setTargetLocation(loc)
                                dismiss()
                            }
                        }
                        .onDelete(perform: deleteLocation)
                    }
                }

                Section(header: Text("Add New Destination")) {
                    TextField("Name (e.g. My Gym, Work, Bistro)", text: $newLocationName)
                    TextField("Address or lat, lng (e.g. 800 5 Ave SW)", text: $newAddressInput)

                    if let err = errorMessage {
                        Text(err).font(.caption).foregroundColor(.red)
                    }

                    Button {
                        geocodeAndAdd()
                    } label: {
                        if isGeocoding {
                            ProgressView()
                        } else {
                            Label("Find Address & Save", systemImage: "magnifyingglass")
                        }
                    }
                    .disabled(newLocationName.isEmpty || newAddressInput.isEmpty || isGeocoding)

                    Button {
                        useGps()
                    } label: {
                        Label("Use My Current GPS Location", systemImage: "location.fill")
                    }

                    Button {
                        viewModel.isPickingLocationOnMap = true
                        dismiss()
                    } label: {
                        Label("Pick Point on Map", systemImage: "hand.tap.fill")
                    }
                }
            }
            .navigationTitle("Target Destinations")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func deleteLocation(at offsets: IndexSet) {
        for idx in offsets {
            let loc = viewModel.savedLocations[idx]
            LocationService.shared.deleteLocation(id: loc.id)
            if viewModel.targetLocation?.id == loc.id {
                viewModel.targetLocation = nil
            }
        }
        viewModel.savedLocations = LocationService.shared.loadSavedLocations()
    }

    private func geocodeAndAdd() {
        isGeocoding = true
        errorMessage = nil

        Task {
            do {
                let coord = try await LocationService.shared.geocodeAddress(newAddressInput)
                let newLoc = LocationService.shared.addLocation(name: newLocationName, coordinate: coord)
                viewModel.savedLocations = LocationService.shared.loadSavedLocations()
                viewModel.setTargetLocation(newLoc)
                isGeocoding = false
                dismiss()
            } catch {
                isGeocoding = false
                errorMessage = error.localizedDescription
            }
        }
    }

    private func useGps() {
        isGeocoding = true
        errorMessage = nil

        Task {
            do {
                let coord = try await LocationService.shared.requestCurrentLocation()
                let name = newLocationName.isEmpty ? "My Location" : newLocationName
                let newLoc = LocationService.shared.addLocation(name: name, coordinate: coord)
                viewModel.savedLocations = LocationService.shared.loadSavedLocations()
                viewModel.setTargetLocation(newLoc)
                isGeocoding = false
                dismiss()
            } catch {
                isGeocoding = false
                errorMessage = error.localizedDescription
            }
        }
    }
}

public struct SettingsSheetView: View {
    @Bindable var viewModel: ParkingViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var apiUrl: String = ""

    public var body: some View {
        NavigationStack {
            Form {
                Section(header: Text("ArcGIS FeatureServer Endpoint")) {
                    TextEditor(text: $apiUrl)
                        .font(.caption)
                        .frame(height: 100)

                    Button("Save & Reload Data") {
                        UserDefaults.standard.set(apiUrl, forKey: "cpa_api_url")
                        dismiss()
                        Task { await viewModel.loadData() }
                    }
                    .fontWeight(.semibold)
                    .disabled(viewModel.isLoading)

                    Button("Reset to Default URL") {
                        apiUrl = ParkingDataService.defaultArcGISUrl
                        UserDefaults.standard.set(apiUrl, forKey: "cpa_api_url")
                    }
                    .foregroundColor(.secondary)
                }

                Section(header: Text("About & Sources")) {
                    Text("Calgary On-Street Parking Map iOS")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                    Text("Aggregates Calgary Parking Authority ArcGIS FeatureServer, City of Calgary Socrata Open Data, Calgary Transit Park & Ride, and commercial facilities.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("API Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .onAppear {
                apiUrl = UserDefaults.standard.string(forKey: "cpa_api_url") ?? ParkingDataService.defaultArcGISUrl
            }
        }
    }
}
