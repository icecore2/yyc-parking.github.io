package com.calgaryparking.map.ui.map

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.drawable.BitmapDrawable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import com.calgaryparking.map.model.LatLng
import com.calgaryparking.map.model.ParkingGeometryType
import com.calgaryparking.map.model.ParkingZone
import com.calgaryparking.map.model.ProviderId
import com.calgaryparking.map.model.ProviderRegistry
import com.calgaryparking.map.viewmodel.ParkingViewModel
import org.osmdroid.config.Configuration
import org.osmdroid.events.MapEventsReceiver
import org.osmdroid.events.MapListener
import org.osmdroid.events.ScrollEvent
import org.osmdroid.events.ZoomEvent
import org.osmdroid.tileprovider.tilesource.OnlineTileSourceBase
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.tileprovider.tilesource.XYTileSource
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.MapEventsOverlay
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polygon
import org.osmdroid.views.overlay.Polyline
import kotlin.math.floor
import kotlin.math.pow

private val cartoPositronTileSource: OnlineTileSourceBase = XYTileSource(
    "CartoPositron",
    0,
    19,
    256,
    ".png",
    arrayOf(
        "https://a.basemaps.cartocdn.com/light_all/",
        "https://b.basemaps.cartocdn.com/light_all/",
        "https://c.basemaps.cartocdn.com/light_all/"
    )
)

private val cartoDarkTileSource: OnlineTileSourceBase = XYTileSource(
    "CartoDark",
    0,
    19,
    256,
    ".png",
    arrayOf(
        "https://a.basemaps.cartocdn.com/dark_all/",
        "https://b.basemaps.cartocdn.com/dark_all/",
        "https://c.basemaps.cartocdn.com/dark_all/"
    )
)

