export const GLOBAL_ROUTING_KEYS = [
  { key: "LIBRARY_HEAD", label: "Library Head" },
  { key: "CANTEEN_HEAD", label: "Canteen Head" },
  { key: "SANITATION_HEAD", label: "Sanitation Head" },
  { key: "BOYS_HOSTEL_WARDEN", label: "Boys Hostel Warden" },
  { key: "GIRLS_HOSTEL_WARDEN", label: "Girls Hostel Warden" },
  { key: "BOYS_MESS_MANAGER", label: "Boys Mess Manager" },
  { key: "GIRLS_MESS_MANAGER", label: "Girls Mess Manager" },
  { key: "TRANSPORT_MANAGER", label: "Transport Manager" },
  { key: "PARENT_FEEDBACK_MANAGER", label: "Parent Feedback Manager" }
];

export const GLOBAL_ROUTING_KEY_VALUES = GLOBAL_ROUTING_KEYS.map(k => k.key);
