import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:trip/features/map/presentation/places_map.dart';

/// Stand-in for MapLibre: one button per pin, so tests can tap markers.
Widget fakeMapBuilder(BuildContext context, PlacesMapData data) => Column(
  key: const Key('fake-map'),
  children: [
    Text('pins:${data.markers.length} interactive:${data.interactive}'),
    for (final m in data.markers)
      TextButton(
        key: Key('pin-${m.id}'),
        onPressed: () => data.onSelect?.call(m.id),
        child: Text('pin ${m.id}${m.id == data.selectedId ? ' *' : ''}'),
      ),
  ],
);

Override fakeMapOverride() =>
    placesMapBuilderProvider.overrideWithValue(fakeMapBuilder);
