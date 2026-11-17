// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CalgaryParkingMap",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "CalgaryParkingCore",
            targets: ["CalgaryParkingCore"]
        )
    ],
    dependencies: [],
    targets: [
        .target(
            name: "CalgaryParkingCore",
            dependencies: [],
            path: "CalgaryParkingMap",
            exclude: [
                "CalgaryParkingMapApp.swift",
                "Views",
                "ViewModels",
                "Info.plist"
            ],
            resources: [
                .process("Resources")
            ]
        ),
        .testTarget(
            name: "CalgaryParkingTests",
            dependencies: ["CalgaryParkingCore"],
            path: "CalgaryParkingTests"
        )
    ]
)
