// locationTask.js
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { getAuth } from 'firebase/auth';
import { updateLocation } from '../utils/firebaseUtils'; // create this next
import { getActiveReportId } from '../utils/reportHelpers'; // create this too

export const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
        console.error('❌ Background task error:', error);
        return;
    }

    if (data) {
        const { locations } = data;
        const location = locations[0];

        const auth = getAuth();
        const user = auth.currentUser;

        if (user && location) {
            const reportId = await getActiveReportId(user.uid);
            if (reportId) {
                await updateLocation(reportId, user.uid, location.coords.latitude, location.coords.longitude);
            }
        }
    }
});
