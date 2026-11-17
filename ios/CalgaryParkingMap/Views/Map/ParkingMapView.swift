import SwiftUI
import MapKit

// Custom Annotation class for Parking Zones
public final class ZoneAnnotation: NSObject, MKAnnotation {
    public let zone: ParkingZone
    public var coordinate: CLLocationCoordinate2D

    public var title: String? {
        zone.name
    }

    public var subtitle: String? {
        if let rate = zone.rateInfo.currentRate {
            return "$\(String(format: "%.2f", rate))/hr • \(zone.address)"
        }
        return zone.address
    }

    public init(zone: ParkingZone) {
        self.zone = zone
        self.coordinate = zone.midpoint
        super.init()
    }
}

// Custom Annotation class for Target Location
public final class TargetAnnotation: NSObject, MKAnnotation {
    public let location: CustomLocation
    public var coordinate: CLLocationCoordinate2D {
        location.coordinate
    }

    public var title: String? {
        "Target: \(location.name)"
    }

    public init(location: CustomLocation) {
        self.location = location
        super.init()
    }
}

// Custom Polyline with Zone reference
public final class ZonePolyline: MKPolyline {
    public var zone: ParkingZone?
    public var isSelected: Bool = false
}

// Custom Polygon with Zone reference
public final class ZonePolygon: MKPolygon {
    public var zone: ParkingZone?
    public var isSelected: Bool = false
}

public struct ParkingMapView: UIViewRepresentable {
    @Bindable var viewModel: ParkingViewModel

    public init(viewModel: ParkingViewModel) {
        self.viewModel = viewModel
    }

    public func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView()
        mapView.delegate = context.coordinator

        // Default region: Downtown Calgary
        let center = CLLocationCoordinate2D(latitude: 51.0447, longitude: -114.0719)
        let span = MKCoordinateSpan(latitudeDelta: 0.04, longitudeDelta: 0.04)
        mapView.setRegion(MKCoordinateRegion(center: center, span: span), animated: false)

        mapView.showsUserLocation = true
        mapView.pointOfInterestFilter = .excludingAll

        // Register custom annotation views
        mapView.register(ZoneAnnotationView.self, forAnnotationViewWithReuseIdentifier: ZoneAnnotationView.reuseIdentifier)
        mapView.register(MKClusterAnnotationView.self, forAnnotationViewWithReuseIdentifier: MKMapViewDefaultClusterAnnotationViewReuseIdentifier)

