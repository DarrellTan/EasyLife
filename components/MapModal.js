import React, { useState, useEffect } from 'react';
import {
    Modal, View, Text, Pressable, StyleSheet, TextInput, FlatList, TouchableOpacity
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_API_KEY;

const MapModal = ({ visible, onClose, onLocationSelect }) => {
    const [markerCoords, setMarkerCoords] = useState(null);
    const [query, setQuery] = useState('');
    const [predictions, setPredictions] = useState([]);

    const handleMapPress = (event) => {
        const { latitude, longitude } = event.nativeEvent.coordinate;
        setMarkerCoords({ latitude, longitude });
    };

    const confirmLocation = () => {
        if (markerCoords) {
            onLocationSelect(markerCoords);
            onClose();
        }
    };

    // Fetch suggestions from Google Places API
    useEffect(() => {
        const fetchPredictions = async () => {
            if (query.length < 3) {
                setPredictions([]);
                return;
            }
            try {
                const res = await fetch(
                    `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`
                );
                const json = await res.json();
                if (json.predictions) {
                    setPredictions(json.predictions);
                }
            } catch (err) {
                console.error('Error fetching predictions:', err);
            }
        };

        const debounce = setTimeout(fetchPredictions, 300);
        return () => clearTimeout(debounce);
    }, [query]);

    const handlePredictionPress = async (placeId) => {
        try {
            const res = await fetch(
                `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_API_KEY}`
            );
            const json = await res.json();
            const { lat, lng } = json.result.geometry.location;
            setMarkerCoords({ latitude: lat, longitude: lng });
            setQuery(json.result.formatted_address);
            setPredictions([]);
        } catch (err) {
            console.error('Error fetching place details:', err);
        }
    };

    return (
        <Modal visible={visible} animationType="slide">
            <View style={{ flex: 1 }}>
                {/* Search input */}
                <View style={styles.searchContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Search for an address..."
                        value={query}
                        onChangeText={setQuery}
                    />
                    {predictions.length > 0 && (
                        <FlatList
                            data={predictions}
                            keyExtractor={(item) => item.place_id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.suggestionItem}
                                    onPress={() => handlePredictionPress(item.place_id)}
                                >
                                    <Text>{item.description}</Text>
                                </TouchableOpacity>
                            )}
                            style={styles.suggestionsList}
                        />
                    )}
                </View>

                <MapView
                    style={{ flex: 1 }}
                    onPress={handleMapPress}
                    region={
                        markerCoords
                            ? {
                                latitude: markerCoords.latitude,
                                longitude: markerCoords.longitude,
                                latitudeDelta: 0.01,
                                longitudeDelta: 0.01,
                            }
                            : {
                                latitude: 3.139,
                                longitude: 101.6869,
                                latitudeDelta: 0.01,
                                longitudeDelta: 0.01,
                            }
                    }
                >
                    {markerCoords && <Marker coordinate={markerCoords} />}
                </MapView>

                <View style={styles.bottomBar}>
                    <Pressable onPress={onClose} style={styles.button}>
                        <Text style={styles.buttonText}>Cancel</Text>
                    </Pressable>
                    <Pressable onPress={confirmLocation} style={styles.button}>
                        <Text style={styles.buttonText}>Confirm</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    searchContainer: {
        position: 'absolute',
        top: 40,
        left: 10,
        right: 10,
        zIndex: 1,
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 10,
        elevation: 5,
    },
    input: {
        height: 40,
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
    },
    suggestionsList: {
        marginTop: 10,
        maxHeight: 150,
    },
    suggestionItem: {
        paddingVertical: 8,
        borderBottomColor: '#ddd',
        borderBottomWidth: 1,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 30,
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    button: {
        backgroundColor: '#333',
        padding: 12,
        borderRadius: 8,
    },
    buttonText: {
        color: 'white',
    },
});

export default MapModal;
