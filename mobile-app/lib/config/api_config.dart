class ApiConfig {
  static const apiBase = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'https://untrained-trophy-overarch.ngrok-free.dev/api',
  );

  static String get serverBase => apiBase.replaceFirst('/api', '');
}
