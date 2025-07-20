import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { PROVIDER_DEFAULT, Region, Polyline } from 'react-native-maps';
import { onSnapshot, doc } from 'firebase/firestore';
import { auth, db, rtdb } from '@/FirebaseConfig';
import * as Location from 'expo-location';
import { onAuthStateChanged } from 'firebase/auth';
// @ts-ignore
import polyline from '@mapbox/polyline';
import HospitalMarker from './HospitalMarker';
import PoliceMarker from './PoliceMarker';
import FireMarker from './FireMarker';
import { ref, onValue } from 'firebase/database';
import { useActiveReportContext } from '@/context/ActiveReportContext';

const Map = () => {
    const [userId, setUserId] = useState<string | null>(null);
    const [region, setRegion] = useState<Region | null>(null);
    const [carPosition, setCarPosition] = useState<{ latitude: number; longitude: number } | null>(null);
    const [policePosition, setPolicePosition] = useState<{ latitude: number; longitude: number } | null>(null);
    const [firePosition, setFirePosition] = useState<{ latitude: number; longitude: number } | null>(null);

    const [hospitalRouteCoords, setHospitalRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
    const [policeRouteCoords, setPoliceRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
    const [fireRouteCoords, setFireRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);

    const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_API_KEY;
    const [activeReportIdFromContext] = useActiveReportContext(); // Renamed to clarify origin

    // Effect for user authentication state (unchanged)
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                setUserId(firebaseUser.uid);
            } else {
                setUserId(null);
            }
        });
        return () => unsubscribe();
    }, []);

    // Effect for initial current location (unchanged)
    useEffect(() => {
        const getCurrentLocation = async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.warn('Permission to access location was denied');
                return;
            }
            try {
                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.High,
                });
                const { latitude, longitude } = location.coords;
                setRegion({
                    latitude,
                    longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                });
            } catch (error) {
                console.error("Error getting current location:", error);
            }
        };
        getCurrentLocation();
    }, []);

    // Main effect for active report and real-time listeners
    useEffect(() => {
        // Force activeReportId to be a string
        const activeReportId = activeReportIdFromContext != null ? String(activeReportIdFromContext) : null;

        if (!activeReportId || activeReportId.trim() === '') { // Also check for empty string after coercion
            console.log("Map Component: Coerced activeReportId is null or empty, returning. Value:", activeReportIdFromContext);
            // Clear any previous map data when no active report
            setCarPosition(null);
            setPolicePosition(null);
            setFirePosition(null);
            setHospitalRouteCoords([]);
            setPoliceRouteCoords([]);
            setFireRouteCoords([]);
            return;
        }

        console.log("Map Component: Listener activated for activeReportId:", activeReportId);

        let unsubFirestore: (() => void) | null = null;
        let unsubHospitalRTDB: (() => void) | null = null;
        let unsubPoliceRTDB: (() => void) | null = null;
        let unsubFireRTDB: (() => void) | null = null;

        const reportsRef = doc(db, "reports", activeReportId); // Use the coerced string here

        unsubFirestore = onSnapshot(reportsRef, async (reportDoc) => {
            console.log("Map Component: Firestore onSnapshot callback fired.");

            if (unsubHospitalRTDB) { unsubHospitalRTDB(); unsubHospitalRTDB = null; }
            if (unsubPoliceRTDB) { unsubPoliceRTDB(); unsubPoliceRTDB = null; }
            if (unsubFireRTDB) { unsubFireRTDB(); unsubFireRTDB = null; }

            if (!reportDoc.exists()) {
                console.warn("Map Component: No such report with ID or report deleted:", activeReportId);
                setCarPosition(null);
                setPolicePosition(null);
                setFirePosition(null);
                setHospitalRouteCoords([]);
                setPoliceRouteCoords([]);
                setFireRouteCoords([]);
                return;
            }

            const reportData = reportDoc.data();
            console.log("Map Component: Initial/Updated report data from Firestore:", reportData);

            let userCoords: { latitude: number; longitude: number };

            try {
                if (reportData.reportFor === "Myself") {
                    const location = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.High,
                    });
                    userCoords = {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                    };
                    console.log("Map Component: UserCoords (Myself):", userCoords);
                } else if (reportData.reportFor === "Others" && reportData.location && typeof reportData.location.latitude === 'number' && typeof reportData.location.longitude === 'number') {
                    userCoords = {
                        latitude: reportData.location.latitude,
                        longitude: reportData.location.longitude,
                    };
                    console.log("Map Component: UserCoords (Others):", userCoords);
                } else {
                    console.warn("Map Component: Invalid report data location or reportFor type.", reportData);
                    setCarPosition(null); setPolicePosition(null); setFirePosition(null);
                    setHospitalRouteCoords([]); setPoliceRouteCoords([]); setFireRouteCoords([]);
                    return;
                }
            } catch (locationError) {
                console.error("Map Component: Error getting user location for routing:", locationError);
                setCarPosition(null); setPolicePosition(null); setFirePosition(null);
                setHospitalRouteCoords([]); setPoliceRouteCoords([]); setFireRouteCoords([]);
                return;
            }

            const setupRealtimeListener = (
                path: string,
                setPosition: (pos: { latitude: number; longitude: number } | null) => void,
                setRoute: (coords: { latitude: number; longitude: number }[]) => void
            ) => {
                if (!path || typeof path !== 'string') {
                    console.error("Map Component: Invalid path for RTDB listener:", path);
                    return () => {};
                }
                const refPath = ref(rtdb, `reports/${activeReportId}/${path}`); // Use the coerced string here
                console.log(`Map Component: Setting up Realtime DB listener for path: ${refPath.toString()}`);

                return onValue(refPath, async (snapshot) => {
                    const data = snapshot.val();
                    console.log(`Map Component: Realtime DB data for ${path}:`, data);

                    if (typeof data?.latitude === 'number' && typeof data?.longitude === 'number') {
                        const operatorCoords = {
                            latitude: data.latitude,
                            longitude: data.longitude,
                        };
                        setPosition(operatorCoords);
                        if (userCoords.latitude !== undefined && userCoords.longitude !== undefined) {
                            const route = await getRoute(operatorCoords, userCoords);
                            setRoute(route);
                        } else {
                            console.warn("Map Component: userCoords are invalid for route calculation.");
                            setRoute([]);
                        }
                    } else {
                        console.warn(`Map Component: Invalid geolocation data for ${path}, clearing marker/route. Data:`, data);
                        setPosition(null);
                        setRoute([]);
                    }
                }, (error) => {
                    console.error(`Map Component: Error with Realtime DB listener for ${path}:`, error);
                    setPosition(null);
                    setRoute([]);
                });
            };

            unsubHospitalRTDB = setupRealtimeListener('hospitalGeolocation', setCarPosition, setHospitalRouteCoords);
            unsubPoliceRTDB = setupRealtimeListener('policeGeolocation', setPolicePosition, setPoliceRouteCoords);
            unsubFireRTDB = setupRealtimeListener('fireGeolocation', setFirePosition, setFireRouteCoords);

        }, (error) => {
            console.error("Map Component: Error with Firestore onSnapshot for report:", error);
            setCarPosition(null);
            setPolicePosition(null);
            setFirePosition(null);
            setHospitalRouteCoords([]);
            setPoliceRouteCoords([]);
            setFireRouteCoords([]);
        });

        return () => {
            console.log("Map Component: Cleaning up all listeners for activeReportId:", activeReportId);
            if (unsubFirestore) unsubFirestore();
            if (unsubHospitalRTDB) unsubHospitalRTDB();
            if (unsubPoliceRTDB) unsubPoliceRTDB();
            if (unsubFireRTDB) unsubFireRTDB();
        };
    }, [activeReportIdFromContext]); // Dependency is the raw value from context

    const getRoute = async (
        start: { latitude: number; longitude: number },
        end: { latitude: number; longitude: number }
    ): Promise<{ latitude: number; longitude: number }[]> => {
        if (!start || !end || typeof start.latitude !== 'number' || typeof start.longitude !== 'number' || typeof end.latitude !== 'number' || typeof end.longitude !== 'number') {
            console.warn("Map Component: Invalid start or end coordinates for getRoute. Start:", start, "End:", end);
            return [];
        }

        try {
            const origin = `${start.latitude},${start.longitude}`;
            const destination = `${end.latitude},${end.longitude}`;

            const response = await fetch(
                `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_API_KEY}`
            );
            const data = await response.json();
            console.log("Map Component: Google Directions API response:", data);

            if (data.routes && data.routes.length > 0 && data.routes[0].overview_polyline && typeof data.routes[0].overview_polyline.points === 'string') {
                const pointsString = data.routes[0].overview_polyline.points;
                const points = polyline.decode(pointsString);
                return points.map(([lat, lng]: [number, number]) => ({
                    latitude: lat,
                    longitude: lng,
                }));
            } else {
                console.warn('Map Component: No route found or missing/invalid polyline data in API response.', data);
                return [];
            }
        } catch (error) {
            console.error('Map Component: Error fetching route from Google Directions API:', error);
            return [];
        }
    };

    if (!region) return null;

    return (
        <MapView
            provider={PROVIDER_DEFAULT}
            style={styles.map}
            region={region}
            showsUserLocation
            onRegionChangeComplete={setRegion}
        >
            {carPosition && (
                <HospitalMarker
                    latitude={carPosition.latitude}
                    longitude={carPosition.longitude}
                />
            )}
            {policePosition && (
                <PoliceMarker
                    latitude={policePosition.latitude}
                    longitude={policePosition.longitude}
                />
            )}
            {firePosition && (
                <FireMarker
                    latitude={firePosition.latitude}
                    longitude={firePosition.longitude}
                />
            )}

            {hospitalRouteCoords.length > 0 && (
                <Polyline
                    coordinates={hospitalRouteCoords}
                    strokeColor="red"
                    strokeWidth={4}
                />
            )}
            {policeRouteCoords.length > 0 && (
                <Polyline
                    coordinates={policeRouteCoords}
                    strokeColor="blue"
                    strokeWidth={4}
                />
            )}
            {fireRouteCoords.length > 0 && (
                <Polyline
                    coordinates={fireRouteCoords}
                    strokeColor="orange"
                    strokeWidth={4}
                />
            )}
        </MapView>
    );
};

const styles = StyleSheet.create({
    map: {
        width: '100%',
        height: '80%',
        borderRadius: 16,
        overflow: 'hidden',
    },
});

export default Map;