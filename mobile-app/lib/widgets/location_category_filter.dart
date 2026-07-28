import 'package:flutter/material.dart';
import 'package:campus_connect/models/ticket.dart';

class LocationCategory {
  final int id;
  final String name;
  final int count;

  LocationCategory({required this.id, required this.name, required this.count});
}

class LocationCategoryFilter extends StatelessWidget {
  final List<Ticket> tickets;
  final int? selectedCategoryId;
  final ValueChanged<int?> onChanged;

  const LocationCategoryFilter({
    Key? key,
    required this.tickets,
    required this.selectedCategoryId,
    required this.onChanged,
  }) : super(key: key);

  IconData _getIconForCategory(String name) {
    switch (name.toLowerCase()) {
      case 'academic':
        return Icons.school;
      case 'hostel':
        return Icons.hotel;
      case 'laundry':
        return Icons.local_laundry_service;
      case 'canteen':
        return Icons.restaurant;
      case 'transport':
        return Icons.directions_bus;
      case 'library':
        return Icons.local_library;
      case 'sports':
        return Icons.sports_soccer;
      default:
        return Icons.location_on;
    }
  }

  List<LocationCategory> _extractCategories() {
    final Map<int, LocationCategory> categoryMap = {};

    for (final ticket in tickets) {
      final id = ticket.locationCategoryId;
      final name = ticket.locationCategoryName;
      
      if (id != null && name != null) {
        if (categoryMap.containsKey(id)) {
          final existing = categoryMap[id]!;
          categoryMap[id] = LocationCategory(
            id: id,
            name: existing.name,
            count: existing.count + 1,
          );
        } else {
          categoryMap[id] = LocationCategory(id: id, name: name, count: 1);
        }
      }
    }

    final categories = categoryMap.values.toList();
    categories.sort((a, b) => a.name.compareTo(b.name));
    return categories;
  }

  @override
  Widget build(BuildContext context) {
    final categories = _extractCategories();
    // Only show the filter if there are tickets with categories
    if (categories.isEmpty) return const SizedBox.shrink();

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
      child: Row(
        children: [
          _buildChip(
            context,
            id: null,
            name: 'All',
            count: tickets.length,
            icon: Icons.all_inclusive,
          ),
          ...categories.map((cat) => Padding(
                padding: const EdgeInsets.only(left: 8.0),
                child: _buildChip(
                  context,
                  id: cat.id,
                  name: cat.name,
                  count: cat.count,
                  icon: _getIconForCategory(cat.name),
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildChip(
    BuildContext context, {
    required int? id,
    required String name,
    required int count,
    required IconData icon,
  }) {
    final isSelected = selectedCategoryId == id;
    final theme = Theme.of(context);

    return ChoiceChip(
      label: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 16,
            color: isSelected ? Colors.white : theme.iconTheme.color,
          ),
          const SizedBox(width: 6),
          Text(
            '$name ($count)',
            style: TextStyle(
              color: isSelected ? Colors.white : theme.textTheme.bodyMedium?.color,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ],
      ),
      selected: isSelected,
      onSelected: (_) => onChanged(id),
      selectedColor: theme.primaryColor,
      backgroundColor: theme.cardColor,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(
          color: isSelected ? theme.primaryColor : Colors.grey.shade300,
        ),
      ),
    );
  }
}
