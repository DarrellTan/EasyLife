import * as ort from 'onnxruntime-react-native';
import tfidfConfig from '../../assets/ml/tfidf_config.json';
import labelMap from '../../assets/ml/label_classes.json';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

//Singleton ONNX session
let session: ort.InferenceSession | null = null;

// -- Loads the ONNX model from assets and prepares it --
export async function loadModel() {
  if (session) return session;
  const modelAsset = Asset.fromModule(require('../../assets/ml/svm_model_1.0.onnx'));
  await modelAsset.downloadAsync();
  const modelPath = `${FileSystem.cacheDirectory}svm_model_1.0.onnx`;
  await FileSystem.copyAsync({ from: modelAsset.localUri!, to: modelPath });
  session = await ort.InferenceSession.create(modelPath);
  return session;
}

// -- Converts input text into a TF-IDF vector --
function transform(text: string): number[] {
  const vocab = tfidfConfig.vocabulary;
  const idf = tfidfConfig.idf;
  
  //Safety check: Ensure vocab and IDF arrays match
  if (vocab.length !== idf.length) {
    throw new Error("TF-IDF config mismatch: vocab and idf length differ.");
  }
  
  const tokens = text.toLowerCase().match(/\b\w+\b/g) || [];
  const vector = Array(vocab.length).fill(0);
  tokens.forEach(token => {
    const index = vocab.indexOf(token);
    if (index !== -1) vector[index] += idf[index];
  });
  return vector;
}

// -- Main classification function --
export async function classify(text: string): Promise<string> {
  const session = await loadModel();
  const inputVector = Float32Array.from(transform(text));
  const tensor = new ort.Tensor('float32', inputVector, [1, inputVector.length]);
  const results = await session.run({ input: tensor });
  const outputName = session.outputNames[0];             // Automatically detect output
  const predictedIndex = results[outputName].data[0];
  return labelMap[predictedIndex];
}




