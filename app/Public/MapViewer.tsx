import { View, Text, TextInput, Pressable } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../../FirebaseConfig"; // use your config here
import Map from "@/components/Map";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';



export default function MapViewer() {
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
             <View className="flex-1 items-center px-4" style={{ backgroundColor: theme.background }}>
                <Map/>
                <Text className="text-white">Hi</Text>
            </View>
        </SafeAreaView>
    );
}
