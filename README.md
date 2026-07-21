# Campus Connect

Welcome to Campus Connect, an integrated platform for managing complaints, location tracking, and administrative notifications within the college environment.

## Overview
This repository uses a monorepo structure containing a Flutter mobile application for staff and students, a Node.js backend API, and several web portals for administration and analytics.

## Technologies Used
- **Backend API**: Node.js, Express, TypeScript, Prisma ORM, PostgreSQL (via Supabase)
- **Mobile App**: Flutter, Dart, Firebase Cloud Messaging
- **Web Portals**: HTML, Vanilla CSS, Vanilla JavaScript (Admin Portal, Parent Portal, Executive Portal)

## Repository Structure
```
├── docs/                 # Architecture, deployment, and API documentation
├── scripts/              # Utility and deployment scripts
├── backend-api/          # Node.js REST API
├── mobile-app/           # Flutter Mobile Application
├── admin-portal/         # Web dashboard for Administrators
├── executive-portal/     # Web dashboard for Executives
├── parent-portal/        # Web dashboard for Parents
└── CampusQrGenerator/    # Utility for generating location QR codes
```

## Setup & Running
Each component has its own setup requirements. Please see the individual README files inside the respective folders:
- [Backend API Guide](./backend-api/README.md)
- [Mobile App Guide](./mobile-app/README.md)
- [Admin Portal Guide](./admin-portal/README.md)

## Environment Variables
Ensure you copy `.env.example` to `.env` in the `backend-api` and fill in the necessary secrets (like Supabase `DATABASE_URL`, JWT secrets, etc.) before running.

## Deployment Overview
The backend is designed to be run with PM2 behind an NGINX reverse proxy. Web portals can be served statically (e.g. via NGINX or Apache), and the mobile app is compiled to an Android APK.

## Contributors
*Balaji* and the Campus Connect Development Team.
