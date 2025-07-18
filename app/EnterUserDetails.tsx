import {Pressable, Text, TextInput, View, Alert, ScrollView, KeyboardAvoidingView, Platform, SafeAreaView} from "react-native";
import {useTheme} from "@/context/ThemeContext";
import {useEffect, useState} from "react";
import {onAuthStateChanged} from "firebase/auth";
import {doc, getDoc, setDoc, addDoc, collection, updateDoc} from "firebase/firestore";
import { RadioButton } from "react-native-paper"; // Import RadioButton
import {auth, db} from "@/FirebaseConfig";
import {router} from "expo-router"; // use your config here


export default function EnterUserDetails() {
    const { theme } = useTheme();

    const [user, setUser] = useState(null);
    const [userId, setUserId] = useState("");



    // User Details
    const [fullName, setFullName] = useState("");
    const [icNumber, setIcNumber] = useState("");
    const [address, setAddress] = useState("");
    const [state, setState] = useState("");
    const [postCode, setPostCode] = useState("");
    const [phone, setPhone] = useState("");
    const [gender, setGender] = useState("");
    const [birthday, setBirthday] = useState<Date | null>(null);

    const showErrorAlert = () => {
        Alert.alert(
            "Error Saving Information",
            "Please try submitting again",
            [
                { text: "OK" }
            ],
            { cancelable: true }
        );
    };

    const pleaseFillAllAlert = () => {
        Alert.alert(
            "Please fill in all the fields",
            "",
            [
                { text: "OK" }
            ],
            { cancelable: true }
        );
    };


    const handleGenderChange = (value: string) => {
        setGender(value); // Update gender selection
    };


    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // @ts-ignore
                setUser(firebaseUser);
                setUserId(firebaseUser.uid)
            }
        });

        return () => unsubscribe();
    }, []);



    const calculateBirthday = () => {
        const birthDateStr = icNumber.slice(0, 6);

        const day = parseInt(birthDateStr.slice(0, 2));
        const month = parseInt(birthDateStr.slice(2, 4));
        const year = parseInt(birthDateStr.slice(4, 6));

        const fullYear = year < 50 ? 2000 + year : 1900 + year;

        const date = new Date(fullYear, month - 1, day);
        setBirthday(date); // Set the value in state
    };

    useEffect(() => {
        if (icNumber.length >= 6) {
            calculateBirthday();
        }
    }, [icNumber]);

    const handleSubmit = async () => {
        if (
            fullName.trim() === '' ||
            icNumber.trim() === '' ||
            address.trim() === '' ||
            state.trim() === '' ||
            postCode.trim() === '' ||
            phone.trim() === '' ||
            gender.trim() === ''
        ) {
            console.log('Please fill in all fields.');
            pleaseFillAllAlert();
            return;
        }

        try {
            await setDoc(doc(db, 'users', userId), {
                fullName,
                icNumber,
                address,
                state,
                postCode,
                phone,
                gender,
                birthday,
                init: true
            },
                { merge : true}
            );

            console.log('Data saved under user ID:', userId);
            router.push("/ChooseProfilePicture");
        } catch (error) {
            console.error('Error uploading data:', error);
            showErrorAlert();
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            <KeyboardAvoidingView
                style={{ flex: 1, backgroundColor: theme.background }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0} // adjust this as needed
            >
                <ScrollView className="flex-1" style={{ backgroundColor: theme.background }} contentContainerStyle={{ justifyContent: 'center', flexGrow: 1 }}>
                    <View className="flex-1 justify-center px-4" style={{ backgroundColor: theme.background }}>
                        <View className="items-center">
                            <Text className="text-4xl font-bold mb-2" style={{ color: theme.text }}>Enter User Details</Text>
                            <TextInput
                                className="h-10 my-3 border px-2.5 text-black bg-white w-full rounded"
                                value={fullName}
                                onChangeText={setFullName}
                                placeholder="Full Name"
                                placeholderTextColor="#888"
                            />

                            <TextInput
                                className="h-10 my-3 border px-2.5 text-black bg-white w-full rounded"
                                value={icNumber}
                                onChangeText={setIcNumber}
                                placeholder="IC Number"
                                placeholderTextColor="#888"
                            />

                            <TextInput
                                className="h-10 my-3 border px-2.5 text-black bg-white w-full rounded"
                                value={address}
                                onChangeText={setAddress}
                                placeholder="Address Line"
                                placeholderTextColor="#888"
                            />

                            <View className="flex-row">
                                <TextInput
                                    className="h-10 my-3 mr-12 border px-2.5 text-black bg-white w-full flex-1 rounded"
                                    value={state}
                                    onChangeText={setState}
                                    placeholder="State"
                                    placeholderTextColor="#888"
                                />

                                <TextInput
                                    className="h-10 my-3 border px-2.5 text-black bg-white w-full flex-1 rounded"
                                    value={postCode}
                                    keyboardType={"numeric"}
                                    onChangeText={setPostCode}
                                    placeholder="Post Code"
                                    placeholderTextColor="#888"
                                />
                            </View>

                            <TextInput
                                className="h-10 my-3 border px-2.5 text-black bg-white w-full rounded"
                                value={phone}
                                onChangeText={setPhone}
                                placeholder="Phone Number"
                                placeholderTextColor="#888"
                            />

                            <View className="flex-row justify-center items-center">
                                {/* Gender Label */}
                                <Text className="text-l font-bold mr-3" style={{color : theme.text}}>Gender:</Text>

                                {/* Male Radio Button */}
                                <View style={{ flexDirection: "row", alignItems: "center", marginRight: 15 }}>
                                    <View
                                        style={{
                                            borderWidth: 1, // Smaller border width
                                            borderColor: "#3498db", // Border color
                                            borderRadius: 50, // To make the border rounded
                                            padding: 2, // Reduced padding to make the button fit smaller
                                            marginRight: 5, // Added space between the radio button and the text
                                        }}
                                    >
                                        <RadioButton
                                            value="Male"
                                            status={gender === "Male" ? "checked" : "unchecked"}
                                            onPress={() => handleGenderChange("Male")}
                                            color="#3498db" // Custom color for the checked radio button
                                            uncheckedColor="#3498db" // Color for the unchecked state border
                                        />
                                    </View>
                                    <Text style={{color : theme.text}}>Male</Text>
                                </View>

                                {/* Female Radio Button */}
                                <View style={{ flexDirection: "row", alignItems: "center" }}>
                                    <View
                                        style={{
                                            borderWidth: 1, // Same smaller border width
                                            borderColor: "#3498db",
                                            borderRadius: 50,
                                            padding: 2, // Smaller padding to match size
                                            marginRight: 5, // Space between radio button and text
                                        }}
                                    >
                                        <RadioButton
                                            value="Female"
                                            status={gender === "Female" ? "checked" : "unchecked"}
                                            onPress={() => handleGenderChange("Female")}
                                            color="#3498db"
                                            uncheckedColor="#3498db"
                                        />
                                    </View>
                                    <Text style={{color : theme.text}}>Female</Text>
                                </View>
                            </View>


                        </View>


                        <View className="flex-row justify-center items-center">
                            <Pressable onPress={handleSubmit} className="bg-blue-600 px-4 py-2 rounded mt-2">
                                <Text className="text-white font-semibold">Submit</Text>
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
