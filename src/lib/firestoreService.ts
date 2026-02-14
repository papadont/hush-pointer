import { addDoc, collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, where, type Timestamp } from "firebase/firestore";
import { db } from "./firebaseConfig";

type ScreenshotKind = "finish" | "painter";

export type ScreenshotRecord = {
  id: string;
  uid: string;
  kind: ScreenshotKind;
  image: string;
  timestamp: Date | null;
  scheme: "default" | "moss" | "warm" | "dusk" | "dark";
  mode: "left" | "right" | "random";
  targetSize: number;
  glowMode: boolean;
  pointerGuide: boolean;
  score?: number;
  hits?: number;
  miss?: number;
  median?: number;
  best?: number;
  perfectBonus?: number;
  paintScore?: number;
  paintStrokes?: number;
  ink?: number;
  eraserMode?: boolean;
};

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

export async function listScreenshotsByUid(uid: string, maxCount = 24): Promise<ScreenshotRecord[]> {
  const snap = await getDocs(
    query(collection(db, "screenshots"), where("uid", "==", uid), limit(maxCount))
  );

  const rows = snap.docs.map((doc) => {
    const data = doc.data() as Omit<ScreenshotRecord, "id" | "timestamp"> & { timestamp?: Timestamp };
    return {
      id: doc.id,
      ...data,
      timestamp: data.timestamp?.toDate?.() ?? null
    };
  });

  rows.sort((a, b) => (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0));
  return rows;
}

export async function deleteScreenshotById(id: string) {
  await deleteDoc(doc(db, "screenshots", id));
}
