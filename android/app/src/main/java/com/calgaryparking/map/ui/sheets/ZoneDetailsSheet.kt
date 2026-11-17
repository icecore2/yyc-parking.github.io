package com.calgaryparking.map.ui.sheets

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsWalk
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CenterFocusStrong
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Navigation
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.calgaryparking.map.model.DayScheduleType
import com.calgaryparking.map.model.HistoricalDataPoint
import com.calgaryparking.map.model.HourlyRatePoint
import com.calgaryparking.map.model.ParkingZone
import com.calgaryparking.map.model.ProviderRegistry
import com.calgaryparking.map.service.HistoryManager
import com.calgaryparking.map.service.RateParser
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ZoneDetailsSheetView(
    zone: ParkingZone,
    onDismiss: () -> Unit,
    onZoom: () -> Unit
) {
    val context = LocalContext.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)
    var selectedTab by remember { mutableIntStateOf(0) }
    var scheduleDay by remember { mutableStateOf(DayScheduleType.WEEKDAY) }
    var historicalData by remember(zone.id) {
        mutableStateOf(HistoryManager.getZoneHistoricalData(zone.rateInfo.maxRate))
    }

    val tabs = listOf("Overview", "Rates", "History", "Rules")

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = 600.dp)
                .align(Alignment.CenterHorizontally)
                .navigationBarsPadding()
                .padding(bottom = 12.dp)
        ) {
            // Sheet Title Header
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp)
            ) {
                Text(
                    text = zone.name,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                IconButton(onClick = onDismiss) {
                    Icon(imageVector = Icons.Default.Close, contentDescription = "Close")
                }
            }

            // Segmented 4-Tab Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .padding(3.dp)
            ) {
                tabs.forEachIndexed { index, title ->
                    val isSelected = selectedTab == index
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(
                                if (isSelected) MaterialTheme.colorScheme.surface else Color.Transparent
                            )
                            .clickable { selectedTab = index }
                            .padding(vertical = 7.dp)
                    ) {
                        Text(
                            text = title,
                            fontSize = 12.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            // Scrollable Tab Content
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f, fill = false)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                when (selectedTab) {
                    0 -> OverviewTabContent(zone)
                    1 -> RatesTabContent(
                        zone = zone,
                        scheduleDay = scheduleDay,
                        onSelectDay = { scheduleDay = it }
                    )
                    2 -> HistoryTabContent(
                        zone = zone,
                        points = historicalData.points,
                        percentChange = historicalData.percentChange,
                        onSaveSnapshot = {
                            HistoryManager.takeSnapshotNow(zone.rateInfo.maxRate)
                            historicalData = HistoryManager.getZoneHistoricalData(zone.rateInfo.maxRate)
                        },
                        onClearHistory = {
                            HistoryManager.clearLocalHistory()
                            historicalData = HistoryManager.getZoneHistoricalData(zone.rateInfo.maxRate)
                        }
                    )
                    3 -> RulesTabContent(zone)
                }
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            // Footer Actions (Pay, Zoom, Navigate)
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
            ) {
                val payUrl = zone.paymentUrl ?: ProviderRegistry.provider(zone.providerId).paymentUrl
                Button(
                    onClick = {
                        runCatching {
                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(payUrl)))
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB)),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        imageVector = Icons.Default.CreditCard,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = zone.paymentApp ?: "Pay",
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                OutlinedButton(
                    onClick = {
                        onZoom()
                        onDismiss()
                    },
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.CenterFocusStrong,
                        contentDescription = "Zoom to Facility",
                        modifier = Modifier.size(18.dp)
                    )
                }

                Button(
                    onClick = {
                        val lat = zone.midpoint.latitude
                        val lng = zone.midpoint.longitude
                        val gmapsIntent = Intent(
                            Intent.ACTION_VIEW,
                            Uri.parse("google.navigation:q=$lat,$lng")
                        ).apply {
                            setPackage("com.google.android.apps.maps")
                        }
                        try {
                            context.startActivity(gmapsIntent)
                        } catch (_: Exception) {
                            val webUri = Uri.parse("https://www.google.com/maps/search/?api=1&query=$lat,$lng")
                            runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, webUri)) }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        imageVector = Icons.Default.Navigation,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(text = "Navigate", fontSize = 12.sp)
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun OverviewTabContent(zone: ParkingZone) {
    val provider = ProviderRegistry.provider(zone.providerId)
    val brandColor = Color(ProviderRegistry.parseColorInt(provider.colorHex))

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(brandColor.copy(alpha = 0.18f))
                .padding(horizontal = 8.dp, vertical = 4.dp)
        ) {
            Text(
                text = provider.name,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = brandColor
            )
        }

        if (zone.priceZone.isNotEmpty()) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .padding(horizontal = 6.dp, vertical = 4.dp)
            ) {
                Text(
                    text = zone.priceZone,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }

    Text(
        text = zone.address,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.SemiBold
    )

    if (zone.blockSide.isNotEmpty()) {
        Text(
            text = "Block Side: ${fullBlockSide(zone.blockSide)}",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }

    // Live Rate Hero Card
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp)
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Text(
                    text = "CURRENT STATUS",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                val currentRate = zone.rateInfo.currentRate
                if (currentRate != null) {
                    Text(
                        text = if (currentRate == 0.0) "FREE PARKING" else String.format(Locale.US, "$%.2f / hr", currentRate),
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (currentRate == 0.0) Color(0xFF10B981) else Color(0xFF2563EB)
                    )
                } else if (zone.rateInfo.isNoParkingNow) {
                    Text(
                        text = "NO PARKING (RESTRICTED)",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFFDC2626)
                    )
                }
                Text(
                    text = zone.rateInfo.currentSlotLabel,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Column(
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Text(
                    text = "PEAK DAYTIME",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = String.format(Locale.US, "$%.2f/hr", zone.rateInfo.maxRate),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold
                )
                val mins = zone.walkingMinutes
                if (mins != null) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.DirectionsWalk,
                            contentDescription = null,
                            tint = Color(0xFF2563EB),
                            modifier = Modifier.size(13.dp)
                        )
                        Text(
                            text = "~$mins min walk",
                            fontSize = 11.sp,
                            color = Color(0xFF2563EB),
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }
        }
    }

    // 2x2 Metrics Grid
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MetricCard(
                title = "STALL CAPACITY",
                value = "${if (zone.zoneCapacity > 0) zone.zoneCapacity else zone.segCapacity} Stalls",
                modifier = Modifier.weight(1f)
            )
            MetricCard(
                title = "STALL TYPE",
                value = zone.stallType.ifEmpty { "Standard" },
                modifier = Modifier.weight(1f)
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MetricCard(
                title = "AREA / BRZ",
                value = zone.brzName,
                modifier = Modifier.weight(1f)
            )
            MetricCard(
                title = "CATEGORY",
                value = zone.facilityType ?: "On-Street",
                modifier = Modifier.weight(1f)
            )
        }
    }

    if (!zone.heightLimit.isNullOrEmpty()) {
        MetricCard(
            title = "HEIGHT CLEARANCE",
            value = zone.heightLimit,
            modifier = Modifier.fillMaxWidth()
        )
    }

    if (zone.amenities.isNotEmpty()) {
        Surface(
            shape = RoundedCornerShape(10.dp),
            color = MaterialTheme.colorScheme.surfaceVariant
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    text = "AMENITIES",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    zone.amenities.forEach { amenity ->
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(MaterialTheme.colorScheme.surface)
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(text = amenity, fontSize = 11.sp)
                        }
                    }
                }
            }
        }
    }

    if (zone.enforceableTime.isNotEmpty()) {
        Surface(
            shape = RoundedCornerShape(10.dp),
            color = MaterialTheme.colorScheme.surfaceVariant
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = "ENFORCEABLE HOURS",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = RateParser.formatEnforceableTime(zone.enforceableTime),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }

    if (zone.permitZone.isNotEmpty()) {
        Surface(
            shape = RoundedCornerShape(8.dp),
            color = Color(0xFFF59E0B).copy(alpha = 0.14f)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(10.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Shield,
                    contentDescription = null,
                    tint = Color(0xFFF59E0B),
                    modifier = Modifier.size(18.dp)
                )
                Text(
                    text = "Residential Permit Zone: ${zone.permitZone}",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

@Composable
private fun RatesTabContent(
    zone: ParkingZone,
    scheduleDay: DayScheduleType,
    onSelectDay: (DayScheduleType) -> Unit
) {
    val profile = remember(zone.id, scheduleDay) {
        RateParser.generate24HourProfile(zone.rateInfo, scheduleDay)
    }

    // Day selector segmented bar
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(2.dp)
    ) {
        DayScheduleType.entries.forEach { d ->
            val isSelected = scheduleDay == d
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(6.dp))
                    .background(if (isSelected) MaterialTheme.colorScheme.surface else Color.Transparent)
                    .clickable { onSelectDay(d) }
                    .padding(vertical = 6.dp)
            ) {
                Text(
                    text = d.title,
                    fontSize = 11.sp,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                )
            }
        }
    }

    // 24-Hour Stepped Rate Curve Card
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = "24-Hour Rate Curve (12 AM – 11 PM)",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f)
                )
                Text(
                    text = String.format(Locale.US, "Peak $%.2f/hr", zone.rateInfo.maxRate),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF2563EB)
                )
            }

            HourlySteppedChart(
                profile = profile,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(170.dp)
            )

            Row(
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                listOf("12A", "6A", "12P", "6P", "11P").forEach { label ->
                    Text(
                        text = label,
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }

    // Schedule Intervals Timetable
    Text(
        text = "Schedule Intervals",
        fontSize = 12.sp,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )

    zone.rateInfo.intervals.forEach { inv ->
        Surface(
            shape = RoundedCornerShape(8.dp),
            color = MaterialTheme.colorScheme.surfaceVariant
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(10.dp)
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = inv.header,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = inv.rateText,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                if (inv.isNoParking) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color(0xFFDC2626).copy(alpha = 0.15f))
                            .padding(horizontal = 6.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = "RESTRICTED",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFFDC2626)
                        )
                    }
                } else {
                    Text(
                        text = if (inv.price == 0.0) "FREE" else String.format(Locale.US, "$%.2f/hr", inv.price),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (inv.price == 0.0) Color(0xFF10B981) else Color(0xFF2563EB)
                    )
                }
            }
        }
    }
}

