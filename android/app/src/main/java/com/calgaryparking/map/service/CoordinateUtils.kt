package com.calgaryparking.map.service

import com.calgaryparking.map.model.LatLng
import kotlin.math.abs
import kotlin.math.asin
import kotlin.math.atan
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

object CoordinateUtils {
    /**
     * Converts Esri Web Mercator (EPSG:3857 / EPSG:102100) coordinates to WGS84 (EPSG:4326) Lat/Lng.
     */
    fun webMercatorToLatLng(x: Double, y: Double): LatLng {
        val lng = (x / 20037508.34) * 180.0
        var lat = (y / 20037508.34) * 180.0
        lat = (180.0 / Math.PI) * (2.0 * atan(exp((lat * Math.PI) / 180.0)) - Math.PI / 2.0)
        return LatLng(latitude = lat, longitude = lng)
    }

    /**
     * Normalizes coordinate pairs: detects if Web Mercator or WGS84 and returns LatLng.
     */
    fun normalizeCoord(x: Double, y: Double): LatLng {
        if (abs(x) > 180.0 || abs(y) > 90.0) {
            return webMercatorToLatLng(x, y)
        }
        // Standard GIS order is [lng, lat] -> latitude is y, longitude is x
        return LatLng(latitude = y, longitude = x)
    }

    private fun coordDistance(c1: LatLng, c2: LatLng): Double {
        val dx = c1.latitude - c2.latitude
        val dy = c1.longitude - c2.longitude
        return sqrt(dx * dx + dy * dy)
    }

    /**
     * Computes the midpoint along a polyline's path length (matching js/app.js & iOS CoordinateUtils).
     */
    fun getPolylineMidpoint(points: List<LatLng>): LatLng {
        if (points.isEmpty()) {
            return LatLng(latitude = 51.0447, longitude = -114.0719) // Calgary Center
        }
        if (points.size == 1) {
            return points[0]
        }

        var totalDist = 0.0
        val segDists = DoubleArray(points.size - 1)
        for (i in 0 until points.size - 1) {
            val d = coordDistance(points[i], points[i + 1])
            segDists[i] = d
            totalDist += d
        }

        if (totalDist == 0.0) {
            return points[0]
        }

        val halfDist = totalDist / 2.0
        var accum = 0.0

        for (i in segDists.indices) {
            if (accum + segDists[i] >= halfDist) {
                val remain = halfDist - accum
                val frac = if (segDists[i] > 0.0) (remain / segDists[i]) else 0.0
                val lat = points[i].latitude + frac * (points[i + 1].latitude - points[i].latitude)
                val lng = points[i].longitude + frac * (points[i + 1].longitude - points[i].longitude)
                return LatLng(latitude = lat, longitude = lng)
            }
            accum += segDists[i]
        }

        return points[points.size / 2]
    }

    /**
     * Computes the arithmetic centroid of a polygon ring (matching js/app.js & iOS CoordinateUtils).
     */
    fun getPolygonCentroid(points: List<LatLng>): LatLng {
        if (points.isEmpty()) {
            return LatLng(latitude = 51.0447, longitude = -114.0719)
        }
        var sumLat = 0.0
        var sumLng = 0.0
        for (pt in points) {
            sumLat += pt.latitude
            sumLng += pt.longitude
        }
        return LatLng(
            latitude = sumLat / points.size.toDouble(),
            longitude = sumLng / points.size.toDouble()
        )
    }

    /**
     * Computes walking distance in meters using Haversine formula (pure Kotlin, works in JVM & Android).
     */
    fun distanceInMeters(from: LatLng, to: LatLng): Double {
        val earthRadiusMeters = 6371000.0
        val dLat = Math.toRadians(to.latitude - from.latitude)
        val dLng = Math.toRadians(to.longitude - from.longitude)
        val lat1 = Math.toRadians(from.latitude)
        val lat2 = Math.toRadians(to.latitude)

        val a = sin(dLat / 2.0).pow(2.0) +
                cos(lat1) * cos(lat2) * sin(dLng / 2.0).pow(2.0)
        val c = 2.0 * asin(sqrt(a.coerceIn(0.0, 1.0)))
        return earthRadiusMeters * c
    }

    /**
     * Computes walking time in minutes based on average 80 meters/min (~4.8 km/h) walking speed.
     */
    fun walkingMinutes(distanceInMeters: Double): Int {
        return max(1, (distanceInMeters / 80.0).roundToInt())
    }
}
