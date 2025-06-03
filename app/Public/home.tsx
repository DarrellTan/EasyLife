import { Image, Text, View, SafeAreaView, Pressable, Modal, TextInput, PermissionsAndroid, NativeModules, Platform, DeviceEventEmitter } from "react-native";
import { useColorScheme } from "react-native";
import { useState, useEffect } from "react";
import {router} from "expo-router";
import "../global.css";
import {useTheme} from "@/context/ThemeContext";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MedicalRecordsIcon from "@/components/MedicalRecordsIcon";
import LocationIcon from "@/components/LocationIcon";
import MicIcon from "@/components/MicIcon";
import MapModal from "@/components/MapModal"
import { doc, setDoc, runTransaction } from "firebase/firestore";
import { auth, db } from "../../FirebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import {Region} from "react-native-maps";
import * as Location from "expo-location"; // use your config here


export default function Home() {
    const { theme } = useTheme();
    const colorScheme = useColorScheme();
    const insets = useSafeAreaInsets();

    // Report Model Use State
    const [reportModalVisible, setReportModalVisible] = useState(false);
    const openReportModal = () => setReportModalVisible(true);
    const closeReportModal = () => setReportModalVisible(false);

    // Voice Recognition Model Use State
    const [reportFor, setReportFor] = useState("");
    const [voiceRecognitionModalVisible, setVoiceRecognitionModalVisible] = useState(false);
    const reportForMyself = () => {
        requestMicPermission();
        setReportFor("Myself");
        setReportModalVisible(false);
        setVoiceRecognitionModalVisible(true);
    }
    const closeVoiceRecognitionModal = () => setVoiceRecognitionModalVisible(false);

    // Select Location Message Modal
    const [selectLocationMessageModalVisible, setSelectLocationMessageModalVisible] = useState(false);
    const reportForOthers = () => {
        requestMicPermission();
        setReportFor("Others");
        setReportModalVisible(false);
        setSelectLocationMessageModalVisible(true)
    }

    // Pick Location Modal
    const [locationModalVisible, setLocationModalVisible] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const confirmSelectLocation = () => {
        setSelectLocationMessageModalVisible(false);
        setLocationModalVisible(true);
    }
    const handleSelectLocation = (coords:any) => {
        setSelectedLocation(coords);
        setLocationModalVisible(false);
        setLocationDetailsModalVisible(true);
    }

    // Submit Report Modal
    const [locationDetailsModalVisible, setLocationDetailsModalVisible] = useState(false);
    const [locationDetails, setLocationDetails] = useState("");
    const voiceReportForOthers = () => {
        setLocationDetailsModalVisible(false);
        setVoiceRecognitionModalVisible(true);
    }


    // Report Functions
    const [user, setUser] = useState(null);
    const [userId, setUserId] = useState("");

    const [text, setText] = useState('');

    //Request mic permission for listening
    const requestMicPermission = async () => {
        if (Platform.OS === 'android') {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
            );
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                console.warn('Microphone permission denied');
            }
        }
    };

    //Call speech-to-text, (not yet) connect to button
    const { VoskModule } = NativeModules;
    const startVoiceRecognition = () => {
        if (VoskModule && VoskModule.startListening) {
            VoskModule.startListening();
        } else {
            console.warn('VoskModule is not available');
        }
    };

    // where we receives the label and transcription text from android
    const [prediction, setPrediction] = useState('');
    const [transcription, setTranscription] = useState('');
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('onPrediction', (data: { label: string, transcription: string }) => {
            console.log('Predicted category of the case:', data.label);
            console.log('Transcription:', data.transcription);
            setPrediction(data.label);
            setTranscription(data.transcription);
        });

        return () => subscription.remove();
    }, []);


