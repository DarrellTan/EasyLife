import {Pressable, Text, TextInput, View, Image, TouchableOpacity, Modal} from "react-native";
import {useTheme} from "@/context/ThemeContext";
import {useEffect, useState} from "react";
import {onAuthStateChanged} from "firebase/auth";
import {doc, getDoc, setDoc} from "firebase/firestore";
import {auth, db, storage} from "@/FirebaseConfig";
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytesResumable, getDownloadURL, uploadBytes } from 'firebase/storage';
import { User } from "firebase/auth";
import * as FileSystem from 'expo-file-system';
import {router} from "expo-router"; // use your config here


export default function ChooseProfilePicture() {
    const { theme } = useTheme();

    const [user, setUser] = useState<User | null>(null);
    const [gender, setGender] = useState("");

    // User Details
    const [fullName, setFullName] = useState("");
    const [icNumber, setIcNumber] = useState("");
    const [address, setAddress] = useState("");
    const [state, setState] = useState("");
    const [postCode, setPostCode] = useState("");
    const [phone, setPhone] = useState("");


    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);


    const openPicturePopup = () => setIsModalVisible(true);
    const closePicturePopup = () => setIsModalVisible(false);

    // useEffect for Authentication
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // @ts-ignore
                setUser(firebaseUser);

                const userDocRef = doc(db, "users", firebaseUser.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (userData.profilePicUrl) {
                        // If profilePicUrl exists, set the selectedImage state
                        setSelectedImage(userData.profilePicUrl);
                    }
                }
            }
        });

        return () => unsubscribe();
    }, []);

    // useEffect for Camera Permissions
    useEffect(() => {
        (async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                alert('Sorry, we need media permissions to make this work!');
            }

            const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
            if (cameraStatus.status !== 'granted') {
                alert('Sorry, we need camera permissions to make this work!');
            }
        })();
    }, []);

    // Image Picker Functions
    const pickFromGallery = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
        });

        if (!result.canceled) {
            setSelectedImage(result.assets[0].uri);
            closePicturePopup?.(); // optional if you have a modal
        }
    };


    const takePhotoWithCamera = async () => {
        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
        });

        if (!result.canceled) {
            setSelectedImage(result.assets[0].uri);
            closePicturePopup();
        }
    };

    // Upload Picture to Firebase
    const getBlobFroUri = async (uri: string) => {
        const blob = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.onload = function () {
                resolve(xhr.response);
            };
            xhr.onerror = function (e) {
                reject(new TypeError("Network Error"));
            };
            xhr.responseType = "blob";
            xhr.open("GET", uri, true);
            xhr.send(null);
        })
        return blob;
    }

    const handleSubmit = async () => {
        console.log("Pressed")
        if (!selectedImage || !user?.uid) return;

        try {
            // 1. Convert URI to Blob
            const blob = await getBlobFroUri(selectedImage);

            // 2. Create a reference in Firebase Storage
            const storageRef = ref(storage, `profilePics/${user.uid}.jpg`);

            // 3. Upload the blob
            // @ts-ignore
            await uploadBytes(storageRef, blob);

            // 4. Get download URL
            const downloadURL = await getDownloadURL(storageRef);

            // 5. Save download URL to Firestore
            const userDocRef = doc(db, "users", user.uid);
            await setDoc(userDocRef, {
                profilePicUrl: downloadURL
            }, { merge: true });

            console.log("✅ Profile picture uploaded successfully!");
            router.push("/EnterMedicalInformation");
        } catch (e) {
            console.error("🔥 Upload error:", e);
        }
    };


    return (
        <View className="flex-1" style={{ backgroundColor: theme.background }}>
            <View className="flex-1 px-4" style={{ backgroundColor: theme.background, marginTop: 150 }}>
                <View className="items-center">
                    <Text className="text-4xl font-bold mb-2" style={{ color: theme.text }}>Choose Profile Picture</Text>
                        <View style={{ position: "relative", marginTop: 50, marginBottom: 50}}>
                            <TouchableOpacity onPress={openPicturePopup}>
                                <Image
                                    source={
                                        selectedImage
                                            ? { uri: selectedImage }
                                            : require("@/assets/images/cloud-upload-outline.jpg")
                                    }
                                    style={{ width: 300, height: 300, borderRadius: 150, borderColor: theme.text, borderWidth: 2 }}
                                />

                            </TouchableOpacity>
                            <TouchableOpacity onPress={openPicturePopup}>
                                <Ionicons
                                    name="camera-outline"
                                    size={40}
                                    color={theme.text}
                                    style={{
                                        position: 'absolute',
                                        bottom: 20,
                                        right: 10,
                                        backgroundColor: theme.background,
                                        borderRadius: 30,
                                        padding: 5,
                                        borderWidth: 2,
                                        borderColor: theme.text,
                                    }}
                                />
                            </TouchableOpacity>

                            <Modal
                                transparent
                                visible={isModalVisible}
                                animationType="fade"
                                onRequestClose={closePicturePopup}
                            >
                                <Pressable
                                    style={{
                                        flex: 1,
                                        backgroundColor: 'rgba(0,0,0,0.5)',
                                        justifyContent: 'center',
                                        alignItems: 'center'
                                    }}
                                    onPress={closePicturePopup} // Close when pressing outside
                                >
                                    <View className="items-center" style={{
                                        width: 300,
                                        backgroundColor: 'white',
                                        borderRadius: 10,
                                        padding: 20
                                    }}>
                                        <Pressable onPress={() => {pickFromGallery()}}>
                                            <Text style={{ color: 'blue', marginBottom: 10 }}>Pick from Gallery</Text>
                                        </Pressable>
                                        <Pressable onPress={() => {takePhotoWithCamera()}}>
                                            <Text style={{ color: 'blue', marginBottom: 10 }}>Take a Photo</Text>
                                        </Pressable>
                                        <Pressable onPress={() => { console.log("Remove Photo"); closePicturePopup(); }}>
                                            <Text style={{ color: 'blue' }}>Remove Photo</Text>
                                        </Pressable>
                                    </View>
                                </Pressable>
                            </Modal>
                        </View>

                </View>


                <View className="justify-center items-center">
                    <Pressable onPress={handleSubmit} className="bg-blue-600 px-4 py-2 rounded mt-2 mb-2">
                        <Text className="text-white font-semibold">Next</Text>
                    </Pressable>

                    <Pressable onPress={() => router.push("/EnterMedicalInformation")} className="bg-blue-600 px-4 py-2 rounded mt-2">
                        <Text className="text-white font-semibold">Skip</Text>
                    </Pressable>
                </View>

            </View>
        </View>

    );
}
