import 'dart:convert';
import 'package:http/http.dart' as http;
import 'lib/models/ticket.dart';

void main() async {
  final baseUrl = 'http://127.0.0.1:3030/api'; // explicit loopback

  try {
    print('1. Logging in...');
    final loginRes = await http.post(
      Uri.parse('\$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'identifier': '9952437137',
        'role': 'Student',
        'password': 'password123'
      })
    );
    
    if (loginRes.statusCode != 200) {
      print('Login failed: \${loginRes.statusCode} \${loginRes.body}');
      return;
    }
    
    final token = jsonDecode(loginRes.body)['token'];
    print('2. Token received: \$token');
    
    print('3. Fetching tickets...');
    final ticketsRes = await http.get(
      Uri.parse('\$baseUrl/tickets'),
      headers: {'Authorization': 'Bearer \$token'}
    );
    
    print('Tickets Status: \${ticketsRes.statusCode}');
    print('Tickets Body: \${ticketsRes.body}');
    
    if (ticketsRes.statusCode == 200) {
      final json = jsonDecode(ticketsRes.body);
      final List<dynamic> data = json['data'];
      print('4. Parsing \${data.length} tickets...');
      
      for (var i = 0; i < data.length; i++) {
        try {
          final ticket = Ticket.fromJson(data[i]);
          print('  Successfully parsed ticket \${ticket.id}');
        } catch (e, st) {
          print('  Error parsing ticket \$i: \$e');
          print(st);
        }
      }
    }
    
    print('5. Fetching stats...');
    final statsRes = await http.get(
      Uri.parse('\$baseUrl/dashboard/stats'),
      headers: {'Authorization': 'Bearer \$token'}
    );
    
    print('Stats Status: \${statsRes.statusCode}');
    print('Stats Body: \${statsRes.body}');
    
  } catch (e, st) {
    print('UNEXPECTED ERROR: \$e');
    print(st);
  }
}
