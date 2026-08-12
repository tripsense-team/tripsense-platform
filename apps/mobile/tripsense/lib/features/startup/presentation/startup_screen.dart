import 'package:flutter/material.dart';

class StartupScreen extends StatelessWidget {
  const StartupScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('TripSense')),
      body: const Center(child: Text('TripSense mobile foundation')),
    );
  }
}
