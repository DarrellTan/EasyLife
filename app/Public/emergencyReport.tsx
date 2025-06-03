import { View, Text, Pressable, Button, Platform, PermissionsAndroid, Alert } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { useEffect, useState, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, runTransaction } from "firebase/firestore";
import { auth, db } from "../../FirebaseConfig";
import {Region} from "react-native-maps";
import * as Location from "expo-location"; // use your config here
import Vosk from 'react-native-vosk';
import * as FileSystem from 'expo-file-system';
import * as Audio from 'expo-av';

export default function emergencyReport() {
    const { theme } = useTheme();
    const [user, setUser] = useState(null);
    const [userId, setUserId] = useState("");
    const [text, setText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [recognizer, setRecognizer] = useState(null);
    const [transcript, setTranscript] = useState('');

    // Initialize Vosk
    useEffect(() => {
        const initVosk = async () => {
            try {
                await Vosk.initModel('model');
                const newRecognizer = await Vosk.createRecognizer();
                setRecognizer(newRecognizer);
                console.log('Vosk initialized successfully');
            } catch (error) {
                console.error('Error initializing Vosk:', error);
            }
        };

        initVosk();

        // Cleanup
        return () => {
            if (recognizer) {
                Vosk.destroyRecognizer(recognizer);
            }
        };
    }, []);

    //Request mic permission for listening
    const requestMicPermission = async () => {
      try {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            {
              title: "Microphone Permission",
              message: "App needs access to your microphone for voice recognition",
              buttonNeutral: "Ask Me Later",
              buttonNegative: "Cancel",
              buttonPositive: "OK"
            }
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert(
              "Permission Required",
              "Microphone permission is required for voice recognition",
              [{ text: "OK" }]
            );
            return false;
          }
        } else if (Platform.OS === 'ios') {
          const { status } = await Audio.requestPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert(
              "Permission Required",
              "Microphone permission is required for voice recognition",
              [{ text: "OK" }]
            );
            return false;
          }
        }
        return true;
      } catch (error) {
        console.error('Error requesting microphone permission:', error);
        Alert.alert(
          "Error",
          "Failed to request microphone permission",
          [{ text: "OK" }]
        );
        return false;
      }
    };

    const startVoiceRecognition = async () => {
      const hasPermission = await requestMicPermission();
      if (!hasPermission) {
        console.log('Microphone permission not granted');
        return;
      }

      if (!recognizer) {
        console.log('Recognizer not initialized');
        return;
      }

      try {
        await Vosk.startListening(recognizer);
        setIsListening(true);
        console.log('Started listening');
      } catch (error) {
        console.error('Error starting voice recognition:', error);
        Alert.alert(
          "Error",
          "Failed to start voice recognition",
          [{ text: "OK" }]
        );
      }
    };

    const stopVoiceRecognition = async () => {
      if (!recognizer) return;

      try {
        const result = await Vosk.stopListening(recognizer);
        setIsListening(false);
        console.log('Stopped listening');
        
        // Parse the result and update transcript
        if (result) {
          const parsedResult = JSON.parse(String(result));
          const newTranscript = parsedResult.text || '';
          setTranscript((prev: string) => prev + ' ' + newTranscript);
          await saveTranscript(newTranscript);
        }
      } catch (error) {
        console.error('Error stopping voice recognition:', error);
      }
    };

    const saveTranscript = async (text: string) => {
      try {
        const fileName = 'transcript.txt';
        const filePath = `${FileSystem.documentDirectory}${fileName}`;
        
        // Read existing content if file exists
        let existingContent = '';
        try {
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          if (fileInfo.exists) {
            existingContent = await FileSystem.readAsStringAsync(filePath);
          }
        } catch (error) {
          console.log('No existing transcript file');
        }

        // new content
        const newContent = existingContent ? `${existingContent}\n${text}` : text;
        await FileSystem.writeAsStringAsync(filePath, newContent);
        console.log('Transcript saved successfully');
      } catch (error) {
        console.error('Error saving transcript:', error);
      }
    };

    const showTranscript = async () => {
      try {
        const fileName = 'transcript.txt';
        const filePath = `${FileSystem.documentDirectory}${fileName}`;
        
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        if (fileInfo.exists) {
          const content = await FileSystem.readAsStringAsync(filePath);
          Alert.alert("Transcript", content);
        } else {
          Alert.alert("Transcript", "No transcript available");
        }
      } catch (error) {
        console.error('Error reading transcript:', error);
        Alert.alert("Error", "Failed to read transcript");
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
                location: {
                    latitude: region.latitude,
                    longitude: region.longitude,
                },
                classification: [],
                transcribedText: "Test",  // Default value
                status: "Complete",           // Default value
            });

            sendReportId(reportId);
            console.log("Report submitted with ID:", reportId);

        } catch (error) {
            console.error("Error submitting report:", error);
        }
    };

    return (
        <View className="flex-1 justify-center items-center px-4" style={{ backgroundColor: theme.background }}>
            <Text className="text-xl font-bold mb-2" style={{ color : theme.text }}>Report Emergency</Text>
            <Text className="text-l mb-2" style={{ color : theme.text }}>User Id = {userId} </Text>

            <Text className="text-xl font-bold mb-2" style={{ color : theme.text }}>{text}</Text>

            <Pressable 
                onPressIn={startVoiceRecognition}
                onPressOut={stopVoiceRecognition}
                className="bg-blue-600 px-4 py-2 rounded mt-2 mb-2"
            >
                <Text className="text-white font-semibold">
                    {isListening ? 'Release to Stop' : 'Hold to Record'}
                </Text>
            </Pressable>

            <Button title="Show Transcript" onPress={showTranscript} />

            <Pressable onPress={handleSubmit} className="bg-red-600 px-4 py-2 rounded mt-2">
                <Text className="text-white font-semibold">Submit Report</Text>
            </Pressable>
        </View>
    );
}
