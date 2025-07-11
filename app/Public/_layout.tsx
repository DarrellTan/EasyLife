import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, TouchableOpacity, Image } from "react-native";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/context/ThemeContext";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, rtdb } from "@/FirebaseConfig";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import SideMenu from '@/components/SideMenu';
import { Portal } from 'react-native-paper';
import MedicalRecordsIcon from "@/components/MedicalRecordsIcon"
import LocationIcon from "@/components/LocationIcon";
import { ref, set } from "firebase/database";
import { useActiveReportContext } from '@/context/ActiveReportContext';
import * as Location from 'expo-location'; // ⬅️ add this import


export default function Layout() {
    const [menuVisible, setMenuVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const { theme } = useTheme();
    const [activeReportId, setActiveReport] = useActiveReportContext();
    const locationData = useRef<any>(null);


    const uploadGeolocation = (userId: string, locationData: any) => {
        const locationRef = ref(rtdb, `reports/${activeReportId}/userGeolocation`);
        return set(locationRef, locationData)
            .then(() => {
                console.log("📍 Location uploaded:", locationData);
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

        console.log("🚀 Uploading updated location:", locationData);
        uploadGeolocation(user.uid, locationData);
    }, [locationData, activeReportId]);

    useEffect(() => {
        // @ts-ignore
        let unsubscribeFromUserDoc = null;

        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                const userDocRef = doc(db, "users", firebaseUser.uid);

                // Subscribe to realtime updates of the user doc
                unsubscribeFromUserDoc = onSnapshot(userDocRef, (userDoc) => {
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
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
                source={require("@/assets/images/EasyLife-logo.png")} // Update path if needed
                style={{
                    width: 190,
                    height: 190,
                    resizeMode: 'contain',
                    marginLeft: 15,
                }}
            />
        </TouchableOpacity>
    );

    const HeaderRight = () => (
        <View style={{ marginRight: 15 }}>
            <TouchableOpacity onPress={() => setMenuVisible(!menuVisible)}>
                <Image
                    source={{
                        uri: selectedImage || "https://upload.wikimedia.org/wikipedia/en/a/a6/Pok%C3%A9mon_Pikachu_art.png",
                    }}
                    style={{ width: 40, height: 40, borderRadius: 20 }}
                />
            </TouchableOpacity>
            <Portal>
                {menuVisible && (
                    <View
                        style={{
                            position: 'absolute',
                            top: 50,
                            right: 0,
                            backgroundColor: 'white',
                            borderRadius: 8,
                            padding: 10,
                            shadowColor: "#000",
                            shadowOpacity: 0.2,
                            shadowRadius: 5,
                            elevation: 5,
                            zIndex: 100,
                        }}
                    >
                        <SideMenu isOpen={menuVisible} setIsOpen={setMenuVisible} />
                    </View>
                )}
            </Portal>
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
                headerShown: true,
                // headerRight: () => <HeaderRight />,
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: "Home",
                    headerLeft: () => <HeaderLeft />,
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
                name="(records_stack)"
                options={{
                    title: "Records",
                    headerTransparent: false,
                    headerShown: false,
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

            <Tabs.Screen
                // Name of the route to hide.
                name="DetailedReport"
                options={{
                    // This tab will no longer show up in the tab bar.
                    href: null,
                }}
            />
        </Tabs>
    );
}