@Composable
fun ParkingMapView(
    viewModel: ParkingViewModel,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var currentZoom by remember { mutableDoubleStateOf(14.5) }
    val badgeCache = remember { mutableMapOf<String, BitmapDrawable>() }

    val mapView = remember {
        Configuration.getInstance().userAgentValue = "CalgaryParkingMap-Android/1.0"
        MapView(context).apply {
            setMultiTouchControls(true)
            setBuiltInZoomControls(false)
            isTilesScaledToDpi = true
            controller.setZoom(14.5)
            controller.setCenter(GeoPoint(51.0447, -114.0719)) // Downtown Calgary
            addMapListener(object : MapListener {
                override fun onScroll(event: ScrollEvent?): Boolean = false
                override fun onZoom(event: ZoomEvent?): Boolean {
                    val z = event?.zoomLevel ?: zoomLevelDouble
                    if (kotlin.math.abs(z - currentZoom) >= 0.6) {
                        currentZoom = z
                    }
                    return false
                }
            })
        }
    }

    DisposableEffect(mapView) {
        mapView.onResume()
        onDispose {
            mapView.onPause()
        }
    }

    AndroidView(
        factory = { mapView },
        modifier = modifier,
        update = { mv ->
            // 1. Tile Source Selection
            val desiredTileSource = when (viewModel.mapStyleIndex) {
                1 -> cartoPositronTileSource
                2 -> cartoDarkTileSource
                else -> TileSourceFactory.MAPNIK
            }
            if (mv.tileProvider.tileSource.name() != desiredTileSource.name()) {
                mv.setTileSource(desiredTileSource)
            }

            // 2. Focus Coordinate Animation
            val focus = viewModel.mapFocusCoordinate
            if (focus != null) {
                mv.controller.animateTo(GeoPoint(focus.latitude, focus.longitude), 16.5, 450L)
                viewModel.mapFocusCoordinate = null
            }

            // 3. Rebuild Overlays
            mv.overlays.clear()

            // Map Tap Receiver for Picking Destination on Map
            val eventsOverlay = MapEventsOverlay(object : MapEventsReceiver {
                override fun singleTapConfirmedHelper(p: GeoPoint?): Boolean {
                    if (p != null && viewModel.isPickingLocationOnMap) {
                        viewModel.onMapPickedCoordinate(LatLng(p.latitude, p.longitude))
                        return true
                    }
                    return false
                }

                override fun longPressHelper(p: GeoPoint?): Boolean = false
            })
            mv.overlays.add(eventsOverlay)

            // Target Catchment Circle & Pin
            val target = viewModel.targetLocation
            if (target != null) {
                val radiusMeters = viewModel.maxRadius.meters
                if (radiusMeters != null) {
                    val circlePolygon = Polygon(mv).apply {
                        points = Polygon.pointsAsCircle(
                            GeoPoint(target.latitude, target.longitude),
                            radiusMeters
                        )
                        fillPaint.color = 0x182563EB
                        outlinePaint.color = 0xD92563EB.toInt()
                        outlinePaint.strokeWidth = 5f
                        outlinePaint.pathEffect = DashPathEffect(floatArrayOf(16f, 12f), 0f)
                    }
                    mv.overlays.add(circlePolygon)
                }

                val targetMarker = Marker(mv).apply {
                    position = GeoPoint(target.latitude, target.longitude)
                    title = "Target: ${target.name}"
                    setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                    icon = getOrCreateBadgeDrawable(
                        context = context,
                        cache = badgeCache,
                        key = "target_pin",
                        bgColor = 0xFF2563EB.toInt(),
                        borderColor = 0xFFFFFFFF.toInt(),
                        label = "★",
                        isSelected = true
                    )
                }
                mv.overlays.add(targetMarker)
            }

            // 4. Street Polylines & Off-Street Polygons
            if (viewModel.showShapes) {
                val selectedId = viewModel.selectedZone?.id
                for (zone in viewModel.filteredZones) {
                    val isSelected = zone.id == selectedId
                    when (val geom = zone.geometry) {
                        is ParkingGeometryType.OnStreetPolyline -> {
                            val colorInt = if (isSelected) 0xFFF59E0B.toInt() else colorForZone(zone)
                            val strokeW = if (isSelected) 12f else 7f
                            for (seg in geom.segments) {
                                val poly = Polyline(mv).apply {
                                    setPoints(seg.map { GeoPoint(it.latitude, it.longitude) })
                                    outlinePaint.color = colorInt
                                    outlinePaint.strokeWidth = strokeW
                                    outlinePaint.strokeCap = Paint.Cap.ROUND
                                    setOnClickListener { _, _, _ ->
                                        viewModel.selectZone(zone)
                                        true
                                    }
                                }
                                mv.overlays.add(poly)
                            }
                        }
                        is ParkingGeometryType.OffStreetPolygon -> {
                            val polygon = Polygon(mv).apply {
                                points = geom.ring.map { GeoPoint(it.latitude, it.longitude) }
                                if (isSelected) {
                                    outlinePaint.color = 0xFFF59E0B.toInt()
                                    outlinePaint.strokeWidth = 8f
                                    fillPaint.color = 0x73F59E0B
                                } else {
                                    outlinePaint.color = 0xFF1D4ED8.toInt()
                                    outlinePaint.strokeWidth = 4f
                                    fillPaint.color = 0x592563EB
                                }
                                setOnClickListener { _, _, _ ->
                                    viewModel.selectZone(zone)
                                    true
                                }
                            }
                            mv.overlays.add(polygon)
                        }
                        is ParkingGeometryType.Point -> Unit
                    }
                }
            }

            // 5. Pins & Spatial Clustering
            if (viewModel.showPins) {
                val selectedId = viewModel.selectedZone?.id
                val zoom = mv.zoomLevelDouble
                val shouldCluster = viewModel.useClustering && zoom < 16.2 && viewModel.filteredZones.size > 40

                if (shouldCluster) {
                    val clusters = buildSpatialClusters(viewModel.filteredZones, zoom)
                    for (cluster in clusters) {
                        if (cluster.size == 1) {
                            mv.overlays.add(
                                createZoneMarker(
                                    context = context,
                                    mapView = mv,
                                    cache = badgeCache,
                                    zone = cluster[0],
                                    isSelected = cluster[0].id == selectedId,
                                    onSelect = { viewModel.selectZone(it) }
                                )
                            )
                        } else {
                            val avgLat = cluster.sumOf { it.midpoint.latitude } / cluster.size
                            val avgLng = cluster.sumOf { it.midpoint.longitude } / cluster.size
                            val clusterMarker = Marker(mv).apply {
                                position = GeoPoint(avgLat, avgLng)
                                setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                                icon = getOrCreateClusterDrawable(
                                    context = context,
                                    cache = badgeCache,
                                    count = cluster.size
                                )
                                setOnMarkerClickListener { _, _ ->
                                    mv.controller.animateTo(
                                        GeoPoint(avgLat, avgLng),
                                        (mv.zoomLevelDouble + 2.0).coerceAtMost(18.0),
                                        350L
                                    )
                                    true
                                }
                            }
                            mv.overlays.add(clusterMarker)
                        }
                    }
                } else {
                    for (zone in viewModel.filteredZones) {
                        mv.overlays.add(
                            createZoneMarker(
                                context = context,
                                mapView = mv,
                                cache = badgeCache,
                                zone = zone,
                                isSelected = zone.id == selectedId,
                                onSelect = { viewModel.selectZone(it) }
                            )
                        )
                    }
                }
            }

            mv.invalidate()
        }
    )
}