//  This is a Stop-listening function, (yet) connect to button
    const stopVoiceRecognition = () => {
      if (VoskModule?.stopListening) {
        VoskModule.stopListening();
      }
    };

    useEffect(() => {
        fetch('https://easylife-express-production.up.railway.app/')  // Replace with your URL
            .then(response => response.text())  // Get response as text
            .then(data => {
                setText(data);
            })
            .catch(err => {
                setText('Error fetching data');
            });
    }, []);

    const sendReportId = async (reportId:number) => {
        try {
            const response = await fetch('https://easylife-express-production.up.railway.app/report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',  // Tell server we are sending JSON
                },
                body: JSON.stringify({ reportId }),    // Send the reportId variable
            });

            const data = await response.json();
            console.log('Response from server:', data);
        } catch (error) {
            console.error('Error sending report:', error);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // @ts-ignore
                setUser(firebaseUser);
                setUserId(firebaseUser.uid);
            }
        });

        return () => unsubscribe();
    }, []);

    // Code to get Geolocation

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

    const handleSubmit = async () => {
        if (!user || !region) return;

        try {
            const counterRef = doc(db, "counters", "reportsCounter");

            const reportId = await runTransaction(db, async (transaction) => {
                const counterSnap = await transaction.get(counterRef);
                const current = counterSnap.exists() ? counterSnap.data().current : 0;
                const nextId = current + 1;

                transaction.set(counterRef, { current: nextId }, { merge: true });
                return nextId;
            });

            const reportRef = doc(db, "reports", reportId.toString());

            await setDoc(reportRef, {
                reportId: reportId,
                userId: userId,
                date: new Date().toISOString(),  // Store the date as a string datetime
                location: reportFor === "Others"
                    ? {
                        latitude: selectedLocation.latitude,
                        longitude: selectedLocation.longitude,
                    }
                    : {
                        latitude: region.latitude,
                        longitude: region.longitude,
                    },
                reportFor: reportFor,
                classification: [prediction || "unknown"], // autio fill in the prediction
                transcribedText: transcription || "N/A",  // autio fill in the transcription
                status: "Complete",
            });

            sendReportId(reportId);
            console.log("Report submitted with ID:", reportId);
            setVoiceRecognitionModalVisible(false);

        } catch (error) {
            console.error("Error submitting report:", error);
            setVoiceRecognitionModalVisible(false);
        }
    };


    // @ts-ignore
    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: theme.background }}>
            <View className="justify-center items-center" style={{ paddingTop: insets.top }}>
                {/* Custom Button */}
                <Pressable
                    onPress={openReportModal} // Navigate to new screen
                    className="bg-emergency justify-center items-center"
                    style={{
                        width: 360,
                        height: 154,
                        borderRadius: 54,
                    }}
                >
                    <Text className="text-white text-lg font-bold">EMERGENCY</Text>
                </Pressable>
            </View>
            <View className="flex-row justify-center items-center gap-x-7 mt-4">
                <Pressable
                    onPress={() => router.push("/Public/ProfilePage")} // Navigate to new screen
                    className="bg-medical-records justify-center items-center"
                    style={{
                        width: 160,
                        height: 160,
                        borderRadius: 35,
                    }}
                >
                    <MedicalRecordsIcon size={99}/>
                </Pressable>

                <Pressable
                    onPress={() => router.push("/Public/MapViewer")} // Navigate to new screen
                    className="bg-location justify-center items-center"
                    style={{
                        width: 160,
                        height: 160,
                        borderRadius: 35,
                    }}
                >
                    <LocationIcon size={99}/>
                </Pressable>
            </View>

            <View className="justify-center items-center mt-4">
                {/* Custom Button */}
                <Pressable
                    onPress={() => router.push("/EnterUserDetails")} // Navigate to new screen
                    className="bg-reports justify-center items-center"
                    style={{
                        width: 360,
                        height: 154,
                        borderRadius: 54,
                    }}
                >
                    <Text className="text-black text-lg font-bold">REPORTS</Text>
                </Pressable>
            </View>

            {/* Report Modal Component */}
            <Modal
                visible={reportModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={closeReportModal}
            >
                <Pressable
                    onPress={closeReportModal}
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <Pressable
                        onPress={(e) => e.stopPropagation()}
                        style={{
                            width: 300,
                            padding: 20,
                            backgroundColor: 'white',
                            borderRadius: 20,
                            alignItems: 'center',
                            elevation: 5,
                        }}
                    >
                        <Text
                            className="text-3xl"
                            style={{
                                fontWeight: 'bold',
                                marginBottom: 10,
                                textAlign: 'center',
                            }}
                        >
                            Who are you reporting for?
                        </Text>
                        <Pressable
                            onPress={reportForMyself}
                            style={{
                                marginTop: 12,
                                minWidth: "60%",
                                padding: 10,
                                backgroundColor: '#1E1E1E',
                                borderRadius: 10,
                            }}
                        >
                            <Text className="text-xl" style={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>For myself</Text>
                        </Pressable>

                        <Pressable
                            onPress={reportForOthers}
                            style={{
                                marginTop: 12,
                                minWidth: "60%",
                                padding: 10,
                                backgroundColor: '#1E1E1E',
                                borderRadius: 10,
                            }}
                        >
                            <Text className="text-xl" style={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>For others</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Voice Recognition Modal Component */}
            <Modal
                visible={voiceRecognitionModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={closeVoiceRecognitionModal}
            >
                <Pressable
                    onPress={closeVoiceRecognitionModal}
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <Pressable
                        onPress={(e) => e.stopPropagation()}
                        style={{
                            width: 300,
                            padding: 20,
                            backgroundColor: 'white',
                            borderRadius: 20,
                            alignItems: 'center',
                            elevation: 5,
                        }}
                    >
                        <Pressable
                            onPressIn={() => {
                                console.log("Hodling Down");
                                startVoiceRecognition();
                            }}
                            onPressOut={() => {
                                console.log("Released");
                                stopVoiceRecognition();
                            }}
                            style={{
                                marginTop: 12,
                                padding: 10,
                                backgroundColor: '#d3d3d3',
                                borderRadius: 30.5,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                           <MicIcon />
                        </Pressable>

                        <Text className="text-2xl mt-4" style={{ color: theme.opposite, fontWeight: 'bold', textAlign: 'center' }}>
                            Describe your emergency
                        </Text>

                        <Text className="text-xl" style={{ color: theme.opposite, textAlign: 'center' }}>
                            Hold the icon and speak
                        </Text>

                        <Pressable
                            onPress={handleSubmit}
                            style={{
                                marginTop: 12,
                                minWidth: "60%",
                                padding: 10,
                                backgroundColor: '#E93838',
                                borderRadius: 10,
                            }}
                        >
                            <Text className="text-xl" style={{ color: theme.text, fontWeight: 'bold', textAlign: 'center' }}>Submit Report</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>

            {/*Select Your Location Modal */}
            <Modal
                visible={selectLocationMessageModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSelectLocationMessageModalVisible(false)}
            >
                <Pressable
                    onPress={closeReportModal}
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <Pressable
                        onPress={(e) => e.stopPropagation()}
                        style={{
                            width: 300,
                            padding: 20,
                            backgroundColor: 'white',
                            borderRadius: 20,
                            alignItems: 'center',
                            elevation: 5,
                        }}
                    >
                        <Text
                            className="text-3xl"
                            style={{
                                fontWeight: 'bold',
                                marginBottom: 10,
                                textAlign: 'center',
                            }}
                        >
                            Select Emergency Location
                        </Text>

                        <Pressable
                            onPress={confirmSelectLocation}
                            style={{
                                marginTop: 12,
                                minWidth: "60%",
                                padding: 10,
                                backgroundColor: '#1E1E1E',
                                borderRadius: 10,
                            }}
                        >
                            <Text className="text-xl" style={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>Open Map</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>

            {/*Location Modal*/}
            <MapModal
                visible={locationModalVisible}
                onClose={() => setLocationModalVisible(false)}
                onLocationSelect={handleSelectLocation}
            />

            {/*Submit Report Modal*/}
            <Modal
            visible={locationDetailsModalVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setLocationDetailsModalVisible(false)}
            >
                <Pressable
                    onPress={() => setLocationDetailsModalVisible(false)}
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <Pressable
                        onPress={(e) => e.stopPropagation()}
                        style={{
                            width: 300,
                            padding: 20,
                            backgroundColor: 'white',
                            borderRadius: 20,
                            alignItems: 'center',
                            elevation: 5,
                        }}
                    >
                        <Text
                            className="text-3xl"
                            style={{
                                fontWeight: 'bold',
                                marginBottom: 10,
                                textAlign: 'center',
                            }}
                        >
                            Enter Location Details
                        </Text>

                        <TextInput
                            className="w-72 bg-neutral-100 text-black border border-black px-4 py-2 rounded-lg text-base"
                            placeholder="Example: Unit No, Floor"
                            placeholderTextColor="#555"
                            value={locationDetails}
                            onChangeText={setLocationDetails}
                            multiline
                            textAlignVertical="top"
                        />

                        <Pressable
                            onPress={voiceReportForOthers}
                            style={{
                                marginTop: 12,
                                minWidth: "60%",
                                padding: 10,
                                backgroundColor: '#E93838',
                                borderRadius: 10,
                            }}
                        >
                            <Text className="text-xl" style={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>Report</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>

            {selectedLocation && (
                <Text className="text-white text-2xl">
                    {selectedLocation.latitude}, {selectedLocation.longitude}
                </Text>
            )}
        </SafeAreaView>
    );
}
