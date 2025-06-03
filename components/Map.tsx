import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { PROVIDER_DEFAULT, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import CarMarker from "./CarMarker";

const Map = () => {
    const [region, setRegion] = useState<Region | null>(null);

    useEffect(() => {
        const getCurrentLocation = async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.log('Permission to access location was denied');
                return;
            }

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
        };

        getCurrentLocation();
    }, []);

    if (!region) {
        return null; // or a loading spinner
    }

    return (
        <MapView
            provider={PROVIDER_DEFAULT}
            style={styles.map}
            initialRegion={region}
            showsUserLocation
        >
            <CarMarker
                latitude={region.latitude + 100 / 111000}
                longitude={
                    region.longitude + 100 / (111000 * Math.cos(region.latitude * Math.PI / 180))
                }
            />
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
