package com.calgaryparking.map.service

import android.annotation.SuppressLint
import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.location.LocationManager
import androidx.core.content.ContextCompat
import com.calgaryparking.map.model.CustomLocation
import com.calgaryparking.map.model.LatLng
import com.google.gson.Gson
import com.google.gson.JsonParser
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.UUID

object LocationService {
    private const val PREFS_NAME = "calgary_parking_prefs"
    private const val LOCATIONS_KEY = "cpa_custom_locations"
    private const val API_URL_KEY = "cpa_api_url"

    private val gson = Gson()
    private val rawCoordRegex = Regex("""^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$""")

    private var prefs: SharedPreferences? = null
    private val inMemoryLocations = mutableListOf<CustomLocation>()

    private val defaultSeeds = listOf(
        CustomLocation(
            id = "loc_downtown",
            name = "Downtown Office",
            latitude = 51.0458,
            longitude = -114.0715
        ),
        CustomLocation(
            id = "loc_stephen_ave",
            name = "Stephen Avenue Walk",
            latitude = 51.0449,
            longitude = -114.0628
        )
    )

    fun init(context: Context) {
        prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    fun getSavedApiUrl(): String {
        return prefs?.getString(API_URL_KEY, null)?.takeIf { it.isNotBlank() }
            ?: ParkingDataService.DEFAULT_ARCGIS_URL
    }

    fun setSavedApiUrl(url: String) {
        prefs?.edit()?.putString(API_URL_KEY, url.trim())?.apply()
    }

    fun hasLocationPermission(context: Context): Boolean {
        val fine = ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    @SuppressLint("MissingPermission")
    suspend fun requestCurrentLocation(context: Context): LatLng = withContext(Dispatchers.Main) {
        if (!hasLocationPermission(context)) {
            throw IllegalStateException("Location permission denied")
        }
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            ?: throw IllegalStateException("Location service unavailable")

        val providers = listOf(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER,
            LocationManager.PASSIVE_PROVIDER
        )

        for (provider in providers) {
            try {
                if (locationManager.isProviderEnabled(provider)) {
                    val lastKnown = locationManager.getLastKnownLocation(provider)
                    if (lastKnown != null) {
                        return@withContext LatLng(lastKnown.latitude, lastKnown.longitude)
                    }
                }
            } catch (_: Exception) {
                // Continue to next provider
            }
        }

        // Default to Downtown Calgary if emulator/device has no cached GPS fix yet
        LatLng(51.0447, -114.0719)
    }

    suspend fun geocodeAddress(input: String): LatLng = withContext(Dispatchers.IO) {
        val trimmed = input.trim()
        if (trimmed.isEmpty()) {
            throw IllegalArgumentException("Please enter an address or coordinate")
        }

        // 1. Check raw coordinate format: "51.045, -114.07"
        rawCoordRegex.find(trimmed)?.let { match ->
            val lat = match.groupValues[1].toDoubleOrNull()
            val lng = match.groupValues[2].toDoubleOrNull()
            if (lat != null && lng != null) {
                return@withContext LatLng(lat, lng)
            }
        }

        // 2. Query OpenStreetMap Nominatim bounded to Calgary
        val encoded = URLEncoder.encode("$trimmed, Calgary, Alberta", "UTF-8")
        val urlStr = "https://nominatim.openstreetmap.org/search?format=json&q=$encoded&limit=1&viewbox=-114.35,51.25,-113.85,50.85&bounded=1"
        val connection = (URL(urlStr).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 10_000
            readTimeout = 10_000
            setRequestProperty("User-Agent", "CalgaryParkingMap-Android/1.0")
        }

        try {
            val code = connection.responseCode
            if (code !in 200..299) {
                throw IllegalStateException("Geocoding service returned HTTP $code")
            }
            val body = connection.inputStream.bufferedReader().use { it.readText() }
            val jsonArray = JsonParser.parseString(body).asJsonArray
            if (jsonArray.isEmpty) {
                throw IllegalStateException("Could not find address in Calgary")
            }
            val first = jsonArray[0].asJsonObject
            val lat = first.get("lat")?.asString?.toDoubleOrNull()
            val lon = first.get("lon")?.asString?.toDoubleOrNull()
            if (lat == null || lon == null) {
                throw IllegalStateException("Invalid coordinates returned for address")
            }
            LatLng(lat, lon)
        } finally {
            connection.disconnect()
        }
    }

    fun loadSavedLocations(): List<CustomLocation> {
        val sp = prefs
        if (sp != null) {
            val json = sp.getString(LOCATIONS_KEY, null)
            if (json != null) {
                try {
                    val type = object : TypeToken<List<CustomLocation>>() {}.type
                    val list = gson.fromJson<List<CustomLocation>>(json, type)
                    if (list != null) return list
                } catch (_: Exception) {
                    // Fallback to seeds
                }
            }
            saveLocations(defaultSeeds)
            return defaultSeeds
        }

        if (inMemoryLocations.isEmpty()) {
            inMemoryLocations.addAll(defaultSeeds)
        }
        return inMemoryLocations.toList()
    }

    fun saveLocations(locations: List<CustomLocation>) {
        val sp = prefs
        if (sp != null) {
            sp.edit().putString(LOCATIONS_KEY, gson.toJson(locations)).apply()
        } else {
            inMemoryLocations.clear()
            inMemoryLocations.addAll(locations)
        }
    }

    fun addLocation(name: String, coordinate: LatLng): CustomLocation {
        val list = loadSavedLocations().toMutableList()
        val newLoc = CustomLocation(
            id = UUID.randomUUID().toString(),
            name = name.ifBlank { "Selected Point" },
            latitude = coordinate.latitude,
            longitude = coordinate.longitude
        )
        list.add(newLoc)
        saveLocations(list)
        return newLoc
    }

    fun deleteLocation(id: String) {
        val list = loadSavedLocations().toMutableList()
        list.removeAll { it.id == id }
        saveLocations(list)
    }
}
