import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/FirebaseConfig";
import PlusIcon from "@/components/PlusIcon";

export default function MedicalRecords() {
    const { theme } = useTheme();
    const [userId, setUserId] = useState<string | null>(null);
    const [activePage, setActivePage] = useState<null | 'conditions' | 'medications' | 'allergies' | 'bloodtype'>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                setUserId(firebaseUser.uid);
            }
        });
        return () => unsubscribe();
    }, []);

    const renderDetailContent = () => {
        let title = "";
        let items: string[] = [];

        switch (activePage) {
            case 'conditions':
                title = "Medical Conditions";
                items = ["Achilles tendinopathy", "Addison's disease", "Lupus"];
                break;
            case 'medications':
                title = "Current Medications";
                items = ["Ibuprofen", "Metformin"];
                break;
            case 'allergies':
                title = "Allergies";
                items = ["Pollen", "Penicillin"];
                break;
            case 'bloodtype':
                title = "Blood Type";
                items = ["O+"];
                break;
        }

        return (
            <View className="flex-1 items-center" style={{ backgroundColor: theme.background, borderRadius: 9 }}>
                <Text className="font-bold text-2xl mb-5" style={{ color: theme.text }}>Medical Records</Text>

                <View className="flex justify-start" style={{ backgroundColor: "#D9D9D9", borderRadius: 9, width: "80%", height: "70%" }}>
                    {/* Top Bar with Back and Title */}
                    <View className="flex-row justify-between items-center border-b border-gray-300 pt-6 pb-6 px-6 w-full" style={{ backgroundColor: '#7f8c8d', borderTopLeftRadius: 9, borderTopRightRadius: 9 }}>
                        <TouchableOpacity onPress={() => setActivePage(null)}>
                            <Text className="text-white text-2xl font-bold">{title}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setActivePage(null)}>
                            <Text className="text-white text-4xl font-bold">-</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <View>
                        {items.map((item, index) => (
                            <View
                                key={index}
                                className="flex-row items-center border-t border-b border-gray-300 pt-6 pb-6 px-6"
                            >
                                <Text className="text-black text-lg font-medium">→ {item}</Text>
                            </View>
                        ))}
                    </View>

                </View>

                <TouchableOpacity className="bg-[#1E88E5] mt-6 p-4 rounded-lg items-center mt-2">
                    <Text className="text-white font-bold">Edit Info</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderMainContent = () => (
        <View className="flex-1 items-center" style={{ backgroundColor: theme.background }}>
            <Text className="font-bold text-2xl mb-5" style={{ color: theme.text }}>Medical Records</Text>
            <View className="" style={{ backgroundColor: "#D9D9D9", borderRadius: 9, width: "80%", height: "70%" }}>
                <TouchableOpacity
                    className="flex-row justify-between border-b border-gray-300 pt-6 pb-6 pl-6 pr-6" // can add border-t and can put justify center above
                    onPress={() => setActivePage('conditions')}
                >
                    <Text className="text-black text-2xl font-bold">Medical Conditions</Text>
                    <PlusIcon size={24} />
                </TouchableOpacity>

                <TouchableOpacity
                    className="flex-row justify-between border-t border-b border-gray-300 pt-6 pb-6 pl-6 pr-6"
                    onPress={() => setActivePage('medications')}
                >
                    <Text className="text-black text-2xl font-bold">Current Medication</Text>
                    <PlusIcon size={24} />
                </TouchableOpacity>

                <TouchableOpacity
                    className="flex-row justify-between border-t border-b border-gray-300 pt-6 pb-6 pl-6 pr-6"
                    onPress={() => setActivePage('allergies')}
                >
                    <Text className="text-black text-2xl font-bold">Allergies</Text>
                    <PlusIcon size={24} />
                </TouchableOpacity>

                <TouchableOpacity
                    className="flex-row justify-between border-t border-b border-gray-300 pt-6 pb-6 pl-6 pr-6"
                    onPress={() => setActivePage('bloodtype')}
                >
                    <Text className="text-black text-2xl font-bold">Blood Type</Text>
                    <PlusIcon size={24} />
                </TouchableOpacity>
            </View>

            <TouchableOpacity className="bg-[#1E88E5] mt-6 p-4 rounded-lg items-center mt-2">
                <Text className="text-white font-bold">Edit Info</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View className="flex-1 w-full" style={{ backgroundColor: theme.background }}>
            {activePage ? renderDetailContent() : renderMainContent()}
        </View>
    );
}
