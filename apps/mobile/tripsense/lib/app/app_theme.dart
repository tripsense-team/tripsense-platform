import 'package:flutter/material.dart';

ThemeData buildTripSenseTheme() {
  const seedColor = Color(0xFF1E7A6D);

  return ThemeData(
    colorScheme: ColorScheme.fromSeed(seedColor: seedColor),
    useMaterial3: true,
  );
}
