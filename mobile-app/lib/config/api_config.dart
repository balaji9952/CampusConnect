class ApiConfig {
  static const apiBase = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'http://103.207.1.91:3019/api',
  );

  static String get serverBase => apiBase.replaceFirst('/api', '');
}
