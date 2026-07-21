import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:campus_connect/services/ticket_service.dart';
import 'package:campus_connect/services/auth_service.dart';
import 'package:campus_connect/services/fcm_service.dart';
import 'package:campus_connect/app/app.dart';
import 'package:firebase_core/firebase_core.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp();
    await FCMService().initialize();
    debugPrint('[Startup] Firebase & FCM initialized successfully');
  } catch (e) {
    debugPrint('Firebase initialization failed, but app will continue: $e');
  }

  try {
    final stopwatch = Stopwatch()..start();
    debugPrint('Startup: App launched');
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
      ),
    );
    await SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
    ]);
    
    debugPrint('[Startup] Firebase initialized successfully');

    final prefs = await SharedPreferences.getInstance();
    final authService = AuthService(); // Uses ApiService
    final ticketService = TicketService();

    runApp(QRFeedbackApp(authService: authService, ticketService: ticketService));
  } catch (e, st) {
    debugPrint('CRITICAL STARTUP ERROR: $e\n$st');
    runApp(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: Text('Startup Error: $e'),
          ),
        ),
      ),
    );
  }
}
