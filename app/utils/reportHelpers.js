// app/utils/reportHelpers.js
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

export async function getActiveReportId(userId) {
    const db = getFirestore();
    const reportsRef = collection(db, 'reports');

    // Query for reports where user is involved and status is "Active"
    const q = query(
        reportsRef,
        where('participants', 'array-contains', userId),
        where('status', '==', 'Active')
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
        return snapshot.docs[0].id; // return the first matching report
    }

    return null;
}
