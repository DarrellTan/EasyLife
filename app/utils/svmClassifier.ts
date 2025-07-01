import * as ort from 'onnxruntime-react-native';
import tfidfConfig from '@/app/assets/ml/tfidf_config_multilabel.json';
import labelMap from '@/app/assets/ml/label_classes_multilabel.json';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

//Singleton ONNX session
let session: ort.InferenceSession | null = null;

// -- Loads the ONNX model from assets and prepares it --
export async function loadModel() {
  if (session) {
    console.log("Reusing existing ONNX session.");
    return session;
  }
  console.log("Preparing to load ONNX model from assets...");

  const modelAsset = Asset.fromModule(require('@/app/assets/ml/svm_model_multilabel.onnx'));
  await modelAsset.downloadAsync();
  const modelPath = `${FileSystem.cacheDirectory}svm_model_multilabel.onnx`;
  await FileSystem.copyAsync({ from: modelAsset.localUri!, to: modelPath });

  console.log("Model copied to cache path:", modelPath);

  session = await ort.InferenceSession.create(modelPath);
  console.log("ONNX model loaded successfully.");
  return session;
}

// Add unloadModel function
export function unloadModel() {
  if (session) {
    console.log("Unloading ONNX model session.");
    session = null;
  }
}




// -- Converts input text into a TF-IDF vector --
function transform(text: string): number[] {
  const vocab = tfidfConfig.vocabulary;
  const idf = tfidfConfig.idf;
  
  //Safety check: Ensure vocab and IDF arrays match
  if (vocab.length !== idf.length) {
    throw new Error("TF-IDF config mismatch: vocab and idf length differ.");
  }

  // Cache the vocab-to-index map
  //if (!vocabIndexMap) {
    //vocabIndexMap = {};
    //vocab.forEach((word, i) => {
      //vocabIndexMap![word] = i;
    //});
  //}

  // Create vocab-index map
  const vocabIndexMap: { [token: string]: number } = {};
  vocab.forEach((word, i) => {
    vocabIndexMap[word] = i;
  }); 
  
  const tokens = text.toLowerCase().match(/\b\w+\b/g) || [];
  const vector = Array(vocab.length).fill(0);
  tokens.forEach(token => {
    const index = vocabIndexMap[token];
    if (typeof index === 'number') {
      vector[index] += idf[index];
    }
  });
  return vector;
}

// -- Main classification function --
export async function classify(text: string): Promise<string[]> {
  try {
    if (!text || text.trim() === '') return ["unknown"];
    console.log("Classify called with input:", text);
    
    console.log("Calling loadModel... (make sure Vosk is fully initialized)");
    const session = await loadModel();  //ensure model is loaded
    console.log("ONNX model loaded, proceeding to inference...");
    
    const inputVector = Float32Array.from(transform(text));
    console.log("TF-IDF vector length:", inputVector.length);
    console.log("Sample TF-IDF values:", inputVector.slice(0, 10)); // first 10 values
    
    const tensor = new ort.Tensor('float32', inputVector, [1, inputVector.length]);
    console.log(" Created tensor with dims:", tensor.dims);
    console.log("Data type of tensor:", tensor.type);

    // === Check model input/output names ===
    console.log("Model input names:", session.inputNames);
    console.log("Model output names:", session.outputNames);
    
    const inputName = session.inputNames[0];  // <-- get the actual input name

    // === Run the model ===
    console.log("Running inference...");
    const results = await session.run({ [inputName]: tensor });

    console.log("Model outputs:", session.outputNames);
    
    // === Find the correct output name (label output) ===
    const outputName = session.outputNames.find(name => name.toLowerCase().includes("label")) || session.outputNames[0];
    const outputTensor = results[outputName].data as number[];
    
    console.log("Model inference complete, raw output:", outputTensor); 

    const predictedLabels: string[] = [];
    outputTensor.forEach((value: number, index: number) => {
      if (value === 1) {
        const rawLabel = labelMap[index] || `unknown_${index}`;
        const cleaned = rawLabel.replace(/[\[\]'"\s]/g, '');
        predictedLabels.push(cleaned);
      }
    });
  
    console.log("Final predicted label:", predictedLabels);
    return predictedLabels.length > 0 ? predictedLabels : ["unknown"];
    
  } catch (error) {
    console.error("SVM classification failed:", error);
    return ["unknown"];
  }
}




