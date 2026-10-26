import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import type { Listing } from "@listing-validator/types";
import { createApiClient } from "@listing-validator/api-client";

const defaultApiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:43124";

type Picked = { uri: string; name: string; type: string };

export default function App() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [vin, setVin] = useState("");
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [apiBase, setApiBase] = useState(defaultApiUrl);
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const api = useMemo(() => createApiClient(apiBase.trim() || defaultApiUrl), [apiBase]);
  const listingId = listing?.id;
  const listingStatus = listing?.status;

  useEffect(() => {
    if (!listingId || listingStatus === "completed" || listingStatus === "failed") return;
    const id = listingId;
    let cancelled = false;
    async function tick() {
      try {
        const next = await api.getListing(id);
        if (!cancelled) setListing(next);
      } catch {
        /* ignore */
      }
    }
    void tick();
    const timer = setInterval(() => void tick(), 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [api, listingId, listingStatus]);

  const scoreColor = useMemo(() => {
    const score = listing?.report?.riskScore;
    if (score == null) return "#9db0a4";
    if (score >= 60) return "#e86a5a";
    if (score >= 35) return "#e8b84a";
    return "#3dd68c";
  }, [listing]);

  async function pickPhotos() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (result.canceled) return;
    setPhotos(
      result.assets.map((asset, index) => ({
        uri: asset.uri,
        name: asset.fileName ?? `photo-${index}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
      }))
    );
  }

  async function submit() {
    setError(null);
    setBusy(true);
    setListing(null);
    try {
      if (!title.trim() || !description.trim()) {
        throw new Error("Title and description are required.");
      }
      if (photos.length === 0) {
        throw new Error("Add at least one photo.");
      }
      const created = await api.createListing({
        title: title.trim(),
        description: description.trim(),
        price: price ? Number(price) : null,
        vin: vin.trim() || null,
        sourceUrl: null,
      });

      const form = new FormData();
      for (const photo of photos) {
        form.append("files", {
          uri: photo.uri,
          name: photo.name,
          type: photo.type,
        } as unknown as Blob);
      }
      setListing(await api.uploadForm(created.id, form));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>SignalCheck</Text>
        <Text style={styles.headline}>Check a listing before you trust it.</Text>
        <Text style={styles.sub}>
          User-assisted uploads only. Risk signals — not title verification.
        </Text>

        <Text style={styles.label}>API server</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          value={apiBase}
          onChangeText={setApiBase}
          placeholderTextColor="#6f8578"
          placeholder="http://192.168.1.20:43124"
        />

        <Text style={styles.label}>Title</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholderTextColor="#6f8578" placeholder="2018 Honda Civic LX" />

        <Text style={styles.label}>Price</Text>
        <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" placeholderTextColor="#6f8578" placeholder="14500" />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={description}
          onChangeText={setDescription}
          multiline
          placeholderTextColor="#6f8578"
          placeholder="Seller description…"
        />

        <Text style={styles.label}>VIN (optional)</Text>
        <TextInput style={styles.input} autoCapitalize="characters" value={vin} onChangeText={setVin} placeholderTextColor="#6f8578" placeholder="17-character VIN" />

        <Pressable style={styles.secondaryBtn} onPress={pickPhotos}>
          <Text style={styles.secondaryBtnText}>
            {photos.length ? `${photos.length} photo(s) selected` : "Choose photos"}
          </Text>
        </Pressable>
        {photos.length ? (
          <ScrollView horizontal style={styles.thumbs}>
            {photos.map((p) => (
              <Image key={p.uri} source={{ uri: p.uri }} style={styles.thumb} />
            ))}
          </ScrollView>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.primaryBtn} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#04140c" /> : <Text style={styles.primaryBtnText}>Analyze listing</Text>}
        </Pressable>

        {listing ? (
          <View style={styles.report}>
            <Text style={styles.label}>Status · {listing.status}</Text>
            {listing.report ? (
              <>
                <Text style={[styles.score, { color: scoreColor }]}>{listing.report.riskScore}</Text>
                <Text style={styles.sub}>{listing.report.summary}</Text>
                <Text style={styles.badge}>History not checked · Title not verified</Text>
                {listing.report.imageFindings?.map((line) => (
                  <Text key={line} style={styles.sub}>
                    {line}
                  </Text>
                ))}
                {listing.report.claimChecks.map((check) => (
                  <Text key={check.claim} style={styles.flag}>
                    [{check.verdict}] {check.claim}: {check.detail}
                  </Text>
                ))}
                {listing.report.flags.map((flag) => (
                  <Text key={flag.code} style={styles.flag}>
                    [{flag.severity}] {flag.message}
                  </Text>
                ))}
              </>
            ) : (
              <Text style={styles.sub}>Running analysis…</Text>
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0c1210" },
  content: { padding: 20, paddingTop: 64, gap: 8, paddingBottom: 48 },
  brand: { color: "#3dd68c", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", fontWeight: "600" },
  headline: { color: "#e8f0ea", fontSize: 28, fontWeight: "700", marginTop: 8 },
  sub: { color: "#9db0a4", fontSize: 15, lineHeight: 22, marginBottom: 8 },
  label: { color: "#9db0a4", fontSize: 12, marginTop: 10, textTransform: "uppercase", letterSpacing: 0.6 },
  input: {
    borderWidth: 1,
    borderColor: "#24362c",
    backgroundColor: "#14201a",
    color: "#e8f0ea",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  textarea: { minHeight: 110, textAlignVertical: "top" },
  secondaryBtn: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#24362c",
    padding: 14,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#e8f0ea", fontWeight: "600" },
  thumbs: { marginTop: 8, maxHeight: 84 },
  thumb: { width: 72, height: 72, borderRadius: 8, marginRight: 8 },
  primaryBtn: {
    marginTop: 16,
    backgroundColor: "#3dd68c",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#04140c", fontWeight: "700" },
  error: { color: "#e86a5a", marginTop: 8 },
  report: {
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#24362c",
    backgroundColor: "#14201a",
    gap: 8,
  },
  score: { fontSize: 42, fontWeight: "700" },
  badge: { color: "#9db0a4", fontSize: 12 },
  flag: { color: "#e8f0ea", fontSize: 14, marginTop: 4 },
});
