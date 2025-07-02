import { SafeAreaView , ScrollView ,View, Text, TextInput, Pressable, Image, TouchableOpacity , Modal} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDocs, setDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db, storage } from "@/FirebaseConfig"; // use your config here
import { ref, uploadBytesResumable, getDownloadURL, uploadBytes } from 'firebase/storage';
import CheckmarkIcon from "@/components/CheckmarkIcon";
import AlertIcon from "@/components/AlertIcon";
import { router } from "expo-router";



export default function ReportHistory() {
    const { theme } = useTheme();

    // useStates for Fetching information
    const [user, setUser] = useState(null);
    const [ongoingReports, setOngoingReports] = useState([]);
    const [pastReports, setPastReports] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
            if (firebaseUser) {
                console.log("User detected:", firebaseUser.uid); // ✅
                setUser(firebaseUser);

                const reportsRef = collection(db, "reports");
                const q = query(reportsRef, where("assignmentOperatorIds", "array-contains", firebaseUser.uid));



                const unsubscribeSnapshot = onSnapshot(q, (querySnapshot) => {
                    const ongoing: any[] = [];
                    const past: any[] = [];


                    querySnapshot.forEach((doc) => {
                        const report = { id: doc.id, ...doc.data() };
                        if (report.status === "Active") {
                            ongoing.unshift(report);
                        } else if (report.status === "Complete") {
                            past.unshift(report);
                        }
                    });

                    setOngoingReports(ongoing);
                    setPastReports(past);
                    setLoading(false);
                });

                // Return inner unsubscribe on unmount
                return () => unsubscribeSnapshot();
            }
        });

        return () => unsubscribe();
    }, []);


    // @ts-ignore
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            <ScrollView>
                <View className="items-center px-4" style={{ backgroundColor: theme.background }}>
                    {/* Header */}
                    <View className="flex-row items-center" style={{ backgroundColor: theme.background }}>
                        <View>
                            <Text className="font-bold text-white text-3xl">Report History</Text>
                        </View>
                    </View>

                    {
                        loading ? (
                            <Text className="text-white text-xl mt-10">Loading reports...</Text>
                        ) : ongoingReports.length === 0 && pastReports.length === 0 ? (
                            <Text className="text-white text-xl mt-10">No Previous Reports</Text>
                        ) : (
                            <>
                                {/* Ongoing Reports */}
                                {ongoingReports.length > 0 && (
                                    <View className="w-full mt-6">
                                        <Text className="text-white font-bold text-xl mb-2" style={{ alignSelf: "flex-start" }}>
                                            Ongoing Reports
                                        </Text>
                                        <View style={{ backgroundColor: '#1E1E1E' }}>
                                            {ongoingReports.map((report) => (
                                                <Pressable key={report.id} className="p-4 rounded-lg" onPress={() => router.push(`/Operators/(reports_stack)/${report.id}`)}>
                                                    <View className="flex-row items-center gap-4">
                                                        <AlertIcon className="mr-4" size={40} />
                                                        <View className="flex gap-1">
                                                            <Text className="text-white text-2xl font-bold">{"Report " + report.reportId || "Unnamed Report"}</Text>
                                                            <Text className="text-white text-l">
                                                                { report.date
                                                                    ? new Date(report.date).toLocaleDateString(undefined, {
                                                                        day: "2-digit",
                                                                        year: 'numeric',
                                                                        month: 'long',
                                                                    })
                                                                    : "Invalid Date"
                                                                }
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </Pressable>
                                            ))}
                                        </View>
                                    </View>
                                )}

                                {/* Past Reports */}
                                {pastReports.length > 0 && (
                                    <View className="w-full mt-6">
                                        <Text className="text-white font-bold text-xl mb-2" style={{ alignSelf: "flex-start" }}>
                                            Past Reports
                                        </Text>
                                        <View style={{ backgroundColor: '#1E1E1E' }}>
                                            {pastReports.map((report) => (
                                                <Pressable key={report.id} className="p-4 rounded-lg" onPress={() => router.push(`/Operators/(reports_stack)/${report.id}`)}>
                                                    <View className="flex-row items-center gap-4">
                                                        <CheckmarkIcon className="mr-4" size={40} />
                                                        <View className="flex gap-1">
                                                            <Text className="text-white text-2xl font-bold">{"Report " + report.reportId || "Unnamed Report"}</Text>
                                                            <Text className="text-white text-l">
                                                                { report.date
                                                                    ? new Date(report.date).toLocaleDateString(undefined, {
                                                                        day: "2-digit",
                                                                        year: 'numeric',
                                                                        month: 'long',
                                                                    })
                                                                    : "Invalid Date"
                                                                }
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </Pressable>
                                            ))}
                                        </View>
                                    </View>
                                )}
                            </>
                        )
                    }
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
