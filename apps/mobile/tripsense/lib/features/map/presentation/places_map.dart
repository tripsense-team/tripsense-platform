import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import '../../../core/config/app_config.dart';
import '../../places/domain/place.dart';

/// One pin on the map.
class MapMarker {
  const MapMarker({required this.id, required this.point});

  final String id;
  final GeoPoint point;
}

/// Everything a map implementation needs; kept free of MapLibre types so the
/// widget can be swapped for a fake in tests.
class PlacesMapData {
  const PlacesMapData({
    required this.markers,
    required this.center,
    this.selectedId,
    this.onSelect,
    this.interactive = true,
    this.zoom = 12,
  });

  final List<MapMarker> markers;
  final GeoPoint center;
  final String? selectedId;
  final ValueChanged<String>? onSelect;
  final bool interactive;
  final double zoom;
}

typedef PlacesMapBuilder =
    Widget Function(BuildContext context, PlacesMapData data);

/// Overridable in widget tests (platform views do not run under `flutter test`).
final placesMapBuilderProvider = Provider<PlacesMapBuilder>(
  (ref) =>
      (context, data) => MapLibrePlacesMap(
        key: const Key('maplibre-map'),
        data: data,
        styleString: _styleFor(ref.read(appConfigProvider)),
      ),
);

/// Open raster fallback used on the web when the vector style is unavailable.
const _fallbackStyle = {
  'version': 8,
  'sources': {
    'map-tiles': {
      'type': 'raster',
      'tiles': [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
      ],
      'tileSize': 256,
      'attribution': '© OpenStreetMap © CARTO',
    },
  },
  'layers': [
    {
      'id': 'map-tiles-layer',
      'type': 'raster',
      'source': 'map-tiles',
      'minzoom': 0,
      'maxzoom': 20,
    },
  ],
};

String _styleFor(AppConfig config) =>
    config.mapStyleUrl ?? jsonEncode(_fallbackStyle);

const _markerColor = '#0a0a0a';
const _selectedColor = '#f97316';

class MapLibrePlacesMap extends StatefulWidget {
  const MapLibrePlacesMap({
    super.key,
    required this.data,
    required this.styleString,
  });

  final PlacesMapData data;
  final String styleString;

  @override
  State<MapLibrePlacesMap> createState() => _MapLibrePlacesMapState();
}

class _MapLibrePlacesMapState extends State<MapLibrePlacesMap> {
  MapLibreMapController? _controller;
  bool _styleLoaded = false;
  bool _syncing = false;
  bool _dirty = false;
  bool _needsFit = true;

  @override
  void didUpdateWidget(MapLibrePlacesMap old) {
    super.didUpdateWidget(old);
    final markersChanged =
        old.data.markers.length != widget.data.markers.length ||
        !_sameIds(old.data.markers, widget.data.markers);
    if (markersChanged) _needsFit = true;
    if (markersChanged || old.data.selectedId != widget.data.selectedId) {
      _sync();
    }
  }

  bool _sameIds(List<MapMarker> a, List<MapMarker> b) {
    for (var i = 0; i < a.length; i++) {
      if (a[i].id != b[i].id) return false;
    }
    return true;
  }

  void _onCreated(MapLibreMapController controller) {
    _controller = controller;
    controller.onCircleTapped.add((circle) {
      final id = circle.data?['id'];
      if (id is String) widget.data.onSelect?.call(id);
    });
  }

  void _onStyleLoaded() {
    _styleLoaded = true;
    _sync();
  }

  /// Redraws the pins; coalesces rapid updates into one trailing pass.
  Future<void> _sync() async {
    final controller = _controller;
    if (controller == null || !_styleLoaded) return;
    if (_syncing) {
      _dirty = true;
      return;
    }
    _syncing = true;
    try {
      do {
        _dirty = false;
        final data = widget.data;
        await controller.clearCircles();
        if (data.markers.isNotEmpty) {
          await controller.addCircles(
            [
              for (final m in data.markers)
                CircleOptions(
                  geometry: LatLng(m.point.lat, m.point.lng),
                  circleRadius: m.id == data.selectedId ? 11 : 7,
                  circleColor: m.id == data.selectedId
                      ? _selectedColor
                      : _markerColor,
                  circleStrokeWidth: 2.5,
                  circleStrokeColor: '#ffffff',
                ),
            ],
            [
              for (final m in data.markers) {'id': m.id},
            ],
          );
        }
        if (_needsFit) {
          _needsFit = false;
          await _fit(controller, data);
        }
      } while (_dirty && mounted);
    } finally {
      _syncing = false;
    }
  }

  Future<void> _fit(MapLibreMapController controller, PlacesMapData data) {
    final points = [for (final m in data.markers) m.point];
    if (points.isEmpty) {
      return controller.animateCamera(
        CameraUpdate.newLatLngZoom(
          LatLng(data.center.lat, data.center.lng),
          data.zoom,
        ),
        duration: Duration.zero,
      );
    }
    if (points.length == 1) {
      return controller.animateCamera(
        CameraUpdate.newLatLngZoom(
          LatLng(points.first.lat, points.first.lng),
          15,
        ),
        duration: Duration.zero,
      );
    }
    var south = points.first.lat, north = south;
    var west = points.first.lng, east = west;
    for (final p in points) {
      if (p.lat < south) south = p.lat;
      if (p.lat > north) north = p.lat;
      if (p.lng < west) west = p.lng;
      if (p.lng > east) east = p.lng;
    }
    return controller.animateCamera(
      CameraUpdate.newLatLngBounds(
        LatLngBounds(
          southwest: LatLng(south, west),
          northeast: LatLng(north, east),
        ),
        left: 48,
        top: 48,
        right: 48,
        bottom: 48,
      ),
      duration: Duration.zero,
    );
  }

  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    return MapLibreMap(
      styleString: widget.styleString,
      initialCameraPosition: CameraPosition(
        target: LatLng(data.center.lat, data.center.lng),
        zoom: data.zoom,
      ),
      onMapCreated: _onCreated,
      onStyleLoadedCallback: _onStyleLoaded,
      compassEnabled: false,
      rotateGesturesEnabled: false,
      tiltGesturesEnabled: false,
      scrollGesturesEnabled: data.interactive,
      zoomGesturesEnabled: data.interactive,
      dragEnabled: data.interactive,
    );
  }
}