private fun createZoneMarker(
    context: Context,
    mapView: MapView,
    cache: MutableMap<String, BitmapDrawable>,
    zone: ParkingZone,
    isSelected: Boolean,
    onSelect: (ParkingZone) -> Unit
): Marker {
    val provider = ProviderRegistry.provider(zone.providerId)
    val bgColor = ProviderRegistry.parseColorInt(provider.colorHex)
    val borderColor = if (isSelected) 0xFFF59E0B.toInt() else 0xFFFFFFFF.toInt()
    val key = "${zone.providerId.rawValue}_$isSelected"

    return Marker(mapView).apply {
        position = GeoPoint(zone.midpoint.latitude, zone.midpoint.longitude)
        title = zone.name
        setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
        icon = getOrCreateBadgeDrawable(
            context = context,
            cache = cache,
            key = key,
            bgColor = bgColor,
            borderColor = borderColor,
            label = provider.badgeText,
            isSelected = isSelected
        )
        setOnMarkerClickListener { _, _ ->
            onSelect(zone)
            true
        }
    }
}

private fun buildSpatialClusters(zones: List<ParkingZone>, zoom: Double): List<List<ParkingZone>> {
    // Grid cell size in degrees scales inversely with 2^zoom
    val cellDegrees = 36.0 / 2.0.pow(zoom.coerceIn(8.0, 17.0))
    val buckets = LinkedHashMap<Long, MutableList<ParkingZone>>()

    for (z in zones) {
        val gx = floor((z.midpoint.longitude + 180.0) / cellDegrees).toLong()
        val gy = floor((z.midpoint.latitude + 90.0) / cellDegrees).toLong()
        val key = (gx shl 32) xor (gy and 0xFFFFFFFFL)
        buckets.getOrPut(key) { mutableListOf() }.add(z)
    }

    return buckets.values.toList()
}

private fun colorForZone(zone: ParkingZone): Int {
    if (zone.providerId != ProviderId.PARKPLUS_ON_STREET) {
        return ProviderRegistry.parseColorInt(ProviderRegistry.provider(zone.providerId).colorHex)
    }
    return when (zone.priceZone) {
        "1", "2" -> 0xF23B82F6.toInt()
        "3", "4", "4*" -> 0xF206B6D4.toInt()
        "5", "6" -> 0xF210B981.toInt()
        "7", "8", "9" -> 0xF2F59E0B.toInt()
        "10", "11", "12" -> 0xF28B5CF6.toInt()
        else -> 0xF23B82F6.toInt()
    }
}

private fun getOrCreateBadgeDrawable(
    context: Context,
    cache: MutableMap<String, BitmapDrawable>,
    key: String,
    bgColor: Int,
    borderColor: Int,
    label: String,
    isSelected: Boolean
): BitmapDrawable {
    cache[key]?.let { return it }

    val density = context.resources.displayMetrics.density
    val sizePx = ((if (isSelected) 34 else 28) * density).toInt().coerceAtLeast(28)
    val bmp = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    val radius = sizePx / 2f

    val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = bgColor
    }
    val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        color = borderColor
        strokeWidth = (if (isSelected) 3f else 2f) * density
    }
    val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFFFFFFFF.toInt()
        textSize = (if (label.length > 1) 10f else 12f) * density
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        textAlign = Paint.Align.CENTER
    }

    canvas.drawCircle(radius, radius, radius - strokePaint.strokeWidth, fillPaint)
    canvas.drawCircle(radius, radius, radius - strokePaint.strokeWidth, strokePaint)

    val textY = radius - (textPaint.descent() + textPaint.ascent()) / 2f
    canvas.drawText(label, radius, textY, textPaint)

    val drawable = BitmapDrawable(context.resources, bmp)
    cache[key] = drawable
    return drawable
}

private fun getOrCreateClusterDrawable(
    context: Context,
    cache: MutableMap<String, BitmapDrawable>,
    count: Int
): BitmapDrawable {
    val label = if (count > 999) "999+" else count.toString()
    val key = "cluster_$label"
    cache[key]?.let { return it }

    val density = context.resources.displayMetrics.density
    val sizePx = (38 * density).toInt().coerceAtLeast(38)
    val bmp = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    val radius = sizePx / 2f

    val clusterColor = when {
        count >= 100 -> 0xFF7C3AED.toInt()
        count >= 25 -> 0xFF2563EB.toInt()
        else -> 0xFF059669.toInt()
    }

    val outerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = (clusterColor and 0x00FFFFFF) or 0x44000000
    }
    val innerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = clusterColor
    }
    val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFFFFFFFF.toInt()
        textSize = 11f * density
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        textAlign = Paint.Align.CENTER
    }

    canvas.drawCircle(radius, radius, radius, outerPaint)
    canvas.drawCircle(radius, radius, radius * 0.78f, innerPaint)

    val textY = radius - (textPaint.descent() + textPaint.ascent()) / 2f
    canvas.drawText(label, radius, textY, textPaint)

    val drawable = BitmapDrawable(context.resources, bmp)
    cache[key] = drawable
    return drawable
}
