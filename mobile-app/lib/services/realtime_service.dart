import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../config/api_config.dart';

enum RealtimeConnectionState {
  connecting,
  connected,
  reconnecting,
  disconnected,
}

class RealtimeService {
  static final RealtimeService _instance = RealtimeService._internal();
  factory RealtimeService() => _instance;
  RealtimeService._internal();

  IO.Socket? _socket;
  
  // Connection state stream
  final _connectionStateController = StreamController<RealtimeConnectionState>.broadcast();
  Stream<RealtimeConnectionState> get connectionStateStream => _connectionStateController.stream;
  
  // Event streams
  final _ticketUpdatesController = StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get ticketUpdatesStream => _ticketUpdatesController.stream;
  
  final _dashboardUpdatesController = StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get dashboardUpdatesStream => _dashboardUpdatesController.stream;
  
  final _notificationUpdatesController = StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get notificationUpdatesStream => _notificationUpdatesController.stream;

  bool get isConnected => _socket?.connected ?? false;

  void connect(String jwtToken) {
    if (_socket != null && _socket!.connected) return;

    _connectionStateController.add(RealtimeConnectionState.connecting);

    // Using ApiConfig.serverBase directly which handles ports and paths natively
    final socketUrl = ApiConfig.serverBase;

    _socket = IO.io(socketUrl, IO.OptionBuilder()
      .setTransports(['websocket'])
      .setAuth({'token': jwtToken})
      .enableReconnection()
      .enableAutoConnect()
      .build()
    );

    _socket!.onConnect((_) {
      print('[RealtimeService] Connected to Socket.IO Server');
      _connectionStateController.add(RealtimeConnectionState.connected);
    });

    _socket!.onReconnect((_) {
      print('[RealtimeService] Reconnected to Socket.IO Server');
      _connectionStateController.add(RealtimeConnectionState.connected);
    });

    _socket!.onReconnectAttempt((_) {
      _connectionStateController.add(RealtimeConnectionState.reconnecting);
    });

    _socket!.onDisconnect((_) {
      print('[RealtimeService] Disconnected from Socket.IO Server');
      _connectionStateController.add(RealtimeConnectionState.disconnected);
    });

    _socket!.onConnectError((error) {
      print('[RealtimeService] Connect Error: $error');
      _connectionStateController.add(RealtimeConnectionState.disconnected);
    });

    // Listen to ticket events
    _socket!.on('ticket_created', (data) => _ticketUpdatesController.add({'event': 'ticket_created', 'data': data}));
    _socket!.on('ticket_updated', (data) => _ticketUpdatesController.add({'event': 'ticket_updated', 'data': data}));
    _socket!.on('ticket_assigned', (data) => _ticketUpdatesController.add({'event': 'ticket_assigned', 'data': data}));
    _socket!.on('ticket_resolved', (data) => _ticketUpdatesController.add({'event': 'ticket_resolved', 'data': data}));
    _socket!.on('ticket_escalated', (data) => _ticketUpdatesController.add({'event': 'ticket_escalated', 'data': data}));

    // Listen to dashboard deltas
    _socket!.on('dashboard_stats_updated', (data) => _dashboardUpdatesController.add(Map<String, dynamic>.from(data)));

    // Listen to notification events
    _socket!.on('notification_created', (data) => _notificationUpdatesController.add(Map<String, dynamic>.from(data)));
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _connectionStateController.add(RealtimeConnectionState.disconnected);
  }

  void joinTicketRoom(String ticketId) {
    if (_socket != null && _socket!.connected) {
      _socket!.emit('join_ticket', ticketId);
    }
  }

  void leaveTicketRoom(String ticketId) {
    if (_socket != null && _socket!.connected) {
      _socket!.emit('leave_ticket', ticketId);
    }
  }
}
