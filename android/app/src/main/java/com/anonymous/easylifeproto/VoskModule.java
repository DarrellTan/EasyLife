package com.anonymous.easylifeproto;

import android.Manifest;
import android.content.pm.PackageManager;
import android.content.pm.AssetManager;
import android.util.Log;

import androidx.core.app.ActivityCompat;

import com.facebook.react.bridge.*;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.bridge.WritableMap; //optional
import com.facebook.react.bridge.Arguments; //optional

import org.json.JSONArray;
import org.json.JSONObject;

import org.vosk.Model;
import org.vosk.Recognizer;
import org.vosk.android.RecognitionListener;
import org.vosk.android.SpeechService;
import org.vosk.android.StorageService;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileWriter;
import java.io.FileReader;
import java.io.BufferedReader;
import java.io.IOException;

import java.nio.file.Files;
import java.nio.file.Paths;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.FloatBuffer;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

import ai.onnxruntime.*;




public class VoskModule extends ReactContextBaseJavaModule implements RecognitionListener {

    private final ReactApplicationContext reactContext;
    private SpeechService speechService;

    private OrtEnvironment ortEnvironment;
    private OrtSession ortSession;
    private Map<String, Integer> vocabulary;
    private float[] idfValues;

    public VoskModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;

        try {
            ortEnvironment = OrtEnvironment.getEnvironment();
            AssetManager assetManager = reactContext.getAssets();

            // Load ONNX model
            InputStream modelInput = assetManager.open("svm_model_1.0.onnx");
            byte[] modelBytes = new byte[modelInput.available()];
            modelInput.read(modelBytes);
            modelInput.close();
            ortSession = ortEnvironment.createSession(modelBytes, new OrtSession.SessionOptions());

            // Load tfidf_config.json
            InputStream tfidfInput = assetManager.open("tfidf_config.json");
            BufferedReader tfidfReader = new BufferedReader(new InputStreamReader(tfidfInput));
            StringBuilder builder = new StringBuilder();
            String line;
            while ((line = tfidfReader.readLine()) != null) builder.append(line);
            tfidfReader.close();

            JSONObject tfidfJson = new JSONObject(builder.toString());
            JSONObject vocabJson = tfidfJson.getJSONObject("vocabulary");
            JSONArray idfJson = tfidfJson.getJSONArray("idf");

            vocabulary = new HashMap<>();
            Iterator<String> keys = vocabJson.keys();
            while (keys.hasNext()) {
                String token = keys.next();
                vocabulary.put(token, vocabJson.getInt(token));
            }

            idfValues = new float[idfJson.length()];
            for (int i = 0; i < idfJson.length(); i++) {
                idfValues[i] = (float) idfJson.getDouble(i);
            }

            Log.i("SVM", "ONNX model and TF-IDF config loaded successfully");

        } catch (Exception e) {
            Log.e("SVM_INIT", "Failed to load ONNX or TF-IDF model", e);
        } 
    }

    @Override
    public String getName() {
        return "VoskModule";
    }

    @ReactMethod
    public void classifyFromText(String text, Promise promise) {
        try {
            float[] vector = buildTfIdfVector(text);
            long predictedIndex = classify(vector);

            InputStream is = reactContext.getAssets().open("label_classes.json");
            BufferedReader reader = new BufferedReader(new InputStreamReader(is));
            StringBuilder jsonBuilder = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                jsonBuilder.append(line);
            }
            reader.close();
            is.close();

            JSONArray labelArray = new JSONArray(jsonBuilder.toString());
            String label = labelArray.getString((int) predictedIndex);

            promise.resolve(label);

        } catch (Exception e) {
            Log.e("SVM", "Classification error", e);
            promise.reject("CLASSIFY_FROM_TEXT_FAILED", e);
        }
    }

    private float[] buildTfIdfVector(String text) {
        float[] vector = new float[vocabulary.size()];
        Map<String, Integer> tf = new HashMap<>();
        for (String word : text.toLowerCase().split("\\W+")) {
            if (vocabulary.containsKey(word)) {
                tf.put(word, tf.getOrDefault(word, 0) + 1);
            }
        }
        for (Map.Entry<String, Integer> entry : tf.entrySet()) {
            int index = vocabulary.get(entry.getKey());
            float tfidf = (1 + (float) Math.log(entry.getValue())) * idfValues[index];
            vector[index] = tfidf;
        }
        return vector;
    }

    private long classify(float[] tfidfInput) throws OrtException {
        OnnxTensor inputTensor = OnnxTensor.createTensor(
                ortEnvironment,
                FloatBuffer.wrap(tfidfInput),
                new long[]{1, tfidfInput.length}
        );
        OrtSession.Result output = ortSession.run(Collections.singletonMap("input", inputTensor));
        return ((long[][]) output.get(0).getValue())[0][0];
    }

    private void sendEventToJS(String eventName, @Nullable String message) {
        if (reactContext.hasActiveCatalystInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, message);
        }
    }

    public void startListening() {
        if (ActivityCompat.checkSelfPermission(reactContext, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            Log.e("Vosk", "Microphone permission not granted");
            return;
        }

        StorageService.unpack(reactContext, "model", "model",
                (model) -> {
                    try {
                        Recognizer recognizer = new Recognizer(model, 16000.0f);
                        speechService = new SpeechService(recognizer, 16000.0f);
                        speechService.startListening(this);
                    } catch (IOException e) {
                        Log.e("Vosk", "Failed to start recognition", e);
                    }
                },
                (e) -> Log.e("Vosk", "Model unpack failed", e));
    }

    public void stopListening() {
        if (speechService != null) {
            speechService.stop();
            speechService.shutdown();
            speechService = null;
            Log.d("Vosk", "Stopped listening");
        }
    }
    private void saveTranscript(String text) {
        File file = new File(reactContext.getFilesDir(), "transcript.txt");

        try (FileWriter writer = new FileWriter(file, true)) {
            writer.append(text).append("\n");
            Log.d("Vosk", "Transcript saved to: " + file.getAbsolutePath());
        } catch (IOException e) {
            Log.e("Vosk", "Failed to save transcript", e);
        }
    }


    public void getTranscript(Promise promise) {
        File file = new File(reactContext.getFilesDir(), "transcript.txt");

        try {
            StringBuilder content = new StringBuilder();
            BufferedReader reader = new BufferedReader(new FileReader(file));
            String line;

            while ((line = reader.readLine()) != null) {
                content.append(line).append("\n");
            }

            reader.close();
            promise.resolve(content.toString());

        } catch (IOException e) {
            Log.e("Vosk", "Error reading transcript", e);
            promise.reject("READ_ERROR", "Failed to read transcript.txt", e);
        }
    }

    @Override
    public void onPartialResult(String hypothesis) {
        Log.d("Vosk", "Partial: " + hypothesis);
    }

    @Override
    public void onResult(String hypothesis) {
        Log.d("Vosk", "Result: " + hypothesis);
    }

    @Override
    public void onFinalResult(String hypothesis) {
        Log.d("Vosk", "Final: " + hypothesis);
        saveTranscript(hypothesis);

        try {
            float[] vector = buildTfIdfVector(hypothesis);
            long predictedIndex = classify(vector);

            InputStream is = reactContext.getAssets().open("label_classes.json");
            BufferedReader reader = new BufferedReader(new InputStreamReader(is));
            StringBuilder jsonBuilder = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                jsonBuilder.append(line);
            }
            reader.close();
            is.close();

            JSONArray labelArray = new JSONArray(jsonBuilder.toString());
            String label = labelArray.getString((int) predictedIndex);
            
            // Emit transcription + label together
            WritableMap result = Arguments.createMap();
            result.putString("transcription", hypothesis);
            result.putString("label", label);
            sendEventToJS("onPrediction", result);

        } catch (Exception e) {
            Log.e("Vosk", "Error during classification in onFinalResult", e);
        }
    }

    @Override
    public void onError(Exception e) {
        Log.e("Vosk", "Error: ", e);
    }

    @Override
    public void onTimeout() {
        Log.d("Vosk", "Timeout");
    }
}
