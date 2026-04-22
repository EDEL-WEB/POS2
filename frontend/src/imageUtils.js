const BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000/api";
const BASE_ROOT = BASE.replace(/\/api$/, "");

// Curated Unsplash perfume bottle photo IDs
const PERFUME_IMAGES = [
  "photo-1541643600914-78b084683702", // perfume bottle gold
  "photo-1588405748880-12d1d2a59f75", // luxury perfume
  "photo-1592945403244-b3fbafd7f539", // perfume bottle
  "photo-1563170351-be82bc888aa4", // perfume spray
  "photo-1594035910387-fea47794261f", // perfume collection
  "photo-1615634260167-c8cdede054de", // perfume bottle dark
  "photo-1590156562745-5d53b8e5e3e5", // perfume luxury
  "photo-1600612253971-57b6b5e8e1a4", // perfume bottle close
  "photo-1547887538-047f814d0d9a", // perfume floral
  "photo-1585386959984-a4155224a1ad", // perfume cosmetics
  "photo-1619994403073-2cec844b8e63", // perfume bottle elegant
  "photo-1548036328-c9fa89d128fa", // perfume luxury dark
];

// Pick a consistent image for a product based on its name
function pickImage(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % PERFUME_IMAGES.length;
  }
  return PERFUME_IMAGES[Math.abs(hash)];
}

export function productImageUrl(product) {
  // Use uploaded image if available
  if (typeof product === "object" && product?.image_url) {
    if (product.image_url.startsWith("/")) return `${BASE}${product.image_url}`;
    return product.image_url;
  }
  const name = typeof product === "string" ? product : product?.name ?? "";
  const photoId = pickImage(name);
  return `https://images.unsplash.com/${photoId}?w=400&h=400&fit=crop&auto=format`;
}

export async function uploadImage(file) {
  const token = localStorage.getItem("pos_access");
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE}/upload/image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Upload failed");
  return data;
}
