import { SafeAreaView , ScrollView ,View, Text, TextInput, Pressable, Image, TouchableOpacity , Modal} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, updateDoc } from "firebase/firestore";
import { auth, db, storage } from "@/FirebaseConfig"; // use your config here
import { ref, uploadBytesResumable, getDownloadURL, uploadBytes } from 'firebase/storage';
import LocationkIcon from "@/components/LocationIcon";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useActiveReportContext } from '@/context/ActiveReportContext';
import { useNavigation } from '@react-navigation/native';





export default function DetailedReport() {
    const { theme } = useTheme();
    const { id } = useLocalSearchParams();
    const [activeReportId, setActiveReport] = useActiveReportContext();
    const navigation = useNavigation();


    // useStates for Fetching information
    const [status, setStatus] = useState();
    const [date, setDate] = useState(new Date());
    const [latitude, setLatitude] = useState();
    const [longitude, setLongitude] = useState();
    const [location, setLocation] = useState();
    const [operatorProfile, setOperatorProfile] = useState(null);
    const [operatorName, setOperatorName] = useState("N/A");

    const [loading, setLoading] = useState(true);
    const [transcribedText, setTranscribedText] = useState("");
    const [emergencyService, setEmergencyService] = useState("");
    const [operatorId, setOperatorId] = useState("");
    const [error, setError] = useState("");

    const [selectedImage, setSelectedImage] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
            if (firebaseUser) {
                console.log("User detected:", firebaseUser.uid); // ✅
                console.log(id);
                await fetchReports(firebaseUser.uid);
            }
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const fetchLocationName = async () => {
            try {
                console.log("Fetching location...");
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
                );

                if (!response.ok) throw new Error("Failed to fetch location");

                const data = await response.json();
                console.log("Location data:", data.address);
                const { quarter, city, state } = data.address;
                const shortLocation = quarter || city || state || "Unknown Location";

                setLocation(shortLocation);
            } catch (err: any) {
                setError(err.message);
            }
        };

        // 🔁 Run only if both lat & lon are ready
        if (latitude != null && longitude != null) {
            fetchLocationName();
        }
    }, [latitude, longitude]);

    const setReportComplete = async (id: string) => {
        try {
            const reportsRef = doc(db, "reports", id);
            const reportDoc = await getDoc(reportsRef);

            if (reportDoc.exists()) {
                const reportData = reportDoc.data();

                // Update report status
                await updateDoc(reportsRef, {
                    status: "Complete",
                });

                // If operator is assigned, update their status
                if (reportData.assignedOperator) {
                    const operatorRef = doc(db, "operators", reportData.assignedOperator);
                    await updateDoc(operatorRef, {
                        status: "available", // spelling fix here
                    });
                }

                console.log("Report and operator status updated.");
            } else {
                console.warn("Report document does not exist.");
            }
        } catch (error) {
            console.error("Error updating report:", error);
        }
    };

    const cancelReport = async (id: string) => {
        setReportComplete(id);
        setActiveReport(null);
        navigation.reset({
            index: 0,
            routes: [{ name: "index" }],
        });
    }

    const completeReport = async (id: string) => {
        setReportComplete(id);
        setActiveReport(null);
        navigation.reset({
            index: 0,
            routes: [{ name: "index" }],
        });
    }

    const fetchReports = async (uid: string) => {
        setLoading(true);
        try {
            const reportsRef = doc(db, "reports", id);
            const reportDoc = await getDoc(reportsRef);


            if (reportDoc.exists()) {
                const reportData = reportDoc.data();
                setDate(reportData.date);
                setTranscribedText(reportData.transcribedText);
                setLatitude(reportData.location.latitude);
                setLongitude(reportData.location.longitude);
                setStatus(reportData.status);
                setOperatorId(reportData.assignedOperator);
                setEmergencyService(reportData.assignedEmergencyService);

                // 🔽 Fetch operator profile after setting operatorId
                if (reportData.assignedOperator) {
                    const operatorRef = doc(db, "operators", reportData.assignedOperator);
                    const operatorSnap = await getDoc(operatorRef);
                    if (operatorSnap.exists()) {
                        const operatorData = operatorSnap.data();
                        setOperatorProfile(operatorData);

                        if (operatorData.profilePicUrl) {
                            setSelectedImage(operatorData.profilePicUrl);
                        }

                        console.log(operatorData);
                    } else {
                        console.warn("Assigned operator not found");
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchOperatorProfile = async (operatorId) => {
        try {
            const docRef = doc(db, "operators", operatorId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return docSnap.data(); // this is the operator profile
            } else {
                console.warn("No such operator found.");
                return null;
            }
        } catch (error) {
            console.error("Error fetching operator profile:", error);
            return null;
        }
    };


    // @ts-ignore
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            <ScrollView>
                <View className="px-4" style={{ backgroundColor: theme.background }}>
                    <View className="flex-row justify-between items-center self-center" style={{ backgroundColor: theme.background, width: "90%" }}>
                        <Text className="font-bold text-white text-3xl">Report {id}</Text>

                        {status === "Active" && (
                            <View style={{ backgroundColor: "#F98789", borderRadius: 16, paddingVertical: 4, paddingHorizontal: 8 }}>
                                <Text className="font-bold text-xl text-[#7D0002]">Active</Text>
                            </View>
                        )}

                        {status === "Complete" && (
                            <View style={{ backgroundColor: "#87F99C", borderRadius: 16, paddingVertical: 4, paddingHorizontal: 8 }}>
                                <Text className="font-bold text-xl text-[#007D13]">Complete</Text>
                            </View>
                        )}
                    </View>

                    <View className="self-center mt-4" style={{ width: "90%"}}>
                        <Text className="font-bold text-2xl text-white">
                            { date
                                ? new Date(date).toLocaleDateString(undefined, {
                                    day: "2-digit",
                                    year: 'numeric',
                                    month: 'long',
                                })
                                : "Invalid Date"
                            }
                        </Text>
                    </View>

                    <View className="flex-row items-center self-center mt-4" style={{ width: "90%"}}>
                        <LocationkIcon size={20} color={theme.text} />
                        <Text className="ml-2 font-bold text-xl text-white">{location}</Text>
                    </View>

                    <View className="self-center mt-4" style={{ width: "90%", height: 1, backgroundColor: '#888' }} />

                    <View className="self-center mt-4" style={{ width: "90%"}}>
                        <Text className="font-bold text-2xl text-white">Report Message</Text>

                        <Text className="font-bold text-l text-white mt-2">{transcribedText}</Text>
                    </View>

                    <View className="self-center mt-6" style={{ width: "90%", height: 1, backgroundColor: '#888' }} />

                    <View className="self-center mt-4" style={{ width: "90%"}}>
                        <Text className="font-bold text-2xl text-white">Emergency Operator</Text>

                       <View className="flex-row items-center mt-4">
                           <Image
                               source={
                                   selectedImage
                                       ? { uri: selectedImage }
                                       : require("@/assets/images/cloud-upload-outline.jpg")
                               }
                               style={{ width: 60, height: 60, borderRadius: 150, borderColor: theme.text, borderWidth: 2 }}
                           />

                           <View className="ml-4 items-start">
                               <Text className="font-bold text-2xl text-white">{operatorProfile?.fullName ?? "N/A"}</Text>
                               <Text className="font-bold text-l text-white mt-1">{emergencyService ?? "N/A"}</Text>
                           </View>
                       </View>
                    </View>

                    {status === "Active" && (
                        <>
                            <View className="self-center mt-6" style={{ width: "90%", height: 1, backgroundColor: '#888' }} />

                            <View className="flex-row items-center self-center justify-between mt-4" style={{ width: "90%"}}>
                                <Pressable style={{ backgroundColor: "#E93838", borderRadius: 16, paddingVertical: 4, paddingHorizontal: 8 }} onPress={() => cancelReport(id)}>
                                    <Text className="font-bold text-xl text-white">Cancel Report</Text>
                                </Pressable>

                                <Pressable style={{ backgroundColor: "#1CAF49", borderRadius: 16, paddingVertical: 4, paddingHorizontal: 8 }} onPress={() => completeReport(id)}>
                                    <Text className="font-bold text-xl text-white">Complete Report</Text>
                                </Pressable>
                            </View>
                        </>
                    )}

                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