@Composable
private fun HourlySteppedChart(
    profile: List<HourlyRatePoint>,
    modifier: Modifier = Modifier
) {
    val maxPrice = (profile.mapNotNull { it.rate }.maxOrNull() ?: 5.0).coerceAtLeast(1.0)
    val gridColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.1f)

    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val padTop = 12f
        val padBottom = 12f
        val chartH = (h - padTop - padBottom).coerceAtLeast(1f)

        // Horizontal grid lines
        for (i in 0..4) {
            val y = padTop + chartH * (i / 4f)
            drawLine(
                color = gridColor,
                start = Offset(0f, y),
                end = Offset(w, y),
                strokeWidth = 1f
            )
        }

        if (profile.isEmpty()) return@Canvas
        val stepX = w / (profile.size - 1).coerceAtLeast(1)

        val linePath = Path()
        val areaPath = Path()
        var started = false
        var lastX = 0f
        var firstX = 0f

        profile.forEachIndexed { idx, pt ->
            val x = idx * stepX
            val rate = pt.rate
            if (rate != null) {
                val y = padTop + chartH * (1f - (rate / maxPrice).toFloat().coerceIn(0f, 1f))
                if (!started) {
                    linePath.moveTo(x, y)
                    areaPath.moveTo(x, padTop + chartH)
                    areaPath.lineTo(x, y)
                    firstX = x
                    started = true
                } else {
                    // Stepped transition
                    linePath.lineTo(x, y)
                    areaPath.lineTo(x, y)
                }
                lastX = x
            } else if (pt.isRestricted) {
                drawCircle(
                    color = Color(0xFFDC2626),
                    radius = 5.dp.toPx(),
                    center = Offset(x, padTop + chartH)
                )
            }
        }

        if (started) {
            areaPath.lineTo(lastX, padTop + chartH)
            areaPath.lineTo(firstX, padTop + chartH)
            areaPath.close()

            drawPath(
                path = areaPath,
                color = Color(0xFF2563EB).copy(alpha = 0.18f)
            )
            drawPath(
                path = linePath,
                color = Color(0xFF2563EB),
                style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round)
            )
        }
    }
}