        // Tap gesture for selecting polylines or picking location
        let tapGesture = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleMapTap(_:)))
        mapView.addGestureRecognizer(tapGesture)

        return mapView
    }

    public func updateUIView(_ mapView: MKMapView, context: Context) {
        context.coordinator.parent = self

        // 1. Update Map Style
        switch viewModel.mapStyleIndex {
        case 1:
            mapView.overrideUserInterfaceStyle = .light
            mapView.mapType = .mutedStandard
        case 2:
            mapView.overrideUserInterfaceStyle = .dark
            mapView.mapType = .standard
        default:
            mapView.overrideUserInterfaceStyle = .unspecified
            mapView.mapType = .standard
        }

        // 2. Animate to Focus Coordinate if requested
        if let focus = viewModel.mapFocusCoordinate {
            let region = MKCoordinateRegion(center: focus, span: MKCoordinateSpan(latitudeDelta: 0.012, longitudeDelta: 0.012))
            mapView.setRegion(region, animated: true)
            DispatchQueue.main.async {
                self.viewModel.mapFocusCoordinate = nil
            }
        }

        // 3. Update Annotations
        updateAnnotations(mapView: mapView)

        // 4. Update Overlays (Polylines, Polygons, Target Radius Circle)
        updateOverlays(mapView: mapView)
    }

    private func updateAnnotations(mapView: MKMapView) {
        // Remove existing annotations (except user location)
        let oldAnnotations = mapView.annotations.filter { !($0 is MKUserLocation) }
        mapView.removeAnnotations(oldAnnotations)

        if viewModel.showPins {
            let zoneAnnotations = viewModel.filteredZones.map { ZoneAnnotation(zone: $0) }
            mapView.addAnnotations(zoneAnnotations)
        }

        if let target = viewModel.targetLocation {
            mapView.addAnnotation(TargetAnnotation(location: target))
        }
    }

    private func updateOverlays(mapView: MKMapView) {
        mapView.removeOverlays(mapView.overlays)

        if viewModel.showShapes {
            for zone in viewModel.filteredZones {
                let isSelected = (zone.id == viewModel.selectedZone?.id)

                switch zone.geometry {
                case .onStreetPolyline(let segments):
                    for seg in segments {
                        let polyline = ZonePolyline(coordinates: seg, count: seg.count)
                        polyline.zone = zone
                        polyline.isSelected = isSelected
                        mapView.addOverlay(polyline, level: .aboveRoads)
                    }

                case .offStreetPolygon(let ring):
                    let polygon = ZonePolygon(coordinates: ring, count: ring.count)
                    polygon.zone = zone
                    polygon.isSelected = isSelected
                    mapView.addOverlay(polygon, level: .aboveRoads)

                case .point:
                    break
                }
            }
        }

        // Add Target Radius Catchment Circle if target is active
        if let target = viewModel.targetLocation, let meters = viewModel.maxRadius.meters {
            let circle = MKCircle(center: target.coordinate, radius: meters)
            mapView.addOverlay(circle, level: .aboveRoads)
        }
    }

    public func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    public final class Coordinator: NSObject, MKMapViewDelegate {
        var parent: ParkingMapView

        init(_ parent: ParkingMapView) {
            self.parent = parent
        }

        // MARK: - Annotation Views

        public func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            if annotation is MKUserLocation { return nil }

            if let targetAnnotation = annotation as? TargetAnnotation {
                let identifier = "TargetPin"
                var view = mapView.dequeueReusableAnnotationView(withIdentifier: identifier) as? MKMarkerAnnotationView
                if view == nil {
                    view = MKMarkerAnnotationView(annotation: targetAnnotation, reuseIdentifier: identifier)
                    view?.markerTintColor = UIColor.systemBlue
                    view?.glyphImage = UIImage(systemName: "mappin.circle.fill")
                } else {
                    view?.annotation = targetAnnotation
                }
                return view
            }

            if let zoneAnnotation = annotation as? ZoneAnnotation {
                let view = mapView.dequeueReusableAnnotationView(withIdentifier: ZoneAnnotationView.reuseIdentifier, for: zoneAnnotation) as? ZoneAnnotationView
                view?.configure(with: zoneAnnotation.zone, isSelected: zoneAnnotation.zone.id == parent.viewModel.selectedZone?.id)
                view?.clusteringIdentifier = parent.viewModel.useClustering ? "parkingZoneCluster" : nil
                return view
            }

            return nil
        }

        public func mapView(_ mapView: MKMapView, didSelect view: MKAnnotationView) {
            if let zoneView = view as? ZoneAnnotationView, let zone = zoneView.zone {
                parent.viewModel.selectZone(zone)
            } else if let zoneAnnotation = view.annotation as? ZoneAnnotation {
                parent.viewModel.selectZone(zoneAnnotation.zone)
            }
        }

        // MARK: - Overlay Renderers

        public func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            if let circle = overlay as? MKCircle {
                let renderer = MKCircleRenderer(circle: circle)
                renderer.strokeColor = UIColor.systemBlue.withAlphaComponent(0.85)
                renderer.fillColor = UIColor.systemBlue.withAlphaComponent(0.08)
                renderer.lineWidth = 2.0
                renderer.lineDashPattern = [6, 4]
                return renderer
            }

            if let polyline = overlay as? ZonePolyline {
                let renderer = MKPolylineRenderer(polyline: polyline)
                if polyline.isSelected {
                    renderer.strokeColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1.0) // Amber #f59e0b
                    renderer.lineWidth = 7.0
                } else {
                    renderer.strokeColor = colorForZone(polyline.zone)
                    renderer.lineWidth = 4.0
                }
                return renderer
            }

            if let polygon = overlay as? ZonePolygon {
                let renderer = MKPolygonRenderer(polygon: polygon)
                if polygon.isSelected {
                    renderer.strokeColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1.0)
                    renderer.fillColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 0.45)
                    renderer.lineWidth = 4.0
                } else {
                    renderer.strokeColor = UIColor(red: 29/255, green: 78/255, blue: 216/255, alpha: 1.0)
                    renderer.fillColor = UIColor(red: 37/255, green: 99/255, blue: 235/255, alpha: 0.35)
                    renderer.lineWidth = 2.0
                }
                return renderer
            }

            return MKOverlayRenderer(overlay: overlay)
        }

        private func colorForZone(_ zone: ParkingZone?) -> UIColor {
            guard let zone = zone else { return UIColor.systemBlue }
            if zone.providerId != .parkplusOnStreet {
                let hex = ProviderRegistry.provider(for: zone.providerId).colorHex
                return UIColor(Color(hex: hex))
            }

            // On-street color coding by PRICE_ZONE tier
            switch zone.priceZone {
            case "1", "2":
                return UIColor(red: 59/255, green: 130/255, blue: 246/255, alpha: 0.95) // #3b82f6 Blue
            case "3", "4", "4*":
                return UIColor(red: 6/255, green: 182/255, blue: 212/255, alpha: 0.95) // #06b6d4 Cyan
            case "5", "6":
                return UIColor(red: 16/255, green: 185/255, blue: 129/255, alpha: 0.95) // #10b981 Emerald
            case "7", "8", "9":
                return UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 0.95) // #f59e0b Amber
            case "10", "11", "12":
                return UIColor(red: 139/255, green: 92/255, blue: 246/255, alpha: 0.95) // #8b5cf6 Purple
            default:
                return UIColor(red: 59/255, green: 130/255, blue: 246/255, alpha: 0.95)
            }
        }

        // MARK: - Tap Handling

        @objc func handleMapTap(_ gesture: UITapGestureRecognizer) {
            guard let mapView = gesture.view as? MKMapView else { return }
            let point = gesture.location(in: mapView)
            let coord = mapView.convert(point, toCoordinateFrom: mapView)

            if parent.viewModel.isPickingLocationOnMap {
                _ = LocationService.shared.addLocation(name: "Selected Point", coordinate: coord)
                parent.viewModel.savedLocations = LocationService.shared.loadSavedLocations()
                parent.viewModel.targetLocation = parent.viewModel.savedLocations.last
                parent.viewModel.isPickingLocationOnMap = false
                return
            }
        }
    }
}

