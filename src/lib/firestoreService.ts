import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseConfig";

type ScreenshotKind = "finish" | "painter";

export async function saveScreenshot(
  kind: ScreenshotKind,
  base64Image: string,
  metadata: Record<string, unknown>
) {
  const docRef = await addDoc(collection(db, "screenshots"), {
    kind,
    image: base64Image,
    timestamp: serverTimestamp(),
    ...metadata
  });

  return docRef.id;
}
