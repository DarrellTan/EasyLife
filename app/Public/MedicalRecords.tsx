import { View, Text, TextInput, Pressable, TouchableOpacity } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../../FirebaseConfig"; // use your config here
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import {onAuthStateChanged} from "firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import PlusIcon from "@/components/PlusIcon"
import MedicalRecordsIcon from "@/components/MedicalRecordsIcon";


export default function MedicalRecords() {
    const { theme } = useTheme();
    const [userId, setUserId] = useState<string | null>(null);
    const insets = useSafeAreaInsets();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // @ts-ignore
                setUserId(firebaseUser.uid)
            }
        });

        return () => unsubscribe();
    }, []);

    // @ts-ignore
    return (
            <View className="flex-1 items-center" style={{ backgroundColor: theme.background }}>
                <Text className="font-bold text-2xl mb-5" style={{ color: theme.text }}>Medical Records</Text>
                <View className="flex justify-center" style={{ backgroundColor: "#D9D9D9", borderRadius: 9, width: "80%", height: "70%" }}>
                    <View className="flex-row justify-between border-t border-b border-gray-300 pt-6 pb-6 pl-6 pr-6">
                        <Text className="text-black text-2xl font-bold">
                            Medical Conditions
                        </Text>

                       <PlusIcon size={24}/>
                    </View>

                    <View className="flex-row justify-between border-t border-b border-gray-300 pt-6 pb-6 pl-6 pr-6">
                        <Text className="text-black text-2xl font-bold">
                            Current Medication
                        </Text>

                        <PlusIcon size={24}/>
                    </View>

                    <View className="flex-row justify-between border-t border-b border-gray-300 pt-6 pb-6 pl-6 pr-6">
                        <Text className="text-black text-2xl font-bold">
                            Allergies
                        </Text>

                        <PlusIcon size={24}/>
                    </View>

                    <View className="flex-row justify-between border-t border-b border-gray-300 pt-6 pb-6 pl-6 pr-6">
                        <Text className="text-black text-2xl font-bold">
                            Blood Type
                        </Text>

                        <PlusIcon size={24}/>
                    </View>
                </View>

                <TouchableOpacity className="bg-[#1E88E5] mt-6 p-4 rounded-lg items-center mt-2">
                    <Text className="text-white font-bold">Edit Info</Text>
                </TouchableOpacity>
            </View>
    );
}
