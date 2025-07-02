import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, TouchableOpacity, Image, Text, Pressable } from "react-native";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/context/ThemeContext";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, rtdb } from "@/FirebaseConfig";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import SideMenu from '@/components/SideMenu';
import { Portal } from 'react-native-paper';
import MedicalRecordsIcon from "@/components/MedicalRecordsIcon"
import LocationIcon from "@/components/LocationIcon";
import { ref, set } from "firebase/database";
import { useActiveReportContext } from '@/context/ActiveReportContext';
import * as Location from 'expo-location';



export default function Layout() {
    const [menuVisible, setMenuVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const { theme } = useTheme();
    const [activeReportId, setActiveReport] = useActiveReportContext();
    const locationData = useRef<any>(null);
    const [type, setType] = useState();

    const uploadGeolocation = (userId: string, locationData: any) => {
        const locationRef = ref(rtdb, `reports/${activeReportId}/${type}Geolocation`);
        return set(locationRef, locationData)
            .then(() => {
                console.log(`📍 ${type} location uploaded:`, locationData);
            })
            .catch((error) => {
                console.error("❌ Error uploading location:", error);
            });
    };

    // Simulate location updates
    useEffect(() => {
        let locationInterval: any;

        const startRealLocationTracking = async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.warn('❌ Location permission not granted');
                return;
            }

            // Immediately get current location
            const location = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;

            const newLocation = {
                latitude,
                longitude,
                timestamp: Date.now(),
            };

            locationData.current = newLocation;

            if (auth.currentUser && activeReportId) {
                uploadGeolocation(auth.currentUser.uid, newLocation);
            }

            // Set up interval to get location every 5 seconds
            locationInterval = setInterval(async () => {
                const location = await Location.getCurrentPositionAsync({});
                const { latitude, longitude } = location.coords;

                const updatedLocation = {
                    latitude,
                    longitude,
                    timestamp: Date.now(),
                };

                locationData.current = updatedLocation;

                if (auth.currentUser && activeReportId) {
                    uploadGeolocation(auth.currentUser.uid, updatedLocation);
                }
            }, 5000);
        };

        startRealLocationTracking();

        return () => {
            if (locationInterval) {
                clearInterval(locationInterval);
            }
        };
    }, [activeReportId]);

    useEffect(() => {
        if (!activeReportId) return;

        const user = auth.currentUser;
        if (!user || !locationData) return;

        console.log("🚀 Uploading updated operator location:", locationData);
        uploadGeolocation(user.uid, locationData);
    }, [locationData, activeReportId]);

    useEffect(() => {
        // @ts-ignore
        let unsubscribeFromUserDoc = null;

        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                const userDocRef = doc(db, "operators", firebaseUser.uid);


                // Subscribe to realtime updates of the user doc
                unsubscribeFromUserDoc = onSnapshot(userDocRef, (userDoc) => {
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setStatus(userData.status);
                        setType(userData.type);
                        console.log(type);
                        if (userData.profilePicUrl) {
                            setSelectedImage(userData.profilePicUrl);
                        } else {
                            setSelectedImage(null); // Clear if no profilePicUrl
                        }
                    }
                });
            } else {
                // User logged out - clear the image and unsubscribe from doc listener
                setSelectedImage(null);
                // @ts-ignore
                if (unsubscribeFromUserDoc) {
                    unsubscribeFromUserDoc();
                    unsubscribeFromUserDoc = null;
                }
            }
        });

        // Cleanup both listeners on unmount
        return () => {
            unsubscribe();
            // @ts-ignore
            if (unsubscribeFromUserDoc) {
                unsubscribeFromUserDoc();
            }
        };
    }, []);

    // @ts-ignore
    function ProfileTabIcon({ color, size }) {
        return selectedImage ? (
            <Image
                source={{ uri: selectedImage }}
                style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                }}
            />
        ) : (
            <Ionicons name="person-outline" size={size} color={color} />
        );
    }


    const HeaderLeft = () => (
        <TouchableOpacity onPress={() => console.log("Settings Pressed")}>
            <Image
                source={require("../../assets/images/EasyLife-logo.png")} // Update path if needed
                style={{
                    width: 190,
                    height: 190,
                    resizeMode: 'contain',
                    marginLeft: 15,
                }}
            />
        </TouchableOpacity>
    );

    const handleStatusChange = async () => {
        const user = auth.currentUser;

        if (!user) return;

        const newStatus = status === "available" ? "busy" : "available";

        try {
            const operatorRef = doc(db, "operators", user.uid);
            await updateDoc(operatorRef, {
                status: newStatus
            });
            setStatus(newStatus); // Update local state after Firestore is updated
            console.log("✅ Status updated to:", newStatus);
        } catch (error) {
            console.error("❌ Error updating status:", error);
        }
    };

    const HeaderRight = () => (
        <View style={{ marginRight: 15 }}>
            <Pressable
            onPress={handleStatusChange}
            >
                <Text className="text-xl text-white font-bold">
                    Status: {status}
                </Text>
            </Pressable>
        </View>
    );

    return (
        <Tabs
            screenOptions={{
                headerTitle: '',
                headerStyle: {
                    backgroundColor: theme.background,
                    height: 100, // Adjust the height of the header here
                    borderBottomWidth: 0, // ✅ removes border
                    shadowColor: 'transparent', // ✅ removes shadow on iOS
                    elevation: 0, // ✅ removes shadow on Android
                },
                headerTransparent: false,
                // headerRight: () => <HeaderRight />,
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: "Home",
                    headerLeft: () => <HeaderLeft />,
                    headerRight: () => <HeaderRight />,
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="home-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="MapViewer"
                options={{
                    title: "Map",
                    tabBarIcon: ({ color, size }) => (
                        <LocationIcon size={size} color={color} />
                    ),
                }}
            />

            <Tabs.Screen
                name="MedicalRecords"
                options={{
                    title: "Records",
                    tabBarIcon: ({ color, size }) => (
                        <MedicalRecordsIcon color={color} size={size}/>
                    ),
                }}
            />

            <Tabs.Screen
                name="(reports_stack)"
                options={{
                    title: "Reports",
                    headerTransparent: false,
                    headerShown: false,
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="map-outline" size={size} color={color} />
                    ),
                }}
            />

            <Tabs.Screen
                name="ProfilePage"
                options={{
                    headerTransparent: false,
                    title: "Profile",
                    tabBarIcon: (props) => <ProfileTabIcon {...props} />,
                }}
            />


        </Tabs>
    );
}