// MARK: - Custom Annotation View with Provider Teardrop Badge

public final class ZoneAnnotationView: MKAnnotationView {
    public static let reuseIdentifier = "ZoneAnnotationView"

    public var zone: ParkingZone?
    private let badgeView = UIView()
    private let iconImageView = UIImageView()
    private let rateLabel = UILabel()

    public override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
        setupViews()
    }

    public required init?(coder aDecoder: NSCoder) {
        super.init(coder: aDecoder)
        setupViews()
    }

    private func setupViews() {
        canShowCallout = false
        frame = CGRect(x: 0, y: 0, width: 34, height: 34)

        badgeView.frame = bounds
        badgeView.layer.cornerRadius = 17
        badgeView.layer.masksToBounds = true
        badgeView.layer.borderWidth = 2.0
        badgeView.layer.borderColor = UIColor.white.cgColor
        addSubview(badgeView)

        iconImageView.frame = CGRect(x: 7, y: 7, width: 20, height: 20)
        iconImageView.tintColor = .white
        iconImageView.contentMode = .scaleAspectFit
        badgeView.addSubview(iconImageView)
    }

    public func configure(with zone: ParkingZone, isSelected: Bool) {
        self.zone = zone
        let provider = ProviderRegistry.provider(for: zone.providerId)
        badgeView.backgroundColor = UIColor(Color(hex: provider.colorHex))
        iconImageView.image = UIImage(systemName: provider.systemImage)

        if isSelected {
            badgeView.layer.borderColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1.0).cgColor
            badgeView.layer.borderWidth = 3.5
            transform = CGAffineTransform(scaleX: 1.25, y: 1.25)
        } else {
            badgeView.layer.borderColor = UIColor.white.cgColor
            badgeView.layer.borderWidth = 2.0
            transform = .identity
        }
    }
}
