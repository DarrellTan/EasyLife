import { getDatabase, ref, set } from 'firebase/database';

export async function updateLocation(reportId, userId, lat, lng) {
    const db = getDatabase();
    const locationRef = ref(db, `reports/${reportId}/locations/${userId}`);
    await set(locationRef, {
        latitude: lat,
        longitude: lng,
        timestamp: Date.now(),
    });
}