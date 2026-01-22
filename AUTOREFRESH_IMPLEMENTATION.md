# Auto-Refresh Reports Count Implementation

## Overview
Implemented a centralized, auto-refreshing report count system across the entire codebase to replace hardcoded "963+" values with dynamic counts.

## Changes Made

### 1. Created Core Utility (`src/utils/reportsCount.ts`)
- **`getReportsCount()`**: Returns the current number of reports from the data source
- **`getReportsCountFormatted()`**: Returns formatted count with "+" suffix (e.g., "976+")
- **`useReportsCount(options)`**: React hook with auto-refresh capability
  - `autoRefresh`: Enable/disable auto-refresh (default: true)
  - `refreshInterval`: Polling interval in milliseconds (default: 60000 = 1 minute)
- **`useReportsCountStatic()`**: Lightweight hook without auto-refresh

### 2. Updated Pages

#### Landing Page (`src/pages/Landing.tsx`)
- ✅ Hero section description
- ✅ Meta description tag
- ✅ Features section (Reports Library feature)
- ✅ Reports highlight section heading
- ✅ CTA section description

#### About Page (`src/pages/About.tsx`)
- ✅ Reports Library feature description

#### Methodology Page (`src/pages/Methodology.tsx`)
- ✅ Database description
- ✅ Coverage statistics list

#### Reports Page (`src/pages/Reports.tsx`)
- ✅ Already using dynamic count via `SUSTAINABILITY_REPORTS.length`

## Implementation Details

### Auto-Refresh Mechanism
The `useReportsCount` hook implements a polling-based refresh system:

```typescript
// Default: Auto-refresh every 60 seconds
const { count, formatted } = useReportsCount();

// Custom interval: Refresh every 30 seconds
const { count, formatted } = useReportsCount({ refreshInterval: 30000 });

// Disable auto-refresh
const { count, formatted } = useReportsCount({ autoRefresh: false });

// Static (no polling overhead) 
const { count, formatted } = useReportsCountStatic();
```

### Benefits

1. **Centralized Management**: Single source of truth for report counts
2. **Auto-Refresh**: Components automatically update when data changes
3. **Performance**: Only updates state when count actually changes
4. **Configurable**: Adjustable refresh intervals per component
5. **Backwards Compatible**: Existing code using `SUSTAINABILITY_REPORTS.length` still works

### Current Report Count
The actual count from the data is: **${SUSTAINABILITY_REPORTS.length} reports**

## Testing

To verify the implementation:

1. Run the development server: `npm run dev`
2. Navigate through all pages and verify dynamic counts are displayed
3. Check browser console for any errors
4. Verify counts match the actual data length

## Future Enhancements

1. **Real-time Updates**: Replace polling with WebSocket for instant updates
2. **Loading States**: Add loading indicators during count refreshes
3. **Error Handling**: Implement fallback counts if data fetch fails
4. **Analytics**: Track count changes over time
5. **Cache Invalidation**: Smart cache management for optimal performance

## Migration Notes

If the data source changes from static imports to API calls:
1. Update `getReportsCount()` to fetch from API
2. The auto-refresh mechanism will automatically propagate updates
3. No changes needed in consuming components