@Composable
private fun HistoryTabContent(
    zone: ParkingZone,
    points: List<HistoricalDataPoint>,
    percentChange: Double,
    onSaveSnapshot: () -> Unit,
    onClearHistory: () -> Unit
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "HISTORICAL PRICE TREND",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = "Longitudinal rate changes (2023 – Present)",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        val isPositive = percentChange >= 0.0
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(
                    if (isPositive) Color(0xFF10B981).copy(alpha = 0.18f)
                    else Color(0xFFDC2626).copy(alpha = 0.18f)
                )
                .padding(horizontal = 8.dp, vertical = 4.dp)
        ) {
            Text(
                text = String.format(Locale.US, "%+.1f%%", percentChange),
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = if (isPositive) Color(0xFF10B981) else Color(0xFFDC2626)
            )
        }
    }

    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            HistoricalLineChart(
                points = points,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(170.dp)
            )

            if (points.isNotEmpty()) {
                Row(
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = points.first().period,
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = String.format(Locale.US, "Current Peak: $%.2f/hr", zone.rateInfo.maxRate),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF7C3AED)
                    )
                    Text(
                        text = points.last().period,
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }

    Row(
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        OutlinedButton(
            onClick = onSaveSnapshot,
            shape = RoundedCornerShape(8.dp),
            modifier = Modifier.weight(1f)
        ) {
            Icon(
                imageVector = Icons.Default.CameraAlt,
                contentDescription = null,
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(text = "Save Snapshot Now", fontSize = 12.sp)
        }

        OutlinedButton(
            onClick = onClearHistory,
            shape = RoundedCornerShape(8.dp),
            modifier = Modifier.weight(1f)
        ) {
            Icon(
                imageVector = Icons.Default.Delete,
                contentDescription = null,
                tint = Color(0xFFDC2626),
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = "Clear History",
                fontSize = 12.sp,
                color = Color(0xFFDC2626)
            )
        }
    }
}

