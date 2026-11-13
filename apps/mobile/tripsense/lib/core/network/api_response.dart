/// Envelope returned by every TripSense service: `{success, message, data}`.
class ApiResponse<T> {
  const ApiResponse({required this.success, required this.message, this.data});

  final bool success;
  final String message;
  final T? data;

  static ApiResponse<T> fromJson<T>(
    Object? json,
    T Function(Object? data) parseData,
  ) {
    final map = json is Map<String, dynamic> ? json : const <String, dynamic>{};
    final rawData = map['data'];
    return ApiResponse<T>(
      success: map['success'] as bool? ?? false,
      message: map['message'] as String? ?? '',
      data: rawData == null ? null : parseData(rawData),
    );
  }
}

/// Reads `data` as a JSON object or fails with a parse error caught upstream.
Map<String, dynamic> asJsonMap(Object? value) =>
    Map<String, dynamic>.from(value! as Map);

List<Map<String, dynamic>> asJsonList(Object? value) => [
  for (final item in value! as List) Map<String, dynamic>.from(item as Map),
];
