enum AppFailureType {
  network,
  timeout,
  unauthorized,
  forbidden,
  server,
  unknown,
}

class AppFailure {
  const AppFailure({required this.type, this.statusCode, this.message});

  final AppFailureType type;
  final int? statusCode;
  final String? message;
}
