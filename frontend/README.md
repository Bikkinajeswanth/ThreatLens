# ThreatLens Frontend

A modern React-based frontend for the ThreatLens vulnerability scanning platform.

## Features

- **Authentication System**: Secure login/register with JWT token management
- **Dashboard**: Overview of scans, statistics, and recent activity
- **Scan Management**: Create new scans and view scan history
- **Results Visualization**: Detailed vulnerability reports with charts
- **Report Downloads**: PDF report generation and download
- **Responsive Design**: Mobile-friendly dark theme interface

## Tech Stack

- **React 18** - Modern React with hooks
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **React Router v6** - Client-side routing
- **Axios** - HTTP client with interceptors
- **Recharts** - Data visualization charts
- **Heroicons** - Beautiful SVG icons

## Project Structure

```
src/
├── components/          # Reusable UI components
│   └── Layout.jsx      # Main layout with navigation
├── context/            # React context providers
│   └── AuthContext.jsx # Authentication state management
├── hooks/              # Custom React hooks
│   └── useScans.js     # Scan management hook
├── pages/              # Page components
│   ├── Dashboard.jsx   # Main dashboard
│   ├── Login.jsx       # Login page
│   ├── Register.jsx    # Registration page
│   ├── NewScan.jsx     # Create new scan
│   ├── ScanHistory.jsx # Scan history list
│   ├── ScanResults.jsx # Scan results details
│   └── Reports.jsx     # Reports management
├── routes/             # Route protection
│   └── ProtectedRoute.jsx
├── services/           # API services
│   └── api.js          # Axios configuration and API calls
└── utils/              # Utility functions
    └── helpers.js      # Common helper functions
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- ThreatLens backend running on port 3000

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
# Copy and edit environment file
cp .env.example .env
```

3. Start development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Environment Variables

```env
VITE_API_URL=http://localhost:3000/api
```

## API Integration

The frontend integrates with the following backend endpoints:

- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - User registration
- `GET /api/scans` - Fetch user scans
- `POST /api/scans` - Create new scan
- `GET /api/scans/:id` - Get scan details
- `GET /api/reports` - Fetch reports
- `GET /api/reports/:id/download` - Download report

## Authentication Flow

1. User logs in with email/password
2. JWT token stored in localStorage
3. Token automatically included in API requests
4. Automatic redirect to login on 401 responses
5. Protected routes require authentication

## Key Features

### Dashboard
- Scan statistics overview
- Recent scans list
- Quick access to create new scan

### Scan Management
- URL validation and scan creation
- Real-time scan status updates
- Comprehensive scan history

### Results Visualization
- Vulnerability severity charts
- Detailed finding descriptions
- Risk score calculation
- Actionable recommendations

### Report System
- PDF report downloads
- Report metadata display
- Automatic report generation

## Styling

The application uses a dark cybersecurity theme with:

- **Primary Colors**: Blue (#3b82f6)
- **Dark Theme**: Gray scale (#0f172a to #f8fafc)
- **Status Colors**: Red (critical), Orange (high), Yellow (medium), Blue (low)
- **Responsive Design**: Mobile-first approach

## Build and Deployment

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

## Security Considerations

- JWT tokens stored in localStorage
- Automatic token cleanup on logout
- Protected routes with authentication checks
- Input validation on forms
- Secure API communication

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Follow the existing code structure
2. Use TypeScript for new components (optional)
3. Maintain responsive design principles
4. Test authentication flows
5. Ensure accessibility compliance