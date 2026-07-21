/// Represents the result of a successful QR verification.
/// Contains the server-authoritative location and the one-time verification token.
///
/// The `locationLabel` is already role-filtered by the backend:
/// - Students → "Academic"
/// - Staff (matching dept) → full path, e.g., "Academic-Ground Floor-07"
/// - Principal/Director/Admin → always full path
class VerifiedLocation {
  final int locationId;
  final int? subLocationId;
  /// Role-filtered display label — safe to show directly to the user.
  final String locationLabel;
  final String verificationToken;
  final String category;

  const VerifiedLocation({
    required this.locationId,
    this.subLocationId,
    required this.locationLabel,
    required this.verificationToken,
    required this.category,
  });

  factory VerifiedLocation.fromJson(Map<String, dynamic> json) {
    return VerifiedLocation(
      locationId:        json['locationId'] as int,
      subLocationId:     json['subLocationId'] as int?,
      locationLabel:     json['locationLabel'] as String,
      verificationToken: json['verificationToken'] as String,
      category:          json['category'] as String? ?? 'General',
    );
  }

  @override
  String toString() =>
      'VerifiedLocation(id=$locationId, subId=$subLocationId, label=$locationLabel, category=$category)';
}
