import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { useEffect, useState } from "react";
import { auth, db } from "@/FirebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function EditMedicalInfo({ onClose }: { onClose: () => void }) {
    const { theme } = useTheme();
    const [userId, setUserId] = useState<string | null>(null);

    const [medicalConditions, setMedicalConditions] = useState<string[]>([""]);
    const [currentMedications, setCurrentMedications] = useState<string[]>([""]);
    const [allergies, setAllergies] = useState<string[]>([""]);
    const [bloodType, setBloodType] = useState<string>("");

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const uid = firebaseUser.uid;
                setUserId(uid);

                const medicalDocRef = doc(db, "users", uid, "MedicalInformation", "main");
                const snapshot = await getDoc(medicalDocRef);
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    setMedicalConditions(data.medicalConditions || [""]);
                    setCurrentMedications(data.currentMedications || [""]);
                    setAllergies(data.allergies || [""]);
                    setBloodType(data.bloodType || "");
                }
            }
        });

        return () => unsubscribe();
    }, []);

    const handleSave = async () => {
        if (!userId) return;

        const medicalDocRef = doc(db, "users", userId, "MedicalInformation", "main");

        await setDoc(medicalDocRef, {
            medicalConditions,
            currentMedications,
            allergies,
            bloodType,
        });

        onClose(); // go back to previous screen
    };

    const handleListChange = (value: string, index: number, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
        setter(prev => {
            const updated = [...prev];
            updated[index] = value;
            return updated;
        });
    };

    const addField = (setter: React.Dispatch<React.SetStateAction<string[]>>) => {
        setter(prev => [...prev, ""]);
    };

    const removeField = (
        index: number,
        setter: React.Dispatch<React.SetStateAction<string[]>>
    ) => {
        setter(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <ScrollView style={{ flex: 1, backgroundColor: theme.background, padding: 16 }}>
            <Text className="text-2xl font-bold mb-4" style={{ color: theme.text }}>Edit Medical Information</Text>

            {/* Medical Conditions */}
            <Text className="text-lg font-semibold mb-2" style={{ color: theme.text }}>Medical Conditions</Text>
            {medicalConditions.map((cond, idx) => (
                <View key={idx} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                    <TextInput
                        value={cond}
                        onChangeText={(val) => handleListChange(val, idx, setMedicalConditions)}
                        className="border p-2 flex-1 bg-white rounded"
                    />
                    <TouchableOpacity
                        onPress={() => removeField(idx, setMedicalConditions)}
                        style={{ marginLeft: 8 }}
                    >
                        <Text className="text-red-500">❌</Text>
                    </TouchableOpacity>
                </View>
            ))}
            <TouchableOpacity onPress={() => addField(setMedicalConditions)}>
                <Text className="text-blue-600 mb-4">+ Add Condition</Text>
            </TouchableOpacity>

            {/* Current Medications */}
            <Text className="text-lg font-semibold mb-2" style={{ color: theme.text }}>Current Medications</Text>
            {currentMedications.map((cond, idx) => (
                <View key={idx} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                    <TextInput
                        value={cond}
                        onChangeText={(val) => handleListChange(val, idx, setCurrentMedications)}
                        className="border p-2 flex-1 bg-white rounded"
                    />
                    <TouchableOpacity
                        onPress={() => removeField(idx, setCurrentMedications)}
                        style={{ marginLeft: 8 }}
                    >
                        <Text className="text-red-500">❌</Text>
                    </TouchableOpacity>
                </View>
            ))}
            <TouchableOpacity onPress={() => addField(setCurrentMedications)}>
                <Text className="text-blue-600 mb-4">+ Add Medication</Text>
            </TouchableOpacity>

            {/* Allergies */}
            <Text className="text-lg font-semibold mb-2" style={{ color: theme.text }}>Allergies</Text>
            {allergies.map((cond, idx) => (
                <View key={idx} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                    <TextInput
                        value={cond}
                        onChangeText={(val) => handleListChange(val, idx, setAllergies)}
                        className="border p-2 flex-1 bg-white rounded"
                    />
                    <TouchableOpacity
                        onPress={() => removeField(idx, setAllergies)}
                        style={{ marginLeft: 8 }}
                    >
                        <Text className="text-red-500">❌</Text>
                    </TouchableOpacity>
                </View>
            ))}
            <TouchableOpacity onPress={() => addField(setAllergies)}>
                <Text className="text-blue-600 mb-4">+ Add Allergy</Text>
            </TouchableOpacity>

            {/* Blood Type */}
            <Text className="text-lg font-semibold mb-2" style={{ color: theme.text }}>Blood Type</Text>
            <TextInput
                value={bloodType}
                onChangeText={setBloodType}
                className="border p-2 mb-4 bg-white rounded"
            />

            <TouchableOpacity onPress={handleSave} className="bg-[#1E88E5] p-4 rounded-lg items-center mt-4">
                <Text className="text-white font-bold">Save</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} className="bg-red-600 p-4 rounded-lg mt-4 items-center mb-8">
                <Text className=" text-white font-medium">Cancel</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}
