import { Image, Text, View, SafeAreaView, Pressable, Modal, TextInput, PermissionsAndroid, NativeModules, Platform, DeviceEventEmitter, Alert, NativeEventEmitter } from "react-native";
import { useColorScheme } from "react-native";
import { useState, useEffect, useRef } from "react";
import {router} from "expo-router";
import "../global.css";
import {useTheme} from "@/context/ThemeContext";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MedicalRecordsIcon from "@/components/MedicalRecordsIcon";
import LocationIcon from "@/components/LocationIcon";
import MicIcon from "@/components/MicIcon";
import MapModal from "@/components/MapModal"
import { doc, setDoc, runTransaction, collection, query, where, getDocs, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../FirebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import {Region} from "react-native-maps";
import * as Location from "expo-location";
import { Audio } from 'expo-av';
import { classify } from '@/app/utils/svmClassifier';
import { unloadModel } from '@/app/utils/svmClassifier';
import { useActiveReportContext } from '@/context/ActiveReportContext';
import { useProfilePicContext } from '@/context/ProfilePicContext';




const eventEmitter = new NativeEventEmitter(NativeModules.Vosk);
let isClassifying = false; // Prevents parallel classify() calls
let finalResultSubscription: any = null; // [ADDED]
let subscriptions: any[] = []; // [ADDED]


export default function Home() {
    const { theme } = useTheme();
    const colorScheme = useColorScheme();
    const [activeReportId, setActiveReport] = useActiveReportContext();
    const [profilePicURL, setProfilePicURL] = useProfilePicContext();


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
    // Voice Recognition Modal Close with Cleanup
    const closeVoiceRecognitionModal = async () => {
        setVoiceRecognitionModalVisible(false);
        await stopVoiceRecognition();   // Stop Vosk properly
        await NativeModules.Vosk.unload(); // full cleanup
        unloadModel();  // cleanup SVM ONNX session
        await new Promise(resolve => setTimeout(resolve, 1000)); // delay
        setIsModelLoaded(false); // ensure reload works later
    };

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

    // Feedback Modal
    const [submissionFeedbackModalVisible, setSubmissionFeedbackModalVisible] = useState(false);
    const [submissionFeedbackMessage, setSubmissionFeedbackMessage] = useState("");



    // Report Functions
    const [user, setUser] = useState(null);
    const [userId, setUserId] = useState("");

    const [text, setText] = useState('');

    //Request mic permission for listening
    const requestMicPermission = async () => {
        console.log('Requesting microphone permission...');
        if (Platform.OS === 'android') {
            console.log('Android platform detected, requesting Android permissions');
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
            );
            console.log('Android permission result:', granted);
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                throw new Error('Microphone permission denied');
            }
        } else if (Platform.OS === 'ios') {
            console.log('iOS platform detected, requesting iOS permissions');
            const { status } = await Audio.requestPermissionsAsync();
            console.log('iOS permission status:', status);
            if (status !== 'granted') {
                throw new Error('Microphone permission denied');
            }
        }
        console.log('Microphone permission granted');
        return true;
    };

    const [prediction, setPrediction] = useState('');
    const [transcription, setTranscription] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [isModelBusy, setIsModelBusy] = useState(false);
    const [pendingAction, setPendingAction] = useState<"load" | "start" | null>(null);
    const pendingActionRef = useRef<"load" | "start" | null>(null);


    useEffect(() => {
        pendingActionRef.current = pendingAction;
    }, [pendingAction]);

    useEffect(() => {
        const cleanupListener = eventEmitter.addListener('onCleanup', (msg) => {
            console.log('Native cleanup complete:', msg);
            setIsModelBusy(false);
            // If we were waiting to load/start, continue the chain
            if (pendingActionRef.current === "load") {
                NativeModules.Vosk.loadModel('vosk-model-small-en-us-0.15');
                setPendingAction("start");
            }
        });
        const modelLoadedListener = eventEmitter.addListener('onModelLoaded', (msg) => {
            console.log('Native model loaded:', msg);
            setIsModelLoaded(true);
            if (pendingActionRef.current === "start") {
                NativeModules.Vosk.start({ timeout: 100000000 })
                    .then((result: any) => {
                        console.log('Vosk start result:', result);
                        setIsListening(true);
                        setIsModelBusy(false);
                    })
                    .catch((err: any) => {
                        console.error('Error starting recognition:', err);
                        setIsModelBusy(false);
                        setIsListening(false);
                        Alert.alert('Error', 'Failed to start voice recognition: ' + (err?.message || err));
                    });
                setPendingAction(null);
            }
        });
        const errorSubscription = eventEmitter.addListener('onError', (error: any) => {
            console.error('Vosk error:', error);
            setIsModelBusy(false);
            setIsListening(false);
        });

        const finalResultSubscription = eventEmitter.addListener('onFinalResult', async (result: string) => {
            if (isClassifying) return; // prevent concurrent calls
            isClassifying = true;
            try {
                console.log('Vosk final result:', result);
                setTranscription(result);   // store transcription for UI
                const predicted = await classify(result);   // svm inference
                console.log('SVM Prediction:', predicted);
                setPrediction(predicted);
            } catch (err) {
                console.error('Classification error:', err);
                setPrediction("unknown");
            } finally {
                isClassifying = false;
            }
        });


        const timeoutSubscription = eventEmitter.addListener('onTimeout', () => {
            console.log('Vosk timeout');
            setIsModelBusy(false);
            setIsListening(false);
        });
        // Only remove listeners on unmount, not on every pendingAction change
        return () => {
            errorSubscription.remove();
            finalResultSubscription.remove();
            timeoutSubscription.remove();
            cleanupListener.remove();
            modelLoadedListener.remove();
            if (isModelLoaded) {
                NativeModules.Vosk.unload();
                setIsModelLoaded(false);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    const startVoiceRecognition = async () => {
        if (isModelBusy) {
            console.log('Model is busy, please wait...');
            return;
        }
        setIsModelBusy(true);

        try {
            await requestMicPermission();
            await stopVoiceRecognition(); // [ADDED] ensure previous session stopped
            console.log('Permission check passed');
            // Configure audio for recording BEFORE any model operations
            try {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true,
                    interruptionModeIOS: 1, // DoNotMix
                    interruptionModeAndroid: 1, // DoNotMix
                    shouldDuckAndroid: true,
                });
                console.log('Audio configured successfully');
            } catch (audioError) {
                console.error('Error configuring audio:', audioError);
                setIsModelBusy(false);
                throw new Error('Failed to configure audio session');
            }
            if (isModelLoaded) {
                console.log('Cleaning up previous model instance...');
                try {
                    await NativeModules.Vosk.stop();

                    await NativeModules.Vosk.unload();
                    setIsModelLoaded(false);

                    setPendingAction("load");

                } catch (cleanupError) {
                    console.error('Error during cleanup:', cleanupError);
                    setIsModelBusy(false);
                }

            } else {
                NativeModules.Vosk.loadModel('vosk-model-small-en-us-0.15');
                setPendingAction("start");

            }
        } catch (error: any) {
            console.error('Error in voice recognition:', error);
            setIsModelBusy(false);
            setIsListening(false);
            Alert.alert('Error', 'Failed to start voice recognition: ' + error.message);
            try {
                if (isModelLoaded) {
                    await NativeModules.Vosk.unload();
                    setIsModelLoaded(false);
                }
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    playsInSilentModeIOS: false,
                });
            } catch (cleanupError) {
                console.error('Error during final cleanup:', cleanupError);
            }
        }
    };


    const stopVoiceRecognition = async () => {
        if (isModelBusy) {
            console.log('Model is busy, please wait...');
            return;
        }
        setIsModelBusy(true);
        try {
            if (isListening) {
                const result = await NativeModules.Vosk.stop();
                console.log('result', result);
                setIsListening(false);
                setIsModelBusy(false);
                console.log('Voice recognition stopped');
            }
        } catch (error: any) {
            console.error('Error stopping voice recognition:', error);
            setIsModelBusy(false);
            setIsListening(false);
            Alert.alert('Error', 'Failed to stop voice recognition: ' + error.message);
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
        const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                // @ts-ignore
                setUser(firebaseUser);
                setUserId(firebaseUser.uid);

                const userDocRef = doc(db, "operators", firebaseUser.uid);
                const reportsRef = collection(db, "reports");
                const reportsQuery = query(reportsRef, where("assignmentOperatorIds", "array-contains", firebaseUser.uid));
                console.log(reportsQuery);

                // Fetch profile data once
                const fetchUserData = async () => {
                    try {
                        const userDoc = await getDoc(userDocRef);
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            console.log("userDoc exists");

                            if (userData.profilePicUrl) {
                                setProfilePicURL(userData.profilePicUrl);
                                console.log("Profile Pic Assigned to Context");
                            }
                        }
                    } catch (error) {
                        console.error("❌ Error fetching user data:", error);
                    }
                };

                fetchUserData();

                // Listen to real-time updates on reports
                const unsubscribeReports = onSnapshot(reportsQuery, (querySnapshot) => {
                    console.log("📡 Reports snapshot triggered. Size:", querySnapshot.size);
                    let foundActive = false;

                    querySnapshot.forEach((doc) => {
                        const report = { id: doc.id, ...doc.data() };
                        if (report.status === "Active" && !foundActive) {
                            setActiveReport(report.id);
                            foundActive = true;
                        }
                    });

                    // If no active report found, clear the activeReport
                    if (!foundActive) {
                        setActiveReport(null);
                    }
                });


                // Clean up when component unmounts or auth state changes
                return () => {
                    unsubscribeReports();
                };
            }
        });

        // Cleanup auth listener on unmount
        return () => unsubscribeAuth();
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
        console.log("Submit pressed");
        if (!region) {

        }
        if (!user || !region) return;

        // [SVM INTEGRATION GUARD] Wait until classification is complete
        if (isClassifying) {
            console.log("Waiting for classification to complete...");
            await new Promise(resolve => {
                const interval = setInterval(() => {
                    if (!isClassifying) {
                        clearInterval(interval);
                        resolve(true);
                    }
                }, 100); // poll every 100ms
            });
        }

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
                status: "Active",
            });

            sendReportId(reportId);
            console.log("Report submitted with ID:", reportId);
            setActiveReport(reportId);
            console.log(activeReportId);
            setVoiceRecognitionModalVisible(false);
            setSubmissionFeedbackMessage("Reported Successfully");
            setSubmissionFeedbackModalVisible(true);
        } catch (error) {
            console.error("Error submitting report:", error);
            setVoiceRecognitionModalVisible(false);
            setSubmissionFeedbackMessage("Reported Error \\nPlease Try again\"");
            setSubmissionFeedbackModalVisible(true);
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
                    onPress={() => router.push("/Operators/(reports_stack)")} // Navigate to new screen
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
                                console.log("Holding Down");
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

            {/*Submission Feedback Modal*/}
            <Modal
                visible={submissionFeedbackModalVisible}
                transparent={true}
                animationType="fade">
                <Pressable
                    onPress={() => setSubmissionFeedbackModalVisible(false)}
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
                            {submissionFeedbackMessage}
                        </Text>

                        <Pressable
                            onPress={() => setSubmissionFeedbackModalVisible(false)}
                            style={{
                                marginTop: 12,
                                minWidth: "60%",
                                padding: 10,
                                backgroundColor: '#1E1E1E',
                                borderRadius: 10,
                            }}
                        >
                            <Text className="text-xl" style={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>Close</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>

            {/*<Text className="text-white text-2xl">*/}
            {/*    {activeReportId}, hi {profilePicURL}*/}
            {/*</Text>*/}

            {/*{selectedLocation && (*/}
            {/*    <Text className="text-white text-2xl">*/}
            {/*        {selectedLocation.latitude}, {selectedLocation.longitude}*/}
            {/*        {activeReportId}*/}
            {/*    </Text>*/}
            {/*)}*/}
        </SafeAreaView>
    );
}
