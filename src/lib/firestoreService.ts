import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Timestamp
} from "firebase/firestore";
import { db } from "./firebaseConfig";

export type ScreenshotKind = "finish" | "painter";

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

export type ScreenshotPageCursor = QueryDocumentSnapshot<DocumentData> | null;

export type ScreenshotPage = {
  rows: ScreenshotRecord[];
  nextCursor: ScreenshotPageCursor;
  hasMore: boolean;
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

function mapScreenshotDoc(snapshot: QueryDocumentSnapshot<DocumentData>): ScreenshotRecord {
  const data = snapshot.data() as Omit<ScreenshotRecord, "id" | "timestamp"> & { timestamp?: Timestamp };
  return {
    id: snapshot.id,
    ...data,
    timestamp: data.timestamp?.toDate?.() ?? null
  };
}

async function listScreenshotsPage(
  uid: string,
  kind: ScreenshotKind,
  pageSize: number,
  cursor: ScreenshotPageCursor
): Promise<ScreenshotPage> {
  const fetchSize = Math.max(1, pageSize) + 1;
  const base = query(
    collection(db, "screenshots"),
    where("uid", "==", uid),
    where("kind", "==", kind),
    orderBy("timestamp", "desc"),
    limit(fetchSize)
  );
  const paged = cursor ? query(base, startAfter(cursor)) : base;
  const snap = await getDocs(paged);
  const pageDocs = snap.docs.slice(0, pageSize);
  const hasMore = snap.docs.length > pageSize;
  const nextCursor = hasMore ? (pageDocs[pageDocs.length - 1] ?? null) : null;

  return {
    rows: pageDocs.map(mapScreenshotDoc),
    nextCursor,
    hasMore
  };
}

export async function listScreenshotsFirstPage(
  uid: string,
  kind: ScreenshotKind,
  pageSize = 24
): Promise<ScreenshotPage> {
  return listScreenshotsPage(uid, kind, pageSize, null);
}

export async function listScreenshotsNextPage(
  uid: string,
  kind: ScreenshotKind,
  cursor: ScreenshotPageCursor,
  pageSize = 24
): Promise<ScreenshotPage> {
  if (!cursor) {
    return { rows: [], nextCursor: null, hasMore: false };
  }
  return listScreenshotsPage(uid, kind, pageSize, cursor);
}

export async function deleteScreenshotById(id: string) {
  await deleteDoc(doc(db, "screenshots", id));
}
