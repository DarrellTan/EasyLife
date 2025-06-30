import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/FirebaseConfig";

export default function Login() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = async () => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const uid = userCredential.user.uid;

            const userDocRef = doc(db, "users", uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                router.replace("/Public/home");
            } else {
                const operatorDocRef = doc(db, "operators", uid);
                const operatorDocSnap = await getDoc(operatorDocRef);

                if (operatorDocSnap.exists()) {
                    router.replace("/Operators/home");
                } else {
                    Alert.alert("Login failed", "No user role found for this account.");
                }
            }
        } catch (error: any) {
            Alert.alert("Login failed", error.message);
        }
    };

    return (
        <View className="flex-1 justify-center bg-[#121212] p-6">
            <Text className="text-[28px] font-bold text-white mb-6 text-center">Login</Text>

            <TextInput
                className="bg-[#1E1E1E] p-3.5 rounded-lg mb-4 text-white"
                placeholder="Email"
                placeholderTextColor="#aaa"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
            />

            <TextInput
                className="bg-[#1E1E1E] p-3.5 rounded-lg mb-4 text-white"
                placeholder="Password"
                placeholderTextColor="#aaa"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />

            <TouchableOpacity className="bg-[#1E88E5] p-4 rounded-lg items-center mt-2" onPress={handleLogin}>
                <Text className="text-white font-bold">Log In</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.replace("/")}>
                <Text className="text-[#aaa] mt-4 text-center">Don't have an account? Register</Text>
            </TouchableOpacity>
        </View>
    );
}
