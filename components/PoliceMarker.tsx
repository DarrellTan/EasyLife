import React from 'react';
import { Marker } from 'react-native-maps';
import { Image } from 'react-native';

type CarMarkerProps = {
    latitude: number;
    longitude: number;
};

const PoliceMarker = ({ latitude, longitude }: CarMarkerProps) => {
    return (
        <Marker coordinate={{ latitude, longitude }}>
            <Image
                source={require('@/assets/images/Police.png')}
                style={{ width: 40, height: 40 }}
                resizeMode="contain"
            />
        </Marker>
    );
};

export default PoliceMarker;
