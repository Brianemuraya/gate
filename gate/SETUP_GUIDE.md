# Gateman Security App - Setup Guide

## Overview
This is a Firebase-powered CRUD application for building security/gateman use. It allows recording visitor and vehicle entry/exit with automatic timestamps.

## Features
✅ **Check In** - Record visitor entry with ID, name, and optional vehicle plate
✅ **Check Out** - Sign out visitors by ID number
✅ **Active Visitors** - View all people currently inside the building
✅ **History** - Complete log of all entries and exits with duration
✅ **Real-time Updates** - Data syncs automatically across all devices
✅ **Kenyan ID Format** - Validates 8-digit ID numbers
✅ **Kenyan Plate Format** - Validates format like KBM243T

## Firebase Setup Instructions

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project"
3. Enter project name (e.g., "gateman-security")
4. Follow the setup wizard (disable Google Analytics if not needed)

### Step 2: Register Web App
1. In your Firebase project, click the **Web** icon (</>) 
2. Register app with nickname (e.g., "Gateman App")
3. Firebase will show your configuration object - **COPY IT**

### Step 3: Enable Firestore Database
1. In Firebase Console, go to **Build > Firestore Database**
2. Click "Create database"
3. Start in **Production mode** (we'll set rules next)
4. Choose location closest to Kenya (e.g., `europe-west1` or `asia-south1`)

### Step 4: Configure Firestore Security Rules
Go to **Firestore Database > Rules** and paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /visitors/{document=**} {
      // Allow read and write for now
      // In production, add authentication
      allow read, write: if true;
    }
  }
}
```

**⚠️ IMPORTANT FOR PRODUCTION:**
These rules allow anyone to read/write. For production:
- Add Firebase Authentication
- Restrict writes to authenticated gateman users only
- Consider adding data validation rules

### Step 5: Update App Configuration
1. Open `gateman-app.jsx`
2. Find the `firebaseConfig` object (around line 18)
3. Replace with YOUR Firebase credentials:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

## Installation & Running

### Prerequisites
- Node.js 16+ installed
- npm or yarn package manager

### Install Dependencies
```bash
npm install react firebase lucide-react
```

### Development
```bash
npm start
```

### Build for Production
```bash
npm run build
```

## Database Structure

### Collection: `visitors`
Each document contains:
```javascript
{
  idNumber: "24807965",        // 8-digit Kenyan ID
  firstName: "Edward",          // Visitor first name
  lastName: "John",             // Visitor last name
  carPlate: "KBM243T",         // Optional, Kenyan plate format
  timeIn: Timestamp,            // Auto-generated entry time
  timeOut: Timestamp | null,    // Auto-generated exit time
  status: "inside" | "left",    // Current status
  createdAt: Timestamp          // Record creation time
}
```

## How to Use

### Check In Process
1. Click "Check In" tab
2. Enter 8-digit ID number (must be all digits)
3. Enter first name and last name
4. Optionally enter car plate in format: KBM243T
5. Click "Check In Visitor"
6. System automatically records current time

### Check Out Process
1. Click "Check Out" tab
2. Enter visitor's 8-digit ID number
3. Click "Check Out Visitor"
4. System automatically records exit time and calculates duration

### View Active Visitors
- Click "Inside Now" tab to see everyone currently in the building
- Shows name, ID, vehicle (if any), and entry time

### View History
- Click "History" tab for complete activity log
- Shows all entries with time in, time out, and duration
- Color-coded status (green = inside, gray = left)

## Validation Rules

### ID Number
- Must be exactly 8 digits
- All characters must be numbers
- Example: `24807965`

### Car Plate (Optional)
- Kenyan format: 3 letters + 3 numbers + 1 letter
- Example: `KBM243T`, `KAA123B`
- Automatically converted to uppercase

### Names
- Required fields
- Cannot be empty or whitespace only

## Features Explained

### Automatic Timestamps
- Firebase `serverTimestamp()` ensures accurate Kenya time
- No manual time entry needed
- Prevents time manipulation

### Duplicate Prevention
- Cannot check in same ID twice without checking out first
- System validates before allowing entry

### Real-time Updates
- All changes sync immediately
- Multiple gatemen can use the app simultaneously
- Data appears instantly across all devices

## Deployment Options

### Option 1: Firebase Hosting (Recommended)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
```

### Option 2: Vercel
1. Push code to GitHub
2. Import to Vercel
3. Deploy automatically

### Option 3: Netlify
1. Drag and drop build folder
2. Or connect GitHub repo
3. Deploy

## Security Recommendations for Production

1. **Enable Firebase Authentication**
   - Only authenticated gatemen can write data
   - Use email/password or phone authentication

2. **Update Firestore Rules**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /visitors/{document=**} {
         allow read: if request.auth != null;
         allow write: if request.auth != null 
                      && request.auth.token.role == "gateman";
       }
     }
   }
   ```

3. **Add Rate Limiting**
   - Prevent abuse with Firebase App Check
   - Limit requests per IP

4. **Enable Backup**
   - Set up daily Firestore backups
   - Export data regularly

## Troubleshooting

### "Permission denied" errors
- Check Firestore security rules
- Verify Firebase config is correct
- Ensure database is in the correct location

### Data not appearing
- Check browser console for errors
- Verify internet connection
- Ensure Firebase config is properly set

### Timestamp showing wrong time
- Firebase uses server time (accurate)
- Check device timezone settings
- Times are stored in UTC, displayed in Kenya time

## Support & Customization

### Add More Fields
To add fields like "Purpose of Visit" or "Company":
1. Update `formData` state
2. Add input field in Check In form
3. Include in `addDoc` call

### Export Reports
Add export functionality:
```javascript
const exportToCSV = () => {
  const csv = recentActivity.map(r => 
    `${r.idNumber},${r.firstName},${r.lastName},${formatTime(r.timeIn)},${formatTime(r.timeOut)}`
  ).join('\n');
  // Download CSV logic
};
```

### Add Photos
Integrate Firebase Storage to capture visitor photos during check-in.

## License
This application is provided as-is for gateman security purposes.

---

**Built with:** React, Firebase Firestore, Lucide Icons
**Optimized for:** Kenyan building security operations
