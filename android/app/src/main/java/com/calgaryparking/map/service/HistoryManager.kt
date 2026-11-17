package com.calgaryparking.map.service

import android.content.Context
import android.content.SharedPreferences
import com.calgaryparking.map.model.HistoricalDataPoint
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt

data class PriceSnapshotRecord(
    val timestampMillis: Long,
    val dateLabel: String,
    val peakRate: Double
)

data class HistoricalTrendResult(
    val points: List<HistoricalDataPoint>,
    val percentChange: Double
)

object HistoryManager {
    private const val PREFS_NAME = "calgary_parking_prefs"
    private const val SNAPSHOTS_KEY = "cpa_price_snapshots"
    private const val MAX_SNAPSHOTS = 30
    private const val THROTTLE_MILLIS = 15L * 60L * 1000L // 15 minutes

    private val gson = Gson()
    private val inMemorySnapshots = mutableListOf<PriceSnapshotRecord>()
    private var prefs: SharedPreferences? = null

    val baselineCheckpoints: List<Pair<String, Double>> = listOf(
        "2023 Q1" to 0.82,
        "2023 Q3" to 0.85,
        "2024 Q1" to 0.88,
        "2024 Q3" to 0.92,
        "2025 Q1" to 0.95,
        "2025 Q3" to 0.98,
        "2026 Q1" to 1.00
    )

    fun init(context: Context) {
        prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    fun loadSnapshots(): List<PriceSnapshotRecord> {
        val sp = prefs
        if (sp != null) {
            val json = sp.getString(SNAPSHOTS_KEY, null) ?: return emptyList()
            return try {
                val type = object : TypeToken<List<PriceSnapshotRecord>>() {}.type
                gson.fromJson<List<PriceSnapshotRecord>>(json, type) ?: emptyList()
            } catch (_: Exception) {
                emptyList()
            }
        }
        return inMemorySnapshots.toList()
    }

    fun saveSnapshots(list: List<PriceSnapshotRecord>) {
        val trimmed = list.takeLast(MAX_SNAPSHOTS)
        val sp = prefs
        if (sp != null) {
            sp.edit().putString(SNAPSHOTS_KEY, gson.toJson(trimmed)).apply()
        } else {
            inMemorySnapshots.clear()
            inMemorySnapshots.addAll(trimmed)
        }
    }

    fun recordPriceSnapshot(peakRate: Double) {
        val existing = loadSnapshots().toMutableList()
        val now = System.currentTimeMillis()
        val last = existing.lastOrNull()
        if (last != null && (now - last.timestampMillis) < THROTTLE_MILLIS) {
            return
        }
        val formatter = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US)
        val label = formatter.format(Date(now))
        existing.add(PriceSnapshotRecord(now, label, peakRate))
        saveSnapshots(existing)
    }

    fun takeSnapshotNow(peakRate: Double) {
        val existing = loadSnapshots().toMutableList()
        val now = System.currentTimeMillis()
        val formatter = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US)
        val label = formatter.format(Date(now))
        existing.add(PriceSnapshotRecord(now, label, peakRate))
        saveSnapshots(existing)
    }

    fun clearLocalHistory() {
        val sp = prefs
        if (sp != null) {
            sp.edit().remove(SNAPSHOTS_KEY).apply()
        } else {
            inMemorySnapshots.clear()
        }
    }

    fun getZoneHistoricalData(peakRate: Double): HistoricalTrendResult {
        val points = mutableListOf<HistoricalDataPoint>()
        for ((period, scale) in baselineCheckpoints) {
            val scaled = ((peakRate * scale * 4.0).roundToInt()) / 4.0
            points.add(HistoricalDataPoint(period = period, rate = scaled, isLocalSnapshot = false))
        }

        for (snap in loadSnapshots()) {
            points.add(
                HistoricalDataPoint(
                    period = snap.dateLabel,
                    rate = snap.peakRate,
                    isLocalSnapshot = true,
                    timestampMillis = snap.timestampMillis
                )
            )
        }

        val firstRate = points.firstOrNull()?.rate ?: 0.0
        val lastRate = points.lastOrNull()?.rate ?: peakRate
        val percentChange = if (firstRate > 0.0) {
            ((lastRate - firstRate) / firstRate) * 100.0
        } else {
            0.0
        }

        return HistoricalTrendResult(points = points, percentChange = percentChange)
    }
}
