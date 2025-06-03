import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, TouchableOpacity, Image } from "react-native";
import { useState, useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/FirebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import SideMenu from '@/components/SideMenu';
import { Portal } from 'react-native-paper';
import MedicalRecordsIcon from "@/components/MedicalRecordsIcon"
import LocationIcon from "@/components/LocationIcon";



export default function Layout() {
    const [menuVisible, setMenuVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const { theme } = useTheme();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const userDocRef = doc(db, "users", firebaseUser.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (userData.profilePicUrl) {
                        setSelectedImage(userData.profilePicUrl);
                    }
                }
            }
        });

        return () => unsubscribe();
    }, []);

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
                name="MedicalRecords"
                options={{
                    title: "Records",
                    tabBarIcon: ({ color, size }) => (
                        <MedicalRecordsIcon color={color} size={size}/>
                    ),
                }}
            />

            <Tabs.Screen
                name="emergencyReport"
                options={{
                    title: "Report",
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
                    tabBarIcon: ({ color, size }) => (
                        selectedImage ? (
                            <Image
                                source={{ uri: selectedImage }}
                                style={{
                                    width: size,
                                    height: size,
                                    borderRadius: size / 2, // Makes it circular
                                    borderWidth: 0,
                                    borderColor: color, // Optional: add border matching tabBar icon color
                                }}
                            />
                        ) : (
                        <Ionicons name="person-outline" size={size} color={color} />
                    )
                ),
            }}
                />

        </Tabs>
    );
}
