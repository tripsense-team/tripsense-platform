# TripSense Mobile

Flutter app for **travelers (role USER) only**. Admin, moderator and partner
accounts are managed on the web; they are signed out with a "use the website"
message. Spec: [docs/features/mobile-user-app.md](../../../docs/features/mobile-user-app.md).

## Architecture

Feature-first, three layers per feature (`presentation -> domain <- data`):

```text
lib/
  app/        bootstrap, router (+ auth guard), theme, route paths
  core/       config, network (dio + cookie jar + auth interceptor), errors, shared UI
  features/   auth, profile, shell, startup, ... (data / domain / presentation)
  l10n/       ARB files (vi default, en) + generated localizations
```

- State: Riverpod `Notifier`s. Models are plain immutable Dart classes (no codegen).
- All backend traffic goes through the API Gateway; never use service ports.
- Auth: access token lives in RAM only; the HttpOnly refresh cookie is stored in
  Keychain/Keystore (`SecureCookieStorage`). Refresh is single-flight.
- Errors are normalised to `AppFailure` and shown through localized messages;
  raw server text is never displayed (zero-leak policy).

## Environment

Default Gateway URL (Android emulator -> host): `http://10.0.2.2:8085`.

```shell
# iOS simulator / desktop / physical device on the same network
flutter run --dart-define=TRIPSENSE_API_BASE_URL=http://localhost:8085
```

## Development

```shell
flutter pub get
flutter gen-l10n      # after editing lib/l10n/*.arb
flutter analyze
flutter test
```

Add UI strings to **both** `app_en.arb` and `app_vi.arb`; never hard-code text.
