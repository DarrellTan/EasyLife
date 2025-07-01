import { Stack } from 'expo-router';
import { useTheme } from "@/context/ThemeContext";


export default function RecordsStackLayout() {
    const { theme } = useTheme();

    return (
        <Stack
            screenOptions={{
                headerTitle: '',
                headerStyle: {
                    backgroundColor: theme.background,
                    height: 100, // Adjust the height of the header here
                    borderBottomWidth: 0, // ✅ removes border
                    shadowColor: 'transparent', // ✅ removes shadow on iOS
                    elevation: 0, // ✅ removes shadow on Android
                },
                headerShadowVisible: false,
                headerTransparent: false,
                headerShown: true,
            }}
        >
            {/* This is the initial screen for the Reports stack, now called 'index' */}
            <Stack.Screen
                name="index" // Corresponds to app/(public)/(reports_stack)/index.tsx (your ReportHistory)
                options={{
                    title: 'Report History', // Header title for this screen
                }}
            />

            {/* Add other screens that are part of the Reports stack */}
            <Stack.Screen
                name="EditRecords" // Corresponds to app/(public)/(reports_stack)/ReportDetails.tsx
                options={{
                    title: 'Edit Medical Records',
                }}
            />
            {/* ... more report-related screens */}
        </Stack>
    );
}