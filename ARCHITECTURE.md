# Fitbit Workout Exporter - Architecture Documentation

## Overview

A Next.js web application that allows users to export their Fitbit workout activities as TCX files. The app uses OAuth 2.0 for authentication and implements lazy-loading pagination with localStorage caching for optimal performance.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Authentication**: NextAuth.js 4.24
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Runtime**: Node.js 20+

## Architecture

### Authentication Flow

1. **OAuth Provider**: Custom Fitbit OAuth 2.0 provider (not using built-in provider)
2. **Session Management**: NextAuth.js with JWT strategy
3. **Token Storage**: Access tokens stored in JWT, refreshed automatically
4. **Required Scopes**: `location`, `heartrate`, `profile`, `activity`

#### Key Files
- [`src/app/api/auth/[...nextauth]/route.ts`](src/app/api/auth/[...nextauth]/route.ts) - NextAuth configuration
- [`src/types/next-auth.d.ts`](src/types/next-auth.d.ts) - Type extensions for session/token

#### Critical Configuration
- **App Type**: Must be set to "Personal" in Fitbit Developer Portal (required for intraday data access)
- **Callback URL**: `http://localhost:3000/api/auth/callback/fitbit`
- **Environment Variables**:
  - `NEXT_PUBLIC_FITBIT_CLIENT_ID` - Public client ID
  - `FITBIT_CLIENT_SECRET` - Secret (server-side only)
  - `NEXTAUTH_SECRET` - JWT signing secret
  - `NEXTAUTH_URL` - Base URL (http://localhost:3000)

### Data Flow

```
User → Sign In → Fitbit OAuth → Access Token → Session
                                      ↓
                              Stored in JWT
                                      ↓
                    Used for API calls to Fitbit
```

### API Routes

#### 1. Authentication
- **Route**: `/api/auth/[...nextauth]`
- **Purpose**: Handles OAuth flow, token refresh, session management
- **Callbacks**:
  - `jwt`: Stores access/refresh tokens from Fitbit
  - `session`: Adds tokens to session object

#### 2. Activities List
- **Route**: `/api/activities`
- **Method**: GET
- **Query Params**: `limit` (default 10), `offset` (default 0)
- **Purpose**: Proxies Fitbit API to fetch paginated activity list
- **Returns**: `{ activities: [], hasMore: boolean, total: number }`

#### 3. TCX Download
- **Route**: `/api/activities/[logId]/tcx`
- **Method**: GET
- **Purpose**: Proxies Fitbit TCX endpoint with `includePartialTCX=true`
- **Returns**: TCX file as download
- **Note**: Also fetches activity details for debugging

### Frontend Components

#### Main Page (`src/app/page.tsx`)
- Server component
- Checks authentication status
- Renders sign-in button or WorkoutList

#### LoginButton (`src/components/LoginButton.tsx`)
- Client component
- Triggers `signIn('fitbit')` directly (no intermediate page)

#### WorkoutList (`src/components/WorkoutList.tsx`)
- **Client component** with complex state management
- **Features**:
  - Lazy-loading pagination
  - localStorage caching (15-minute TTL)
  - Background fetching for total count
  - URL synchronization for browser navigation
  - Numbered pagination with ellipsis

##### State Management
```typescript
activities: FitbitActivity[]     // Sparse array of all activities
loading: boolean                 // Current page loading
currentPage: number              // Synced with URL ?page=X
totalCount: number | null        // Known after background fetch
backgroundFetching: boolean      // Background discovery in progress
hasMore: boolean                 // More pages available
```

##### Caching Strategy
```typescript
interface CachedData {
  activities: FitbitActivity[]
  timestamp: number
  totalCount?: number
}
```
- **Cache Key**: `fitbit_activities_cache`
- **TTL**: 15 minutes
- **Storage**: localStorage
- **Invalidation**: Automatic on expiry

##### Pagination Logic

1. **Initial Load**:
   - Check cache → Load if valid
   - Else fetch first page (10 items)
   - Start background fetch for total count

2. **Page Navigation**:
   - Update URL (`?page=X`)
   - Check if page data exists in cache
   - Fetch if missing
   - No scroll jump

3. **Background Fetch**:
   - Starts after first page loads
   - Fetches in 100-item batches
   - 100ms delay between requests
   - Updates cache when complete
   - Shows "Discovering activities..." indicator

4. **Page Number Display**:
   - Shows all if ≤7 pages
   - Smart ellipsis for many pages:
     - `1 2 3 4 ... 10` (near start)
     - `1 ... 4 5 6 ... 10` (middle)
     - `1 ... 7 8 9 10` (near end)

### Fitbit API Integration

#### Endpoints Used

1. **Activities List**
   ```
   GET https://api.fitbit.com/1/user/-/activities/list.json
   Params: beforeDate, sort=desc, limit, offset
   ```

2. **Activity Details** (for debugging)
   ```
   GET https://api.fitbit.com/1/user/-/activities/{logId}.json
   ```

3. **TCX Export**
   ```
   GET https://api.fitbit.com/1/user/-/activities/{logId}.tcx
   Params: includePartialTCX=true
   ```

#### Authentication
All requests use Bearer token:
```typescript
headers: {
  Authorization: `Bearer ${accessToken}`
}
```

### File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts  # NextAuth handler
│   │   └── activities/
│   │       ├── route.ts                 # List proxy
│   │       └── [logId]/tcx/route.ts     # TCX proxy
│   ├── layout.tsx                       # Root layout with SessionProvider
│   ├── page.tsx                         # Home page (server component)
│   └── providers.tsx                    # Client-side providers wrapper
├── components/
│   ├── LoginButton.tsx                  # Sign-in button
│   └── WorkoutList.tsx                  # Main activity list component
├── lib/
│   └── fitbit.ts                        # Fitbit API utilities (legacy)
└── types/
    └── next-auth.d.ts                   # NextAuth type extensions
```

### Docker Support

- **Dockerfile**: Multi-stage build with Node 24
- **docker-compose.yml**: Loads `.env.local`, exposes port 3000
- **Makefile**: Convenience commands
  - `make install` - Install dependencies
  - `make run-local` - Run dev server
  - `make run-docker` - Run in Docker
  - `make stop-docker` - Stop containers

### Key Design Decisions

1. **Why Custom Fitbit Provider?**
   - Built-in `next-auth/providers/fitbit` not available in installed version
   - Custom implementation gives full control over scopes and token handling

2. **Why Client-Side Pagination?**
   - Faster initial page load (only 10 items)
   - Better UX with instant navigation (cached pages)
   - Reduces server load

3. **Why Background Fetch?**
   - User gets immediate access to first page
   - Total count discovered progressively
   - Cached for subsequent visits

4. **Why localStorage?**
   - Persists across page refreshes
   - Reduces API calls (15-minute cache)
   - Simple, no backend database needed

5. **Why URL Sync?**
   - Browser back/forward navigation works
   - Shareable/bookmarkable page links
   - Better UX consistency

### Common Issues & Solutions

#### Issue: Empty TCX Files
- **Cause**: App type not set to "Personal" in Fitbit Developer Portal
- **Solution**: Change to "Personal" type, re-authenticate

#### Issue: "Unauthorized" on API Calls
- **Cause**: Access token not in session
- **Solution**: Check `authOptions` is passed to `getServerSession`, not the handler

#### Issue: Hydration Errors
- **Cause**: Browser extensions (e.g., Grammarly) modifying DOM
- **Solution**: Added `suppressHydrationWarning` to `<body>` tag

#### Issue: Only Shows Recent Activities
- **Cause**: API limit parameter too low
- **Solution**: Background fetch now retrieves all activities

### Performance Optimizations

1. **Lazy Loading**: Only fetch visible page
2. **Caching**: 15-minute localStorage cache
3. **Background Fetch**: Non-blocking total count discovery
4. **Batch Requests**: 100 items per background request
5. **Rate Limiting**: 100ms delay between background requests
6. **Sparse Array**: Efficient memory usage for large datasets

### Security Considerations

- ✅ Client secrets in environment variables (not committed)
- ✅ `.env.local` in `.gitignore`
- ✅ `.env.example` provided for reference
- ✅ Access tokens stored in JWT (server-side)
- ✅ No hardcoded credentials in codebase
- ✅ OAuth 2.0 with proper scopes

### Future Enhancements (Not Implemented)

- Bulk download (zip all TCX files)
- Activity filtering by type/date
- Export to other formats (GPX, FIT)
- Server-side database for faster loads
- Progressive Web App (offline support)
- Activity statistics/charts
