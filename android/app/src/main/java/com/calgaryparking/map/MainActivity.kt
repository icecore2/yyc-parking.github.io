package com.calgaryparking.map

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.calgaryparking.map.service.HistoryManager
import com.calgaryparking.map.service.LocationService
import com.calgaryparking.map.ui.components.BestValuePanelView
import com.calgaryparking.map.ui.components.BestValueTogglePill
import com.calgaryparking.map.ui.components.MapLayerControlsView
import com.calgaryparking.map.ui.components.MapPickerBannerView
import com.calgaryparking.map.ui.components.ProviderFilterPillsBarView
import com.calgaryparking.map.ui.components.ProviderLegendView
import com.calgaryparking.map.ui.components.SecondaryFilterBarView
import com.calgaryparking.map.ui.components.StatusPillView
import com.calgaryparking.map.ui.components.TopHeaderBarView
import com.calgaryparking.map.ui.map.ParkingMapView
import com.calgaryparking.map.ui.sheets.LocationsManagerSheetView
import com.calgaryparking.map.ui.sheets.SettingsSheetView
import com.calgaryparking.map.ui.sheets.ZoneDetailsSheetView
import com.calgaryparking.map.viewmodel.ParkingViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        HistoryManager.init(this)
        LocationService.init(this)
        enableEdgeToEdge()

        setContent {
            val parkingViewModel: ParkingViewModel = viewModel()
            MaterialTheme(
                colorScheme = if (parkingViewModel.isDarkTheme) darkColorScheme() else lightColorScheme()
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    MainScreen(viewModel = parkingViewModel)
                }
            }
        }
    }
}

@Composable
fun MainScreen(viewModel: ParkingViewModel) {
    val context = LocalContext.current
    var isFilterBarExpanded by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        viewModel.loadData(context)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .safeDrawingPadding()
    ) {
        // 1. Top Header Bar
        TopHeaderBarView(
            viewModel = viewModel,
            isFilterBarExpanded = isFilterBarExpanded,
            onToggleFilterBar = { isFilterBarExpanded = !isFilterBarExpanded }
        )

        // 2. Collapsible Secondary Filter Bar
        AnimatedVisibility(visible = isFilterBarExpanded) {
            SecondaryFilterBarView(viewModel = viewModel)
        }

        // 3. Provider Filter Pills Bar
        ProviderFilterPillsBarView(viewModel = viewModel)

        // 4. Interactive Map with Non-Obtrusive Anchored Overlays
        Box(modifier = Modifier.fillMaxSize()) {
            ParkingMapView(
                viewModel = viewModel,
                modifier = Modifier.fillMaxSize()
            )

            // Top Floating Controls Row (Status Pill + Best Value Toggle Chip)
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .fillMaxWidth()
                    .padding(horizontal = 10.dp, vertical = 8.dp)
            ) {
                StatusPillView(
                    message = viewModel.statusMessage,
                    count = viewModel.filteredZones.size
                )

                if (viewModel.targetLocation != null && viewModel.bestValueZones.isNotEmpty()) {
                    BestValueTogglePill(
                        isExpanded = viewModel.showBestValuePanel,
                        count = viewModel.bestValueZones.size,
                        onClick = { viewModel.showBestValuePanel = !viewModel.showBestValuePanel }
                    )
                }
            }

            // Map Picker Banner (Centered at Top)
            if (viewModel.isPickingLocationOnMap) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = 8.dp, start = 16.dp, end = 16.dp)
                        .widthIn(max = 440.dp)
                ) {
                    MapPickerBannerView(
                        onCancel = { viewModel.isPickingLocationOnMap = false }
                    )
                }
            }

            // Docked Best Value Carousel (Bottom Center, positioned above bottom controls)
            if (viewModel.targetLocation != null && viewModel.bestValueZones.isNotEmpty() && viewModel.showBestValuePanel) {
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 60.dp, start = 10.dp, end = 10.dp)
                        .widthIn(max = 480.dp)
                ) {
                    BestValuePanelView(
                        viewModel = viewModel,
                        onClose = { viewModel.showBestValuePanel = false }
                    )
                }
            }

            // Bottom-Left Layer Controls
            Box(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(start = 10.dp, bottom = 10.dp)
            ) {
                MapLayerControlsView(viewModel = viewModel)
            }

            // Bottom-Right Provider Legend
            Box(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 10.dp, bottom = 10.dp)
            ) {
                ProviderLegendView()
            }
        }
    }

    // Modal Bottom Sheets
    if (viewModel.showZoneDetailsSheet) {
        val selected = viewModel.selectedZone
        if (selected != null) {
            ZoneDetailsSheetView(
                zone = selected,
                onDismiss = { viewModel.showZoneDetailsSheet = false },
                onZoom = { viewModel.mapFocusCoordinate = selected.midpoint }
            )
        }
    }

    if (viewModel.showLocationsSheet) {
        LocationsManagerSheetView(
            viewModel = viewModel,
            onDismiss = { viewModel.showLocationsSheet = false }
        )
    }

    if (viewModel.showSettingsSheet) {
        SettingsSheetView(
            viewModel = viewModel,
            onDismiss = { viewModel.showSettingsSheet = false }
        )
    }
}
