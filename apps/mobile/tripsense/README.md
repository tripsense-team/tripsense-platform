# TripSense Mobile

Flutter application for the TripSense mobile experience.

## Architecture

The MVP foundation uses:

- `lib/app` for app bootstrap, routing, and theme.
- `lib/core` for cross-cutting config, networking, errors, and session state.
- `lib/features/startup` for the neutral startup shell.

All backend traffic must go through the API Gateway. Do not point mobile code at service-local URLs.

## Environment

The default API Gateway base URL is:

```text
http://10.0.2.2:8080
```

This default supports Android emulator access to a Gateway running on the host machine.

For iOS simulator, pass:

```shell
flutter run --dart-define=TRIPSENSE_API_BASE_URL=http://localhost:8080
```

## Development

```shell
flutter pub get
flutter analyze
flutter test
```