@Composable
private fun HistoricalLineChart(
    points: List<HistoricalDataPoint>,
    modifier: Modifier = Modifier
) {
    val maxRate = (points.maxOfOrNull { it.rate } ?: 5.0).coerceAtLeast(1.0)
    val gridColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.1f)

    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val pad = 14f
        val chartW = (w - pad * 2).coerceAtLeast(1f)
        val chartH = (h - pad * 2).coerceAtLeast(1f)

        for (i in 0..3) {
            val y = pad + chartH * (i / 3f)
            drawLine(
                color = gridColor,
                start = Offset(pad, y),
                end = Offset(w - pad, y),
                strokeWidth = 1f
            )
        }

        if (points.isEmpty()) return@Canvas
        val stepX = if (points.size > 1) chartW / (points.size - 1) else 0f
        val path = Path()

        points.forEachIndexed { idx, pt ->
            val x = pad + idx * stepX
            val y = pad + chartH * (1f - (pt.rate / maxRate).toFloat().coerceIn(0f, 1f))
            if (idx == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }

        drawPath(
            path = path,
            color = Color(0xFF7C3AED),
            style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round)
        )

        points.forEachIndexed { idx, pt ->
            val x = pad + idx * stepX
            val y = pad + chartH * (1f - (pt.rate / maxRate).toFloat().coerceIn(0f, 1f))
            drawCircle(
                color = if (pt.isLocalSnapshot) Color(0xFFF59E0B) else Color(0xFF7C3AED),
                radius = 4.5.dp.toPx(),
                center = Offset(x, y)
            )
        }
    }
}

@Composable
private fun RulesTabContent(zone: ParkingZone) {
    if (!zone.restrictType.equals("none", ignoreCase = true) ||
        !zone.restrictTime.equals("none", ignoreCase = true)
    ) {
        Surface(
            shape = RoundedCornerShape(10.dp),
            color = Color(0xFFF59E0B).copy(alpha = 0.14f)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = null,
                        tint = Color(0xFFF59E0B),
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = "PARKING RESTRICTION",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                Text(
                    text = "${zone.restrictType} (${zone.restrictTime})",
                    fontSize = 13.sp
                )
            }
        }
    }

    if (zone.noStopping.isNotEmpty() || zone.noParking.isNotEmpty()) {
        Surface(
            shape = RoundedCornerShape(10.dp),
            color = Color(0xFFDC2626).copy(alpha = 0.14f)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Block,
                        contentDescription = null,
                        tint = Color(0xFFDC2626),
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = "PROHIBITION ALERT",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFFDC2626)
                    )
                }
                if (zone.noStopping.isNotEmpty()) {
                    Text(text = "No Stopping: ${zone.noStopping}", fontSize = 13.sp)
                }
                if (zone.noParking.isNotEmpty()) {
                    Text(text = "No Parking: ${zone.noParking}", fontSize = 13.sp)
                }
            }
        }
    }

    Surface(
        shape = RoundedCornerShape(10.dp),
        color = MaterialTheme.colorScheme.surfaceVariant
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = "TECHNICAL IDENTIFIERS",
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(text = "Status: ${zone.status}", fontSize = 12.sp)
            if (zone.segLength > 0) {
                Text(text = "Segment Length: ${zone.segLength} meters", fontSize = 12.sp)
            }
            if (zone.segCapacity > 0) {
                Text(text = "Segment Capacity: ${zone.segCapacity} stalls", fontSize = 12.sp)
            }
            Text(
                text = String.format(
                    Locale.US,
                    "Coordinates: %.5f, %.5f",
                    zone.midpoint.latitude,
                    zone.midpoint.longitude
                ),
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun MetricCard(
    title: String,
    value: String,
    modifier: Modifier = Modifier
) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(3.dp)
        ) {
            Text(
                text = title,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = value,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

private fun fullBlockSide(side: String): String {
    return when (side.uppercase(Locale.US)) {
        "N" -> "North"
        "S" -> "South"
        "E" -> "East"
        "W" -> "West"
        else -> side
    }
}
